import type { MiddlewareHandler } from "hono";

import { decodeHeader } from "@node-rs/jsonwebtoken";
import { deleteCookie, getCookie } from "hono/cookie";
import { Buffer } from "node:buffer";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings } from "@/lib/types";

import env from "@/env";
import { ACCESS_TOKEN_COOKIE } from "@/routes/oryhydra_auth/auth.constants";

function getHydraAdminUrl() {
  return env.ORYHYDRA_ADMIN_URL ?? env.ORYHYDRA_BASE_URL;
}

function isSecureCookie() {
  return env.NODE_ENV === "production";
}

export const requireOryHydraAccessToken: MiddlewareHandler<AppBindings> = async (c, next) => {
  const accessToken = getCookie(c, ACCESS_TOKEN_COOKIE);
  const logger = c.get("logger");

  logger.info("Checking for access token in cookie");
  logger.info(accessToken ? "Access token found in cookie" : "No access token found in cookie");

  if (!accessToken) {
    return c.json({ message: "Access token not found or invalid" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let header: Record<string, unknown> = {};
  try {
    header = decodeHeader(accessToken) as Record<string, unknown>;
  }
  catch {
    // Hydra can issue opaque access tokens (for example, ory_at_*),
    // so JWT header decode failure is not fatal when introspection is used.
    header = { token_type: "opaque" };
  }

  const headerAlg = typeof header.algorithm === "string"
    ? header.algorithm
    : typeof header.alg === "string"
      ? header.alg
      : undefined;

  const hydraAdminUrl = getHydraAdminUrl();
  if (!hydraAdminUrl || !env.ORYHYDRA_CLIENT_ID || !env.ORYHYDRA_CLIENT_SECRET) {
    logger.error("Hydra introspection configuration is incomplete");
    return c.json({ message: "Hydra auth configuration is incomplete" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const introspectionUrl = `${hydraAdminUrl}/admin/oauth2/introspect`;
  const basicAuth = Buffer.from(`${env.ORYHYDRA_CLIENT_ID}:${env.ORYHYDRA_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    token: accessToken,
    token_type_hint: "access_token",
  });

  let introspectionResponse: Response;
  try {
    introspectionResponse = await fetch(introspectionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body,
    });
  }
  catch (error) {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`Hydra introspection request failed: ${message}`);
    return c.json({ message: "Failed to verify access token" }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!introspectionResponse.ok) {
    const reason = await introspectionResponse.text();
    logger.error(`Hydra introspection endpoint returned ${introspectionResponse.status}: ${reason}`);
    return c.json(
      { message: `Failed to verify access token: ${reason}` },
      introspectionResponse.status === HttpStatusCodes.UNAUTHORIZED
        ? HttpStatusCodes.UNAUTHORIZED
        : HttpStatusCodes.BAD_GATEWAY,
    );
  }

  const claims = await introspectionResponse.json() as Record<string, unknown>;
  const isActive = claims.active === true;

  if (!isActive) {
    deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure: isSecureCookie() });
    return c.json({ message: "Access token not found or invalid" }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (typeof headerAlg === "string") {
    claims.token_alg = headerAlg;
  }

  c.set("auth", {
    accessToken,
    verified: true,
    header,
    claims,
  });

  await next();
};

export const requireOryHydraAccessTokenIntrospection = requireOryHydraAccessToken;
export const requireKeycloakAccessToken = requireOryHydraAccessToken;
