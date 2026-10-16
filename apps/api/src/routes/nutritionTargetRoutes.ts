import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import {
  calculateAndPersistNutritionTarget,
  getNutritionTarget,
  type NutritionTargetServiceResult,
} from "../services/nutritionTargetService.js";

export const nutritionTargetRouter = Router();

function sendResult(result: NutritionTargetServiceResult, res: Response, successStatus: number): void {
  switch (result.kind) {
    case "success":
      res.status(successStatus).json(result.target);
      return;
    case "user_not_found":
      // Structurally unreachable in normal operation - see profileRoutes.ts.
      res.status(404).json({ error: "User not found" });
      return;
    case "profile_not_found":
      res.status(404).json({ error: "Profile not found" });
      return;
    case "target_not_found":
      res.status(404).json({ error: "Nutrition target not found" });
      return;
    case "invalid_calculation":
      res.status(422).json({ error: "Calculated nutrition target is invalid" });
      return;
  }
}

nutritionTargetRouter.post(
  "/api/me/nutrition-target/calculate",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await calculateAndPersistNutritionTarget(req.user!.id);
      sendResult(result, res, 200);
    } catch (error) {
      next(error);
    }
  },
);

nutritionTargetRouter.get(
  "/api/me/nutrition-target",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getNutritionTarget(req.user!.id);
      sendResult(result, res, 200);
    } catch (error) {
      next(error);
    }
  },
);
