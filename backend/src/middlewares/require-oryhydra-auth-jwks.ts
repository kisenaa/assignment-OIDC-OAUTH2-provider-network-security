import type { Algorithm } from "@node-rs/jsonwebtoken";
import type { MiddlewareHandler } from "hono";

import { decodeHeader, verifySync } from "@node-rs/jsonwebtoken";
import { deleteCookie, getCookie } from "hono/cookie";
import { createPublicKey } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings } from "@/lib/types";

import env from "@/env";
import { ACCESS_TOKEN_COOKIE } from "@/routes/oryhydra_auth/auth.constants";

interface JwkKey {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface JwksResponse {
  keys: JwkKey[];
}

const SUPPORTED_ALGORITHMS = new Set([
  "HS256",
  "HS384",
  "HS512",
  "ES256",
  "ES384",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "EdDSA",
]);

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

let jwksCache: JwksResponse | null = null;
let jwksCacheAt = 0;

function isSecureCookie() {
  return env.NODE_ENV === "production";
}

function normalizeIssuer(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

async function fetchHydraJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCacheAt < JWKS_CACHE_TTL_MS) {
    return jwksCache;
  }

  if (!env.ORYHYDRA_BASE_URL) {
    throw new Error("ORYHYDRA_BASE_URL is not configured");
  }

  const jwksUrl = `${env.ORYHYDRA_BASE_URL}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const jwks = await response.json() as JwksResponse;
  if (!Array.isArray(jwks.keys)) {
    throw new TypeError("Invalid JWKS response format");
  }

  jwksCache = jwks;
  jwksCacheAt = now;

  return jwks;
}

function findJwkByKid(jwks: JwksResponse, kid?: string) {
  if (!kid) {
    return undefined;
  }

  return jwks.keys.find(key => key.kid === kid);
}

function jwkToPem(jwk: JwkKey) {
  const keyObject = createPublicKey({
    key: jwk as unknown as Record<string, unknown>,
    format: "jwk",
  } as Parameters<typeof createPublicKey>[0]);

  return keyObject.export({
    format: "pem",
    type: "spki",
  }).toString();
}

export const requireOryHydraAccessTokenJwks: MiddlewareHandler<AppBindings> = async (c, next) => {
  const accessToken = getCookie(c, ACCESS_TOKEN_COOKIE);
  const logger = c.get("logger");

  if (!accessToken) {
    return c.json({ message: "Access token not found or invalid" }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!env.ORYHYDRA_BASE_URL) {
    logger.error("ORYHYDRA_BASE_URL is not configured");
    return c.json({ message: "Hydra auth configuration is incomplete" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  let header: Record<string, unknown>;
  try {
    header = decodeHeader(accessToken) as Record<string, unknown>;
  }
  catch {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Failed to decode access token" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const kid = typeof header.kid === "string" ? header.kid : undefined;
  const alg = typeof header.alg === "string" ? header.alg : undefined;

  if (!alg || !SUPPORTED_ALGORITHMS.has(alg)) {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Unsupported token algorithm" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let jwks: JwksResponse;
  try {
    jwks = await fetchHydraJwks();
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`Failed to fetch Hydra JWKS: ${message}`);
    return c.json({ message: "Failed to verify access token" }, HttpStatusCodes.BAD_GATEWAY);
  }

  const jwk = findJwkByKid(jwks, kid);
  if (!jwk) {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Unable to find matching JWKS key" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let claims: Record<string, unknown>;
  try {
    const pem = jwkToPem(jwk);
    claims = verifySync(accessToken, pem, {
      algorithms: [alg as Algorithm],
    }) as Record<string, unknown>;
  }
  catch {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Failed to verify access token" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const expectedIssuer = normalizeIssuer(env.ORYHYDRA_BASE_URL);
  const tokenIssuer = typeof claims.iss === "string" ? claims.iss : undefined;
  if (tokenIssuer && tokenIssuer !== expectedIssuer) {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Invalid token issuer" }, HttpStatusCodes.UNAUTHORIZED);
  }

  c.set("auth", {
    accessToken,
    verified: true,
    header,
    claims,
  });

  await next();
};
