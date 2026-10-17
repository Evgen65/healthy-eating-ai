import { Router, type Request, type Response } from "express";
import { pool } from "../db/pool.js";
import { checkDatabaseHealth } from "../db/dbHealth.js";
import { getLogger } from "../logging/requestContext.js";
import { metrics } from "../metrics/index.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "healthy-eating-api",
  });
});

healthRouter.get("/health/db", async (_req: Request, res: Response) => {
  const result = await checkDatabaseHealth(() => pool.query("SELECT 1"), metrics);
  if (result.ok) {
    res.status(200).json({
      status: "ok",
      service: "database",
    });
  } else {
    getLogger().error({ event: "db_health_check_failed", err: result.error }, "database health check failed");
    res.status(503).json({
      status: "error",
      service: "database",
    });
  }
});
