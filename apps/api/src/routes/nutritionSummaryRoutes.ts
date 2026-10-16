import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { getTodayNutritionSummary } from "../services/nutritionSummaryService.js";

export const nutritionSummaryRouter = Router();

nutritionSummaryRouter.get(
  "/api/me/nutrition/today",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getTodayNutritionSummary(req.user!.id);
      if (result.kind === "success") {
        res.status(200).json(result.summary);
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
  },
);
