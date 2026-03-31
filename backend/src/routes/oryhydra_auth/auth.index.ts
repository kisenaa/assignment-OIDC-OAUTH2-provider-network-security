import { createRouter } from "@/lib/create-app";

import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = createRouter()
  .openapi(routes.oryHydraLogin, handlers.oryHydraLogin)
  .openapi(routes.hydraLogin, handlers.hydraLogin)
  .openapi(routes.hydraConsent, handlers.hydraConsent)
  .openapi(routes.keycloakOryHydraCallback, handlers.keycloakOryHydraCallback)
  .openapi(routes.oryHydraCallback, handlers.oryHydraCallback)
  .openapi(routes.oryHydraRefresh, handlers.oryHydraRefresh)
  .openapi(routes.oryHydraLogout, handlers.oryHydraLogout)
  .openapi(routes.oryHydraMe, handlers.oryHydraMe);

export default router;
