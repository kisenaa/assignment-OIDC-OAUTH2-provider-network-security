/* eslint-disable import/first */
import { ProxyAgent, setGlobalDispatcher } from "undici";

import env from "./env";

if (env.USE_FIDDLER_PROXY_AGENT === "true") {
  // eslint-disable-next-line no-console
  console.log("Using Fiddler proxy agent");
  setGlobalDispatcher(new ProxyAgent("http://127.0.0.1:8866"));
}

import { serve } from "@hono/node-server";

import app from "./app";

const port = env.PORT;
// eslint-disable-next-line no-console
console.log(`Server is running on port http://0.0.0.0:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0",
});
