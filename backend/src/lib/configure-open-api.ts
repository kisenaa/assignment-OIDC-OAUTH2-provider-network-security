import { swaggerUI } from "@hono/swagger-ui";
import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "./types";

import packageJSON from "../../package.json" with { type: "json" };

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/docs/scalar-config", {
    openapi: "3.2.0",
    info: {
      version: packageJSON.version,
      title: "OIDC Playground API",
    },
  });

  app.get(
    "/docs/scalar",
    Scalar({
      theme: "kepler",
      layout: "modern",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
      url: "/docs/scalar-config",
      defaultOpenAllTags: true,
    }),
  );

  app.doc("/docs/swagger-config", {
    openapi: "3.1.2",
    info: {
      version: packageJSON.version,
      title: "OIDC Playground API",
    },
  });

  app.get("/docs/swagger-ui", swaggerUI({ url: "/docs/swagger-config" }));
}
