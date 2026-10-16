import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { historyQuerySchema } from "../schemas/historySchema.js";
import { getDailyHistory } from "../services/historyService.js";

export const historyRouter = Router();

historyRouter.get("/api/me/history/daily", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const query = historyQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  try {
    const result = await getDailyHistory(req.user!.id, query.data.date);
    if (result.kind === "success") {
      res.status(200).json(result.history);
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
