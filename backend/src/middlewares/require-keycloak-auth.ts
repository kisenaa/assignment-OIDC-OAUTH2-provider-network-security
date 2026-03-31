import type { Algorithm } from "@node-rs/jsonwebtoken";
import type { MiddlewareHandler } from "hono";

import { decodeHeader, verifySync } from "@node-rs/jsonwebtoken";
import { deleteCookie, getCookie } from "hono/cookie";
import { Buffer } from "node:buffer";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings } from "@/lib/types";

import env from "@/env";
import { ACCESS_TOKEN_COOKIE } from "@/routes/keycloak_auth/auth.constants";

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

function isSecureCookie() {
  return env.NODE_ENV === "production";
}

function parseTokenPayload(token: string) {
  const [, payloadSegment] = token.split(".");

  if (!payloadSegment) {
    return {} as Record<string, unknown>;
  }

  const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const payload = Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");

  try {
    return JSON.parse(payload) as Record<string, unknown>;
  }
  catch {
    return {} as Record<string, unknown>;
  }
}

export const requireKeycloakAccessToken: MiddlewareHandler<AppBindings> = async (c, next) => {
  const accessToken = getCookie(c, ACCESS_TOKEN_COOKIE);
  const logger = c.get("logger");

  logger.info("Checking for access token in cookie");
  logger.info(accessToken ? "Access token found in cookie" : "No access token found in cookie");

  if (!accessToken) {
    return c.json({ message: "Access token not found or invalid" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let header: Record<string, unknown>;
  try {
    header = decodeHeader(accessToken) as Record<string, unknown>;
  }
  catch {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Failed to decode access token" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const headerAlg = typeof header.algorithm === "string"
    ? header.algorithm
    : typeof header.alg === "string"
      ? header.alg
      : undefined;

  if (env.KEYCLOAK_PUBLIC_KEY_PEM) {
    try {
      const verificationOptions = headerAlg && SUPPORTED_ALGORITHMS.has(headerAlg)
        ? { algorithms: [headerAlg as Algorithm] }
        : undefined;

      const claims = verificationOptions
        ? verifySync(accessToken, env.KEYCLOAK_PUBLIC_KEY_PEM, verificationOptions) as Record<string, unknown>
        : verifySync(accessToken, env.KEYCLOAK_PUBLIC_KEY_PEM) as Record<string, unknown>;

      c.set("auth", {
        accessToken,
        verified: true,
        header,
        claims,
      });

      await next();
      return;
    }
    catch {
      logger.error("Failed to verify access token");
      return c.json({ message: "Failed to verify access token" }, HttpStatusCodes.UNAUTHORIZED);
    }
  }

  const claims = parseTokenPayload(accessToken);
  const expClaim = claims.exp;

  if (typeof expClaim === "number" && expClaim * 1000 <= Date.now()) {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Access token not found or invalid" }, HttpStatusCodes.UNAUTHORIZED);
  }

  c.set("auth", {
    accessToken,
    verified: false,
    header,
    claims,
  });

  await next();
};
