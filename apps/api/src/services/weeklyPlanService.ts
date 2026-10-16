import type { WeeklyMealPlan } from "@healthy-eating-ai/shared";
import { findNutritionTargetByUserId } from "../repositories/nutritionTargetRepository.js";
import { userExists } from "../repositories/userRepository.js";
import { generateWeeklyPlan } from "../weeklyPlan/weeklyPlanEngine.js";

export type WeeklyPlanServiceResult =
  | { kind: "success"; plan: WeeklyMealPlan }
  | { kind: "user_not_found" }
  | { kind: "target_not_found" };

/**
 * Looks up the user's already-stored nutrition target (never recalculates
 * it - see nutritionTargetService.ts for that) and hands it to the pure
 * weekly plan engine. Read-only: nothing here writes to meals, meal_items
 * or nutrition_targets.
 */
export async function getWeeklyPlan(userId: string, startDate: string): Promise<WeeklyPlanServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const target = await findNutritionTargetByUserId(userId);
  if (!target) {
    return { kind: "target_not_found" };
  }

  const dailyTarget = {
    calories: target.calorieTarget,
    proteinG: target.proteinG,
    fatG: target.fatG,
    carbsG: target.carbsG,
  };

  return { kind: "success", plan: generateWeeklyPlan(startDate, dailyTarget) };
}
