/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(config({
  path: path.resolve(
    process.cwd(),
    process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  ),
}));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  DATABASE_URL: z.url(),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  KEYCLOAK_BASE_URL: z.url().optional(),
  KEYCLOAK_REALM: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  KEYCLOAK_REDIRECT_URI: z.url().optional(),
  KEYCLOAK_SCOPES: z.string().default("openid profile email"),
  KEYCLOAK_PUBLIC_KEY_PEM: z.string().optional(),
  ORYHYDRA_BASE_URL: z.url().optional(),
  ORYHYDRA_ADMIN_URL: z.url().optional(),
  ORYHYDRA_CLIENT_ID: z.string().optional(),
  ORYHYDRA_CLIENT_SECRET: z.string().optional(),
  ORYHYDRA_REDIRECT_URI: z.url().optional(),
  ORYHYDRA_SCOPES: z.string().default("openid"),
  FRONTEND_BASE_URL: z.url().default("http://localhost:8000"),
  FRONTEND_DEFAULT_PATH: z.string().default("/"),
  USE_FIDDLER_PROXY_AGENT:z.enum(["true", "false"]).default("false"),
}).superRefine((input, ctx) => {
  if (input.NODE_ENV === "production" && !input.DATABASE_AUTH_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      expected: "string",
      received: "undefined",
      path: ["DATABASE_AUTH_TOKEN"],
      message: "Must be set when NODE_ENV is 'production'",
    });
  }
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
