import { AsyncLocalStorage } from "node:async_hooks";
import { logger, type Logger } from "./logger.js";

const storage = new AsyncLocalStorage<Logger>();

/** Runs `fn` so that getLogger() inside it (including awaited code) returns the given request-scoped logger. */
export function runWithLogger<T>(log: Logger, fn: () => T): T {
  return storage.run(log, fn);
}

/** The request-scoped logger when called within one, otherwise the root logger. */
export function getLogger(): Logger {
  return storage.getStore() ?? logger;
}
