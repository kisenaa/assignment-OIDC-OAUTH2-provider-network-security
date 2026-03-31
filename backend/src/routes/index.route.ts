import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

import { createRouter } from "@/lib/create-app";

const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema("OIDC Playground API"),
          "OIDC Playground API Index",
        ),
      },
    }),
    (c) => {
      const logger = c.get("logger");
      logger.info("Handling index route");

      return c.json({
        message: "OIDC Playground API",
      }, HttpStatusCodes.OK);
    },
  );

export default router;
