import { Router, type NextFunction, type Request, type Response } from "express";
import { normalizedPath } from "../logging/requestLogging.js";
import type { Metrics } from "./metrics.js";

const KNOWN_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/**
 * Counts every completed request and records its duration. The route label
 * is the same normalized template used by the request log (e.g.
 * /api/me/meals/:id, or "unmatched") - never the raw URL, query string or
 * an id. Unusual HTTP methods collapse to "OTHER" to keep cardinality bounded.
 */
export function createHttpMetrics(metrics: Metrics) {
  return function httpMetrics(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const method = KNOWN_METHODS.has(req.method) ? req.method : "OTHER";
      const route = normalizedPath(req);
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      metrics.httpRequestsTotal.inc({ method, route, status: String(res.statusCode) });
      metrics.httpRequestDurationSeconds.observe({ method, route }, seconds);
    });
    next();
  };
}

/**
 * GET /metrics in the Prometheus text exposition format. When disabled it
 * falls through to the normal 404, exposing nothing. Unauthenticated by
 * design (Prometheus scrapers): restrict it at the network level.
 */
export function createMetricsRouter(metrics: Metrics, isEnabled: () => boolean): Router {
  const router = Router();
  router.get("/metrics", async (_req: Request, res: Response, next: NextFunction) => {
    if (!isEnabled()) {
      next();
      return;
    }
    try {
      const body = await metrics.registry.metrics();
      // setHeader (not res.set) keeps the library content type verbatim, without Express appending a charset.
      res.setHeader("Content-Type", metrics.registry.contentType);
      res.status(200).end(body);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
