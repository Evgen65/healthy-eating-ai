import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { getTodayRecommendations } from "../services/recommendationService.js";

export const recommendationRouter = Router();

recommendationRouter.get(
  "/api/me/recommendations/today",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getTodayRecommendations(req.user!.id);
      if (result.kind === "success") {
        res.status(200).json(result.response);
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
