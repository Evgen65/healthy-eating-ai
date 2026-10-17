import { Router, type Request, type Response } from "express";
import { pool } from "../db/pool.js";
import { getLogger } from "../logging/requestContext.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "healthy-eating-api",
  });
});

healthRouter.get("/health/db", async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      service: "database",
    });
  } catch (error) {
    getLogger().error({ event: "db_health_check_failed", err: error }, "database health check failed");
    res.status(503).json({
      status: "error",
      service: "database",
    });
  }
});
