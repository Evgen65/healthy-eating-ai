import type { Server } from "node:http";
import type { Pool } from "pg";
import { logger } from "./logging/logger.js";

const FORCE_EXIT_AFTER_MS = 10_000;

/**
 * On SIGTERM (container/platform stop) or SIGINT (Ctrl+C): stop accepting new
 * connections, let in-flight requests finish, close the DB pool, then exit 0.
 * A hard timeout guarantees the process still exits if something hangs, and a
 * second signal forces an immediate exit.
 */
export function registerGracefulShutdown(server: Server, pool: Pool): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      logger.warn({ event: "shutdown_repeated_signal", signal }, "signal received again - exiting immediately");
      process.exit(1);
    }
    shuttingDown = true;
    logger.info({ event: "shutdown_started", signal }, "closing HTTP server and database pool");

    const forceTimer = setTimeout(() => {
      logger.error({ event: "shutdown_forced", timeoutMs: FORCE_EXIT_AFTER_MS }, "shutdown did not finish in time - forcing exit");
      process.exit(1);
    }, FORCE_EXIT_AFTER_MS);
    forceTimer.unref();

    server.close(async (serverError) => {
      try {
        await pool.end();
      } catch (poolError) {
        logger.error({ event: "shutdown_error", component: "database_pool", err: poolError }, "error while closing the database pool");
        process.exit(1);
      }
      if (serverError) {
        logger.error({ event: "shutdown_error", component: "http_server", err: serverError }, "error while closing the HTTP server");
        process.exit(1);
      }
      logger.info({ event: "shutdown_completed" }, "clean exit");
      process.exit(0);
    });
    // Idle keep-alive connections would otherwise hold server.close() open.
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
