import type { Server } from "node:http";
import type { Pool } from "pg";

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
      console.log(`[shutdown] ${signal} received again - exiting immediately.`);
      process.exit(1);
    }
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received - closing HTTP server and database pool.`);

    const forceTimer = setTimeout(() => {
      console.error(`[shutdown] did not finish within ${FORCE_EXIT_AFTER_MS}ms - forcing exit.`);
      process.exit(1);
    }, FORCE_EXIT_AFTER_MS);
    forceTimer.unref();

    server.close(async (serverError) => {
      try {
        await pool.end();
      } catch (poolError) {
        console.error("[shutdown] error while closing the database pool:", poolError instanceof Error ? poolError.message : "unknown error");
        process.exit(1);
      }
      if (serverError) {
        console.error("[shutdown] error while closing the HTTP server:", serverError.message);
        process.exit(1);
      }
      console.log("[shutdown] clean exit.");
      process.exit(0);
    });
    // Idle keep-alive connections would otherwise hold server.close() open.
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
