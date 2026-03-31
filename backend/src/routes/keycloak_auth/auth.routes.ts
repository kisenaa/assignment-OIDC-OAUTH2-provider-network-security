  import { createRoute, z } from "@hono/zod-openapi";
  import * as HttpStatusCodes from "stoker/http-status-codes";
  import { jsonContent } from "stoker/openapi/helpers";
  import { createMessageObjectSchema } from "stoker/openapi/schemas";

  import { requireKeycloakAccessToken } from "@/middlewares/require-keycloak-auth";

  const tags = ["Keycloak Auth"];

  const loginQuerySchema = z.object({
    redirectTo: z.string().optional(),
  });

  const callbackQuerySchema = z.object({
    code: z.string().optional(),
    state: z.string().optional(),
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

  export const keycloakLogin = createRoute({
    path: "/auth/keycloak/login",
    method: "get",
    tags,
    request: {
      query: loginQuerySchema,
    },
    responses: {
      302: {
        description: "Redirects the user agent to Keycloak authorization endpoint",
      },
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema("Keycloak configuration is incomplete"),
        "Missing Keycloak configuration",
      ),
    },
  });

  export const keycloakCallback = createRoute({
    path: "/auth/keycloak/callback",
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

  export const keycloakRefresh = createRoute({
    path: "/auth/keycloak/refresh",
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

  export const keycloakLogout = createRoute({
    path: "/auth/keycloak/logout",
    method: "post",
    tags,
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        operationMessageSchema,
        "Session cookies cleared and Keycloak logout requested",
      ),
      [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
        createMessageObjectSchema("Keycloak logout failed"),
        "Logout failed",
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        createMessageObjectSchema("Keycloak configuration is incomplete"),
        "Missing Keycloak configuration",
      ),
    },
  });

  export const keycloakMe = createRoute({
    path: "/auth/keycloak/me",
    method: "get",
    tags,
    middleware: [requireKeycloakAccessToken],
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

  export type KeycloakLoginRoute = typeof keycloakLogin;
  export type KeycloakCallbackRoute = typeof keycloakCallback;
  export type KeycloakRefreshRoute = typeof keycloakRefresh;
  export type KeycloakLogoutRoute = typeof keycloakLogout;
  export type KeycloakMeRoute = typeof keycloakMe;
