import type { Schema } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { requestId } from "hono/request-id";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import env from "@/env";
import { pinoLogger } from "@/middlewares/pino-logger";

import type { AppBindings, AppOpenAPI } from "./types";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp() {
  const app = createRouter();
  app.use(requestId())
    .use(serveEmojiFavicon("📝"))
    .use(pinoLogger())
    .use(cors({
      origin: ["http://localhost:5173", "https://web.elysia.com", "https://hydra.elysia.com:4444", "https://hydra.elysia.com:4445", "https://keycloak.elysia.com:8443", "https://192.168.175.128:8443", "https://192.168.175.128:4444", "https://192.168.175.128:4445"],
      credentials: true,
    }))
    // .use(csrf({ origin: env.FRONTEND_BASE_URL }))
    .use(compress());

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route("/", router);
}
