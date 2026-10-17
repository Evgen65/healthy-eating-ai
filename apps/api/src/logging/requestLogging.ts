import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger as rootLogger, type Logger } from "./logger.js";
import { runWithLogger } from "./requestContext.js";

export const REQUEST_ID_HEADER = "X-Request-Id";

const HEALTH_PATHS = new Set(["/health", "/health/db"]);

/**
 * The matched route pattern (e.g. /api/me/meals/:id) - never the raw URL,
 * which can contain ids, query strings or tokens. Requests that matched no
 * route (404s, body-parse failures, CORS preflights) are reported as
 * "unmatched" so arbitrary client-supplied paths do not end up in logs.
 */
export function normalizedPath(req: Request): string {
  const routePath = req.route?.path;
  return typeof routePath === "string" ? `${req.baseUrl}${routePath}` : "unmatched";
}

/**
 * Assigns every request a server-generated requestId (any client-supplied
 * X-Request-Id is deliberately ignored), returns it as X-Request-Id,
 * exposes a request-scoped logger as `req.log`, and logs one
 * `http_request_completed` event per request. The requestId is a
 * correlation label only - it is never used for authentication or
 * authorization. Request/response bodies and headers are never logged.
 */
export function createRequestLogging(baseLogger: Logger = rootLogger) {
  return function requestLogging(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const requestId = randomUUID();
    req.requestId = requestId;
    req.log = baseLogger.child({ requestId });
    res.setHeader(REQUEST_ID_HEADER, requestId);

    let finished = false;
    res.on("finish", () => {
      finished = true;
      const path = normalizedPath(req);
      const status = res.statusCode;
      const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e4) / 100;
      // Liveness/readiness probes poll constantly: keep successful ones at debug.
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : HEALTH_PATHS.has(path) ? "debug" : "info";
      req.log[level]({ event: "http_request_completed", method: req.method, path, status, durationMs });
    });
    res.on("close", () => {
      if (!finished) {
        req.log.warn({ event: "http_request_aborted", method: req.method, path: normalizedPath(req) });
      }
    });

    runWithLogger(req.log, next);
  };
}
