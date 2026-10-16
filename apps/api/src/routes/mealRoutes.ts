import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { mealBodySchema, mealIdParamsSchema } from "../schemas/mealSchema.js";
import { createMeal, deleteMeal, getMeal, listMeals, replaceMeal } from "../services/mealService.js";

export const mealRouter = Router();

function sendNotFound(kind: "user_not_found" | "meal_not_found", res: Response): void {
  if (kind === "user_not_found") {
    // Structurally unreachable in normal operation - see profileRoutes.ts.
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(404).json({ error: "Meal not found" });
}

mealRouter.post("/api/me/meals", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const body = mealBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid meal data" });
    return;
  }

  try {
    const result = await createMeal(req.user!.id, body.data);
    if (result.kind === "success") {
      res.status(201).json(result.meal);
      return;
    }
    sendNotFound(result.kind, res);
  } catch (error) {
    next(error);
  }
});

mealRouter.get("/api/me/meals", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listMeals(req.user!.id);
    if (result.kind === "success") {
      res.status(200).json(result.meals);
      return;
    }
    sendNotFound(result.kind, res);
  } catch (error) {
    next(error);
  }
});

mealRouter.get("/api/me/meals/:mealId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const params = mealIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  try {
    const result = await getMeal(req.user!.id, params.data.mealId);
    if (result.kind === "success") {
      res.status(200).json(result.meal);
      return;
    }
    sendNotFound(result.kind, res);
  } catch (error) {
    next(error);
  }
});

mealRouter.put("/api/me/meals/:mealId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const params = mealIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  const body = mealBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid meal data" });
    return;
  }

  try {
    const result = await replaceMeal(req.user!.id, params.data.mealId, body.data);
    if (result.kind === "success") {
      res.status(200).json(result.meal);
      return;
    }
    sendNotFound(result.kind, res);
  } catch (error) {
    next(error);
  }
});

mealRouter.delete("/api/me/meals/:mealId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const params = mealIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  try {
    const result = await deleteMeal(req.user!.id, params.data.mealId);
    if (result.kind === "success") {
      res.status(204).send();
      return;
    }
    sendNotFound(result.kind, res);
  } catch (error) {
    next(error);
  }
});
