import type { Context } from "hono";
import type { Buffer } from "node:buffer";

import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings, AppRouteHandler } from "@/lib/types";

import env from "@/env";

import type {
  KeycloakCallbackRoute,
  KeycloakLoginRoute,
  KeycloakLogoutRoute,
  KeycloakMeRoute,
  KeycloakRefreshRoute,
} from "./auth.routes";

import {
  ACCESS_TOKEN_COOKIE,
  ID_TOKEN_COOKIE,
  OIDC_STATE_COOKIE,
  PKCE_VERIFIER_COOKIE,
  POST_LOGIN_REDIRECT_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./auth.constants";

interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
  publicKeyPem?: string;
}

interface TokenEndpointResponse {
  access_token: string;
  expires_in?: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  id_token?: string;
  scope?: string;
}

type AppContext = Context<AppBindings>;

function getKeycloakConfig() {
  const config: Partial<KeycloakConfig> = {
    baseUrl: env.KEYCLOAK_BASE_URL,
    realm: env.KEYCLOAK_REALM,
    clientId: env.KEYCLOAK_CLIENT_ID,
    clientSecret: env.KEYCLOAK_CLIENT_SECRET,
    redirectUri: env.KEYCLOAK_REDIRECT_URI,
    scopes: env.KEYCLOAK_SCOPES,
    publicKeyPem: env.KEYCLOAK_PUBLIC_KEY_PEM,
  };

  const missing: string[] = [];

  if (!config.baseUrl)
    missing.push("KEYCLOAK_BASE_URL");
  if (!config.realm)
    missing.push("KEYCLOAK_REALM");
  if (!config.clientId)
    missing.push("KEYCLOAK_CLIENT_ID");
  if (!config.redirectUri)
    missing.push("KEYCLOAK_REDIRECT_URI");

  if (missing.length > 0) {
    return {
      ok: false as const,
      error: `Missing Keycloak env: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true as const,
    value: {
      baseUrl: config.baseUrl!,
      realm: config.realm!,
      clientId: config.clientId!,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri!,
      scopes: config.scopes ?? "openid profile email",
      publicKeyPem: config.publicKeyPem,
    } satisfies KeycloakConfig,
  };
}

function keycloakEndpoints(config: KeycloakConfig) {
  const oidcPath = `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect`;
  return {
    authorization: `${oidcPath}/auth`,
    token: `${oidcPath}/token`,
    logout: `${oidcPath}/logout`,
  };
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier() {
  return base64Url(randomBytes(64));
}

function createCodeChallenge(verifier: string) {
  const digest = createHash("sha256").update(verifier).digest();
  return base64Url(digest);
}

function isSecureCookie() {
  return env.NODE_ENV === "production";
}

function sanitizeRedirectPath(path?: string) {
  const fallback = env.FRONTEND_DEFAULT_PATH;

  if (!path) {
    return fallback;
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\n") || path.includes("\r")) {
    return fallback;
  }

  return path;
}

function setTokenCookies(c: AppContext, token: TokenEndpointResponse) {
  const secure = isSecureCookie();

  setCookie(c, ACCESS_TOKEN_COOKIE, token.access_token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: token.expires_in,
  });

  if (token.refresh_token) {
    setCookie(c, REFRESH_TOKEN_COOKIE, token.refresh_token, {
      httpOnly: true,
      sameSite: "Lax",
      secure,
      path: "/",
      maxAge: token.refresh_expires_in,
    });
  }

  if (token.id_token) {
    setCookie(c, ID_TOKEN_COOKIE, token.id_token, {
      httpOnly: true,
      sameSite: "Lax",
      secure,
      path: "/",
      maxAge: token.expires_in,
    });
  }
}

function clearSessionCookies(c: AppContext) {
  const secure = isSecureCookie();
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/", secure });
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: "/", secure });
  deleteCookie(c, ID_TOKEN_COOKIE, { path: "/", secure });
  deleteCookie(c, OIDC_STATE_COOKIE, { path: "/", secure });
  deleteCookie(c, PKCE_VERIFIER_COOKIE, { path: "/", secure });
  deleteCookie(c, POST_LOGIN_REDIRECT_COOKIE, { path: "/", secure });
}

export const keycloakLogin: AppRouteHandler<KeycloakLoginRoute> = async (c) => {
  const configResult = getKeycloakConfig();
  if (!configResult.ok) {
    return c.json({ message: configResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const config = configResult.value;
  const endpoints = keycloakEndpoints(config);

  const state = randomUUID();
  const query = c.req.valid("query");
  const verifier = createCodeVerifier();
  const challenge = createCodeChallenge(verifier);
  const secure = isSecureCookie();
  const redirectPath = sanitizeRedirectPath(query.redirectTo);

  setCookie(c, OIDC_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 600,
  });

  setCookie(c, PKCE_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 600,
  });

  setCookie(c, POST_LOGIN_REDIRECT_COOKIE, redirectPath, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 600,
  });

  const authorizationUrl = new URL(endpoints.authorization);
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("scope", config.scopes);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return c.redirect(authorizationUrl.toString(), 302);
};

export const keycloakCallback: AppRouteHandler<KeycloakCallbackRoute> = async (c) => {
  const configResult = getKeycloakConfig();
  if (!configResult.ok) {
    return c.json({ message: configResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const query = c.req.valid("query");

  if (query.error) {
    clearSessionCookies(c);
    return c.json(
      { message: `Keycloak callback error: ${query.error_description ?? query.error}` },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!query.code || !query.state) {
    return c.json({ message: "Invalid callback request" }, HttpStatusCodes.BAD_REQUEST);
  }

  const config = configResult.value;
  const endpoints = keycloakEndpoints(config);

  const expectedState = getCookie(c, OIDC_STATE_COOKIE);
  const verifier = getCookie(c, PKCE_VERIFIER_COOKIE);

  if (!expectedState || !verifier || query.state !== expectedState) {
    clearSessionCookies(c);
    return c.json({ message: "Invalid callback state" }, HttpStatusCodes.BAD_REQUEST);
  }

  deleteCookie(c, OIDC_STATE_COOKIE, { path: "/", secure: isSecureCookie() });
  deleteCookie(c, PKCE_VERIFIER_COOKIE, { path: "/", secure: isSecureCookie() });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: query.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }
  catch (error) {
    clearSessionCookies(c);
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Keycloak token exchange request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!tokenResponse.ok) {
    clearSessionCookies(c);
    const reason = await tokenResponse.text();
    return c.json(
      { message: `Keycloak token exchange failed: ${reason}` },
      HttpStatusCodes.BAD_GATEWAY,
    );
  }

  const token = await tokenResponse.json() as TokenEndpointResponse;
  setTokenCookies(c, token);

  const redirectPath = sanitizeRedirectPath(getCookie(c, POST_LOGIN_REDIRECT_COOKIE));
  deleteCookie(c, POST_LOGIN_REDIRECT_COOKIE, { path: "/", secure: isSecureCookie() });
  const frontendUrl = new URL(redirectPath, env.FRONTEND_BASE_URL).toString();

  return c.redirect(frontendUrl, 302);
};

export const keycloakRefresh: AppRouteHandler<KeycloakRefreshRoute> = async (c) => {
  const configResult = getKeycloakConfig();
  if (!configResult.ok) {
    return c.json({ message: configResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);
  if (!refreshToken) {
    return c.json({ message: "Refresh token not found" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const config = configResult.value;
  const endpoints = keycloakEndpoints(config);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }
  catch (error) {
    clearSessionCookies(c);
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Keycloak refresh request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!tokenResponse.ok) {
    clearSessionCookies(c);
    const reason = await tokenResponse.text();
    return c.json({ message: `Keycloak refresh failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  const token = await tokenResponse.json() as TokenEndpointResponse;
  setTokenCookies(c, token);

  return c.json({
    authenticated: true,
    tokenType: token.token_type,
    expiresIn: token.expires_in,
    refreshExpiresIn: token.refresh_expires_in,
    scope: token.scope,
  }, HttpStatusCodes.OK);
};

export const keycloakLogout: AppRouteHandler<KeycloakLogoutRoute> = async (c) => {
  const logger = c.get("logger");
  logger.info("Initiating Keycloak logout");

  const configResult = getKeycloakConfig();
  if (!configResult.ok) {
    return c.json({ message: configResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const config = configResult.value;
  const endpoints = keycloakEndpoints(config);
  const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);

  const body = new URLSearchParams({
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  if (refreshToken) {
    body.set("refresh_token", refreshToken);
  }

  let logoutResponse: Response;
  try {
    logoutResponse = await fetch(endpoints.logout, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Keycloak logout request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!logoutResponse.ok) {
    const reason = await logoutResponse.text();
    return c.json({ message: `Keycloak logout failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  clearSessionCookies(c);
  return c.json({ operation: "logout", message: "Signed out" }, HttpStatusCodes.OK);
};

export const keycloakMe: AppRouteHandler<KeycloakMeRoute> = async (c) => {
  const auth = c.get("auth");

  if (!auth) {
    return c.json({ message: "Access token not found or invalid" }, HttpStatusCodes.UNAUTHORIZED);
  }

  return c.json({
    authenticated: true,
    verified: auth.verified,
    header: auth.header,
    claims: auth.claims,
  }, HttpStatusCodes.OK);
};
