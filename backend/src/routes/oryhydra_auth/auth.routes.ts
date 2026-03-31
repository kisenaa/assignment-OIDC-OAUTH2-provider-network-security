import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

import { requireOryHydraAccessToken } from "@/middlewares/require-oryhydra-auth";

const tags = ["Ory Hydra Auth"];

const loginQuerySchema = z.object({
  redirectTo: z.string().optional(),
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const hydraChallengeQuerySchema = z.object({
  login_challenge: z.string().optional(),
  consent_challenge: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const tokenSummarySchema = z.object({
  authenticated: z.boolean(),
  tokenType: z.string().optional(),
  expiresIn: z.number().optional(),
  refreshExpiresIn: z.number().optional(),
  scope: z.string().optional(),
});

const meSchema = z.object({
  authenticated: z.boolean(),
  verified: z.boolean(),
  header: z.object({}).catchall(z.unknown()),
  claims: z.object({}).catchall(z.unknown()),
});

const operationMessageSchema = z.object({
  operation: z.string(),
  message: z.string(),
});

export const oryHydraLogin = createRoute({
  path: "/auth/ory-hydra/login",
  method: "get",
  tags,
  request: {
    query: loginQuerySchema,
  },
  responses: {
    302: {
      description: "Redirects the user agent to Ory Hydra authorization endpoint",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Ory Hydra configuration is incomplete"),
      "Missing Ory Hydra configuration",
    ),
  },
});

export const keycloakOryHydraCallback = createRoute({
  path: "/auth/ory-hydra/keycloak-integration/callback",
  method: "get",
  tags,
  request: {
    query: callbackQuerySchema,
  },
  responses: {
    302: {
      description: "Authorization code exchange succeeded and browser redirected to frontend",
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid callback request"),
      "Invalid callback data",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("Keycloak token exchange failed"),
      "Token exchange failed",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Keycloak configuration is incomplete"),
      "Missing Keycloak configuration",
    ),
  },
});

export const hydraLogin = createRoute({
  path: "/auth/hydra/login",
  method: "get",
  tags,
  request: {
    query: hydraChallengeQuerySchema,
  },
  responses: {
    302: {
      description: "Redirects the user agent to Keycloak for authentication",
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Missing or invalid login challenge"),
      "Invalid Hydra login challenge",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Hydra or Keycloak configuration is incomplete"),
      "Missing authentication configuration",
    ),
  },
});

export const hydraConsent = createRoute({
  path: "/auth/hydra/consent",
  method: "get",
  tags,
  request: {
    query: hydraChallengeQuerySchema,
  },
  responses: {
    302: {
      description: "Accepts Hydra consent and redirects to client callback",
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Missing or invalid consent challenge"),
      "Invalid Hydra consent challenge",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("Hydra consent accept failed"),
      "Hydra consent failed",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Hydra configuration is incomplete"),
      "Missing Hydra configuration",
    ),
  },
});

export const oryHydraCallback = createRoute({
  path: "/auth/ory-hydra/callback",
  method: "get",
  tags,
  request: {
    query: callbackQuerySchema,
  },
  responses: {
    302: {
      description: "Hydra code exchange succeeded and browser redirected to frontend",
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid callback request"),
      "Invalid callback data",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("Hydra token exchange failed"),
      "Token exchange failed",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Hydra configuration is incomplete"),
      "Missing Hydra configuration",
    ),
  },
});

export const oryHydraRefresh = createRoute({
  path: "/auth/ory-hydra/refresh",
  method: "post",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      tokenSummarySchema,
      "Refresh token exchange succeeded",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema("Refresh token not found"),
      "No refresh token",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("Keycloak refresh failed"),
      "Refresh failed",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Keycloak configuration is incomplete"),
      "Missing Keycloak configuration",
    ),
  },
});

export const oryHydraLogout = createRoute({
  path: "/auth/ory-hydra/logout",
  method: "post",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      operationMessageSchema,
      "Session cookies cleared and Ory Hydra logout requested",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("Ory Hydra logout failed"),
      "Logout failed",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Ory Hydra configuration is incomplete"),
      "Missing Ory Hydra configuration",
    ),
  },
});

export const oryHydraMe = createRoute({
  path: "/auth/ory-hydra/me",
  method: "get",
  tags,
  middleware: [requireOryHydraAccessToken],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      meSchema,
      "Current user token claims",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema("Access token not found or invalid"),
      "No or invalid access token",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Keycloak configuration is incomplete"),
      "Missing Keycloak configuration",
    ),
  },
});

export type OryHydraLoginRoute = typeof oryHydraLogin;
export type KeycloakOryHydraCallbackRoute = typeof keycloakOryHydraCallback;
export type HydraLoginRoute = typeof hydraLogin;
export type HydraConsentRoute = typeof hydraConsent;
export type OryHydraCallbackRoute = typeof oryHydraCallback;
export type OryHydraRefreshRoute = typeof oryHydraRefresh;
export type OryHydraLogoutRoute = typeof oryHydraLogout;
export type OryHydraMeRoute = typeof oryHydraMe;
