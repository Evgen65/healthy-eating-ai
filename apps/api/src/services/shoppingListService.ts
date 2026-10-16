import type { WeeklyShoppingList } from "@healthy-eating-ai/shared";
import { buildWeeklyShoppingList } from "../shoppingList/shoppingListAggregator.js";
import { getWeeklyPlan } from "./weeklyPlanService.js";

export type ShoppingListServiceResult =
  | { kind: "success"; shoppingList: WeeklyShoppingList }
  | { kind: "user_not_found" }
  | { kind: "target_not_found" };

/**
 * Reuses the existing Weekly Plan service (same user/target lookup, same
 * pure deterministic engine) and aggregates its planned ingredients into a
 * shopping list. Never queries meals/meal_items and never persists
 * anything - the Weekly Plan stays the single source of truth.
 */
export async function getWeeklyShoppingList(userId: string, startDate: string): Promise<ShoppingListServiceResult> {
  const planResult = await getWeeklyPlan(userId, startDate);

  if (planResult.kind !== "success") {
    return planResult;
  }

  return { kind: "success", shoppingList: buildWeeklyShoppingList(planResult.plan) };
}
