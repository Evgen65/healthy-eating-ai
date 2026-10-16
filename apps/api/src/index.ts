import "./config/loadEnv.js";
import { validateEnv } from "./config/validateEnv.js";

// Validate BEFORE the app (and therefore env.ts, the DB pool and the AI
// provider factory) is loaded, so a misconfigured deployment fails fast with
// one clear message instead of a stack trace from deep inside a module.
const { errors, warnings } = validateEnv(process.env);
for (const warning of warnings) {
  console.warn(`[config] WARNING: ${warning}`);
}
if (errors.length > 0) {
  console.error("[config] Invalid configuration - refusing to start:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const { app } = await import("./app.js");
const { env } = await import("./config/env.js");
const { pool } = await import("./db/pool.js");
const { registerGracefulShutdown } = await import("./shutdown.js");

const server = app.listen(env.port, () => {
  console.log(`[startup] healthy-eating-api listening on port ${env.port} (NODE_ENV=${env.nodeEnv}, AI_PROVIDER=${env.aiProvider})`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`[startup] HTTP server failed: ${error.code ?? error.message} (port ${env.port})`);
  process.exit(1);
});

registerGracefulShutdown(server, pool);
