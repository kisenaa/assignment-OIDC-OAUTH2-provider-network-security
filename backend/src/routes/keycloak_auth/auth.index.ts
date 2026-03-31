import { createRouter } from "@/lib/create-app";

import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = createRouter()
  .openapi(routes.keycloakLogin, handlers.keycloakLogin)
  .openapi(routes.keycloakCallback, handlers.keycloakCallback)
  .openapi(routes.keycloakRefresh, handlers.keycloakRefresh)
  .openapi(routes.keycloakLogout, handlers.keycloakLogout)
  .openapi(routes.keycloakMe, handlers.keycloakMe);

export default router;
