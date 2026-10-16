import type { Meal, MealItem, MealType, MealWithItems } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

/**
 * The existing /api/me/meals contract (see apps/api/src/schemas/
 * mealSchema.ts and apps/web/src/api/mealApi.ts). Meal totals are always
 * calculated and stored by the backend from the items - the app never
 * sends totals of its own.
 */
export type MealItemCreateInput = Omit<MealItem, "id" | "quantityG"> & { quantityG?: number };

export interface MealCreateInput {
  mealType: MealType;
  /** UTC ISO instant. */
  eatenAt: string;
  items: MealItemCreateInput[];
}

export type GetMealsResult = { kind: "success"; meals: Meal[] } | { kind: "network_error" } | { kind: "error" };

export type GetMealResult = { kind: "success"; meal: MealWithItems } | { kind: "network_error" } | { kind: "error" };

export type CreateMealResult =
  | { kind: "success"; meal: MealWithItems }
  | { kind: "invalid" }
  | { kind: "network_error" }
  | { kind: "error" };

/** Newest first (the backend already orders by eaten_at DESC). Totals only - items are loaded per meal on demand. */
export async function getMeals(): Promise<GetMealsResult> {
  const result = await apiRequest("/api/me/meals");
  if (result.kind === "network_error") {
    return result;
  }
  return result.status === 200 && Array.isArray(result.body)
    ? { kind: "success", meals: result.body as Meal[] }
    : { kind: "error" };
}

export async function getMeal(mealId: string): Promise<GetMealResult> {
  const result = await apiRequest(`/api/me/meals/${encodeURIComponent(mealId)}`);
  if (result.kind === "network_error") {
    return result;
  }
  return result.status === 200 ? { kind: "success", meal: result.body as MealWithItems } : { kind: "error" };
}

export async function createMeal(input: MealCreateInput): Promise<CreateMealResult> {
  const result = await apiRequest("/api/me/meals", { method: "POST", body: input });
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 201) {
    return { kind: "success", meal: result.body as MealWithItems };
  }
  if (result.status === 400) {
    return { kind: "invalid" };
  }
  return { kind: "error" };
}
