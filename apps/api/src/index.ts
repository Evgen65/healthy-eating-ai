import "./config/loadEnv.js";
import { validateEnv } from "./config/validateEnv.js";
import { logger } from "./logging/logger.js";

// Validate BEFORE the app (and therefore env.ts, the DB pool and the AI
// provider factory) is loaded, so a misconfigured deployment fails fast with
// one clear message instead of a stack trace from deep inside a module.
const { errors, warnings } = validateEnv(process.env);
for (const warning of warnings) {
  logger.warn({ event: "config_warning" }, warning);
}
if (errors.length > 0) {
  // validateEnv messages never contain secret values.
  logger.fatal({ event: "config_invalid", errors }, "invalid configuration - refusing to start");
  process.exit(1);
}

const { app } = await import("./app.js");
const { env } = await import("./config/env.js");
const { pool } = await import("./db/pool.js");
const { registerGracefulShutdown } = await import("./shutdown.js");

const server = app.listen(env.port, () => {
  logger.info(
    { event: "server_started", port: env.port, nodeEnv: env.nodeEnv, aiProvider: env.aiProvider },
    "healthy-eating-api listening",
  );
});

server.on("error", (error: NodeJS.ErrnoException) => {
  logger.fatal({ event: "server_listen_failed", code: error.code, port: env.port }, "HTTP server failed to start");
  process.exit(1);
});

registerGracefulShutdown(server, pool);
