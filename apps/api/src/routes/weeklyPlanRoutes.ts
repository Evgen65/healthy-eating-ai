import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { weeklyPlanQuerySchema } from "../schemas/weeklyPlanSchema.js";
import { getWeeklyPlan } from "../services/weeklyPlanService.js";

export const weeklyPlanRouter = Router();

weeklyPlanRouter.get("/api/me/plan/weekly", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const query = weeklyPlanQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid start date" });
    return;
  }

  try {
    const result = await getWeeklyPlan(req.user!.id, query.data.startDate);
    if (result.kind === "success") {
      res.status(200).json(result.plan);
      return;
    }
    if (result.kind === "user_not_found") {
      // Structurally unreachable in normal operation - see profileRoutes.ts.
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(404).json({ error: "Nutrition target not found" });
  } catch (error) {
    next(error);
  }
});
