import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import keycloakAuth from "@/routes/keycloak_auth/auth.index";
import oryhydraAuth from "@/routes/oryhydra_auth/auth.index";

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  keycloakAuth,
  oryhydraAuth,
] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
