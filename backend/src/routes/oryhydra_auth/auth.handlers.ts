import type { Context } from "hono";

import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings, AppRouteHandler } from "@/lib/types";

import env from "@/env";

import type {
  HydraConsentRoute,
  HydraLoginRoute,
  KeycloakOryHydraCallbackRoute,
  OryHydraCallbackRoute,
  OryHydraLoginRoute,
  OryHydraLogoutRoute,
  OryHydraMeRoute,
  OryHydraRefreshRoute,
} from "./auth.routes";

import {
  ACCESS_TOKEN_COOKIE,
  HYDRA_LOGIN_CHALLENGE_COOKIE,
  ID_TOKEN_COOKIE,
  KEYCLOAK_STATE_COOKIE,
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
}

interface HydraConfig {
  baseUrl: string;
  adminUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
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

interface UserProfileClaims {
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
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
    } satisfies KeycloakConfig,
  };
}

function getHydraConfig() {
  const config: Partial<HydraConfig> = {
    baseUrl: env.ORYHYDRA_BASE_URL,
    adminUrl: env.ORYHYDRA_ADMIN_URL ?? env.ORYHYDRA_BASE_URL,
    clientId: env.ORYHYDRA_CLIENT_ID,
    clientSecret: env.ORYHYDRA_CLIENT_SECRET,
    redirectUri: env.ORYHYDRA_REDIRECT_URI,
    scopes: env.ORYHYDRA_SCOPES,
  };

  const missing: string[] = [];

  if (!config.baseUrl)
    missing.push("ORYHYDRA_BASE_URL");
  if (!config.adminUrl)
    missing.push("ORYHYDRA_ADMIN_URL");
  if (!config.clientId)
    missing.push("ORYHYDRA_CLIENT_ID");
  if (!config.redirectUri)
    missing.push("ORYHYDRA_REDIRECT_URI");

  if (missing.length > 0) {
    return {
      ok: false as const,
      error: `Missing Hydra env: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true as const,
    value: {
      baseUrl: config.baseUrl!,
      adminUrl: config.adminUrl!,
      clientId: config.clientId!,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri!,
      scopes: config.scopes ?? "openid",
    } satisfies HydraConfig,
  };
}

function keycloakEndpoints(config: KeycloakConfig) {
  const oidcPath = `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect`;
  return {
    authorization: `${oidcPath}/auth`,
    token: `${oidcPath}/token`,
  };
}

function hydraEndpoints(config: HydraConfig) {
  return {
    authorization: `${config.baseUrl}/oauth2/auth`,
    token: `${config.baseUrl}/oauth2/token`,
    revoke: `${config.baseUrl}/oauth2/revoke`,
    getConsent: `${config.adminUrl}/admin/oauth2/auth/requests/consent`,
    acceptConsent: `${config.adminUrl}/admin/oauth2/auth/requests/consent/accept`,
    acceptLogin: `${config.adminUrl}/admin/oauth2/auth/requests/login/accept`,
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

function buildHydraClientAuthHeader(config: HydraConfig) {
  if (!config.clientSecret) {
    return undefined;
  }

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  return `Basic ${basic}`;
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
  deleteCookie(c, KEYCLOAK_STATE_COOKIE, { path: "/", secure });
  deleteCookie(c, HYDRA_LOGIN_CHALLENGE_COOKIE, { path: "/", secure });
}

function readJwtPayload(token?: string) {
  if (!token) {
    return undefined;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  }
  catch {
    return undefined;
  }
}

function readJwtSub(token?: string) {
  const payload = readJwtPayload(token) as { sub?: string; preferred_username?: string } | undefined;
  return payload?.sub ?? payload?.preferred_username;
}

function readJwtProfile(token?: string): UserProfileClaims {
  const payload = readJwtPayload(token) as UserProfileClaims | undefined;

  if (!payload) {
    return {};
  }

  return {
    preferred_username: payload.preferred_username,
    given_name: payload.given_name,
    family_name: payload.family_name,
    email: payload.email,
  };
}

function profileHasValues(profile: UserProfileClaims) {
  return Boolean(
    profile.preferred_username
    || profile.given_name
    || profile.family_name
    || profile.email,
  );
}

function normalizeProfile(value: unknown): UserProfileClaims {
  if (!value || typeof value !== "object") {
    return {};
  }

  const input = value as Record<string, unknown>;
  return {
    preferred_username: typeof input.preferred_username === "string" ? input.preferred_username : undefined,
    given_name: typeof input.given_name === "string" ? input.given_name : undefined,
    family_name: typeof input.family_name === "string" ? input.family_name : undefined,
    email: typeof input.email === "string" ? input.email : undefined,
  };
}

export const oryHydraLogin: AppRouteHandler<OryHydraLoginRoute> = async (c) => {
  const hydraConfigResult = getHydraConfig();
  if (!hydraConfigResult.ok) {
    return c.json({ message: hydraConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const hydraConfig = hydraConfigResult.value;
  const endpoints = hydraEndpoints(hydraConfig);

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
  authorizationUrl.searchParams.set("client_id", hydraConfig.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", hydraConfig.redirectUri);
  authorizationUrl.searchParams.set("scope", hydraConfig.scopes);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return c.redirect(authorizationUrl.toString(), 302);
};

export const hydraLogin: AppRouteHandler<HydraLoginRoute> = async (c) => {
  const keycloakConfigResult = getKeycloakConfig();
  if (!keycloakConfigResult.ok) {
    return c.json({ message: keycloakConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const query = c.req.valid("query");

  if (query.error) {
    clearSessionCookies(c);
    return c.json(
      { message: `Hydra login request error: ${query.error_description ?? query.error}` },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!query.login_challenge) {
    return c.json({ message: "Missing Hydra login challenge" }, HttpStatusCodes.BAD_REQUEST);
  }

  const keycloakConfig = keycloakConfigResult.value;
  const endpoints = keycloakEndpoints(keycloakConfig);
  const state = randomUUID();
  const secure = isSecureCookie();

  setCookie(c, HYDRA_LOGIN_CHALLENGE_COOKIE, query.login_challenge, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 600,
  });

  setCookie(c, KEYCLOAK_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 600,
  });

  const authorizationUrl = new URL(endpoints.authorization);
  authorizationUrl.searchParams.set("client_id", keycloakConfig.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", keycloakConfig.redirectUri);
  authorizationUrl.searchParams.set("scope", keycloakConfig.scopes);
  authorizationUrl.searchParams.set("state", state);

  return c.redirect(authorizationUrl.toString(), 302);
};

export const keycloakOryHydraCallback: AppRouteHandler<KeycloakOryHydraCallbackRoute> = async (c) => {
  const keycloakConfigResult = getKeycloakConfig();
  if (!keycloakConfigResult.ok) {
    return c.json({ message: keycloakConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const hydraConfigResult = getHydraConfig();
  if (!hydraConfigResult.ok) {
    return c.json({ message: hydraConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
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
    return c.json({ message: "Invalid Keycloak callback request" }, HttpStatusCodes.BAD_REQUEST);
  }

  const expectedState = getCookie(c, KEYCLOAK_STATE_COOKIE);
  const loginChallenge = getCookie(c, HYDRA_LOGIN_CHALLENGE_COOKIE);

  if (!expectedState || !loginChallenge || query.state !== expectedState) {
    clearSessionCookies(c);
    return c.json({ message: "Invalid Keycloak callback state" }, HttpStatusCodes.BAD_REQUEST);
  }

  deleteCookie(c, KEYCLOAK_STATE_COOKIE, { path: "/", secure: isSecureCookie() });

  const keycloakConfig = keycloakConfigResult.value;
  const keycloak = keycloakEndpoints(keycloakConfig);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: query.code,
    redirect_uri: keycloakConfig.redirectUri,
    client_id: keycloakConfig.clientId,
  });

  if (keycloakConfig.clientSecret) {
    body.set("client_secret", keycloakConfig.clientSecret);
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(keycloak.token, {
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
    return c.json({ message: `Keycloak token exchange failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  const keycloakToken = await tokenResponse.json() as TokenEndpointResponse;
  const subject = readJwtSub(keycloakToken.id_token) ?? readJwtSub(keycloakToken.access_token);
  const profile = {
    ...readJwtProfile(keycloakToken.access_token),
    ...readJwtProfile(keycloakToken.id_token),
  };

  if (!subject) {
    clearSessionCookies(c);
    return c.json({ message: "Unable to resolve subject from Keycloak token" }, HttpStatusCodes.BAD_GATEWAY);
  }

  const hydraConfig = hydraConfigResult.value;
  const hydra = hydraEndpoints(hydraConfig);

  const acceptLoginUrl = new URL(hydra.acceptLogin);
  acceptLoginUrl.searchParams.set("login_challenge", loginChallenge);

  let acceptLoginResponse: Response;
  try {
    const acceptLoginPayload: Record<string, unknown> = {
      subject,
      remember: true,
      remember_for: 3600,
    };

    if (profileHasValues(profile)) {
      acceptLoginPayload.context = {
        profile,
      };
    }

    acceptLoginResponse = await fetch(acceptLoginUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(acceptLoginPayload),
    });
  }
  catch (error) {
    clearSessionCookies(c);
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Hydra login accept request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!acceptLoginResponse.ok) {
    clearSessionCookies(c);
    const reason = await acceptLoginResponse.text();
    return c.json({ message: `Hydra login accept failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  const acceptLoginResult = await acceptLoginResponse.json() as { redirect_to?: string };

  if (!acceptLoginResult.redirect_to) {
    clearSessionCookies(c);
    return c.json({ message: "Hydra login accept missing redirect target" }, HttpStatusCodes.BAD_GATEWAY);
  }

  deleteCookie(c, HYDRA_LOGIN_CHALLENGE_COOKIE, { path: "/", secure: isSecureCookie() });
  return c.redirect(acceptLoginResult.redirect_to, 302);
};

export const hydraConsent: AppRouteHandler<HydraConsentRoute> = async (c) => {
  const hydraConfigResult = getHydraConfig();
  if (!hydraConfigResult.ok) {
    return c.json({ message: hydraConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const query = c.req.valid("query");

  if (query.error) {
    clearSessionCookies(c);
    return c.json(
      { message: `Hydra consent request error: ${query.error_description ?? query.error}` },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!query.consent_challenge) {
    return c.json({ message: "Missing Hydra consent challenge" }, HttpStatusCodes.BAD_REQUEST);
  }

  const hydraConfig = hydraConfigResult.value;
  const hydra = hydraEndpoints(hydraConfig);

  const getConsentUrl = new URL(hydra.getConsent);
  getConsentUrl.searchParams.set("consent_challenge", query.consent_challenge);

  let consentRequestResponse: Response;
  try {
    consentRequestResponse = await fetch(getConsentUrl);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Hydra consent lookup failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!consentRequestResponse.ok) {
    const reason = await consentRequestResponse.text();
    return c.json({ message: `Hydra consent lookup failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  const consentRequest = await consentRequestResponse.json() as {
    requested_scope?: string[];
    requested_access_token_audience?: string[];
    context?: Record<string, unknown>;
  };
  const contextProfile = consentRequest.context && typeof consentRequest.context === "object"
    ? (consentRequest.context as Record<string, unknown>).profile
    : undefined;
  const profile = normalizeProfile(contextProfile);

  const acceptConsentUrl = new URL(hydra.acceptConsent);
  acceptConsentUrl.searchParams.set("consent_challenge", query.consent_challenge);

  const acceptConsentPayload: Record<string, unknown> = {
    grant_scope: consentRequest.requested_scope ?? [],
    grant_access_token_audience: consentRequest.requested_access_token_audience ?? [],
    remember: true,
    remember_for: 3600,
  };

  if (profileHasValues(profile)) {
    acceptConsentPayload.session = {
      id_token: profile,
      access_token: profile,
    };
  }

  let acceptConsentResponse: Response;
  try {
    acceptConsentResponse = await fetch(acceptConsentUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(acceptConsentPayload),
    });
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Hydra consent accept request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!acceptConsentResponse.ok) {
    const reason = await acceptConsentResponse.text();
    return c.json({ message: `Hydra consent accept failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  const acceptConsentResult = await acceptConsentResponse.json() as { redirect_to?: string };

  if (!acceptConsentResult.redirect_to) {
    return c.json({ message: "Hydra consent accept missing redirect target" }, HttpStatusCodes.BAD_GATEWAY);
  }

  return c.redirect(acceptConsentResult.redirect_to, 302);
};

export const oryHydraCallback: AppRouteHandler<OryHydraCallbackRoute> = async (c) => {
  const hydraConfigResult = getHydraConfig();
  if (!hydraConfigResult.ok) {
    return c.json({ message: hydraConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const query = c.req.valid("query");

  if (query.error) {
    clearSessionCookies(c);
    return c.json(
      { message: `Hydra callback error: ${query.error_description ?? query.error}` },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!query.code || !query.state) {
    return c.json({ message: "Invalid Hydra callback request" }, HttpStatusCodes.BAD_REQUEST);
  }

  const expectedState = getCookie(c, OIDC_STATE_COOKIE);
  const verifier = getCookie(c, PKCE_VERIFIER_COOKIE);

  if (!expectedState || !verifier || query.state !== expectedState) {
    clearSessionCookies(c);
    return c.json({ message: "Invalid Hydra callback state" }, HttpStatusCodes.BAD_REQUEST);
  }

  deleteCookie(c, OIDC_STATE_COOKIE, { path: "/", secure: isSecureCookie() });
  deleteCookie(c, PKCE_VERIFIER_COOKIE, { path: "/", secure: isSecureCookie() });

  const hydraConfig = hydraConfigResult.value;
  const hydra = hydraEndpoints(hydraConfig);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: query.code,
    redirect_uri: hydraConfig.redirectUri,
    client_id: hydraConfig.clientId,
    code_verifier: verifier,
  });
  const authorization = buildHydraClientAuthHeader(hydraConfig);

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(hydra.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body,
    });
  }
  catch (error) {
    clearSessionCookies(c);
    const message = error instanceof Error ? error.message : "unknown error";
    return c.json({ message: `Hydra token exchange request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  if (!tokenResponse.ok) {
    clearSessionCookies(c);
    const reason = await tokenResponse.text();
    return c.json({ message: `Hydra token exchange failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
  }

  const token = await tokenResponse.json() as TokenEndpointResponse;
  setTokenCookies(c, token);

  const redirectPath = sanitizeRedirectPath(getCookie(c, POST_LOGIN_REDIRECT_COOKIE));
  deleteCookie(c, POST_LOGIN_REDIRECT_COOKIE, { path: "/", secure: isSecureCookie() });
  const frontendUrl = new URL(redirectPath, env.FRONTEND_BASE_URL).toString();

  return c.redirect(frontendUrl, 302);
};

export const oryHydraRefresh: AppRouteHandler<OryHydraRefreshRoute> = async (c) => {
  return c.json({ message: "Not implemented" }, HttpStatusCodes.BAD_GATEWAY);
};

export const oryHydraLogout: AppRouteHandler<OryHydraLogoutRoute> = async (c) => {
  const hydraConfigResult = getHydraConfig();
  if (!hydraConfigResult.ok) {
    return c.json({ message: hydraConfigResult.error }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);
  const hydraConfig = hydraConfigResult.value;
  const hydra = hydraEndpoints(hydraConfig);

  if (refreshToken) {
    const body = new URLSearchParams({
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: hydraConfig.clientId,
    });
    const authorization = buildHydraClientAuthHeader(hydraConfig);

    try {
      const revokeResponse = await fetch(hydra.revoke, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body,
      });

      if (!revokeResponse.ok) {
        const reason = await revokeResponse.text();
        clearSessionCookies(c);
        return c.json({ message: `Hydra revoke failed: ${reason}` }, HttpStatusCodes.BAD_GATEWAY);
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      clearSessionCookies(c);
      return c.json({ message: `Hydra revoke request failed: ${message}` }, HttpStatusCodes.BAD_GATEWAY);
    }
  }

  clearSessionCookies(c);
  return c.json({ operation: "logout", message: "Signed out" }, HttpStatusCodes.OK);
};

export const oryHydraMe: AppRouteHandler<OryHydraMeRoute> = async (c) => {
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
