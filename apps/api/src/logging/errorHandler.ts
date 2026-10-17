import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger.js";

/**
 * Terminal Express error handler. Controlled responses are unchanged: a
 * malformed JSON body is a 400, anything else a generic 500 that never
 * exposes the underlying error. The real error is logged server-side with
 * the request's requestId.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const log = req.log ?? logger;
  // express.json() throws a SyntaxError for malformed request bodies -
  // report it as a 400 rather than falling through to the generic 500.
  if (err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed") {
    log.warn({ event: "invalid_request_body", method: req.method }, "malformed JSON request body");
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  log.error({ event: "unhandled_error", method: req.method, err }, "unhandled server error");
  res.status(500).json({ error: "Internal server error" });
}
