import type { Meal, MealType, MealWithItems } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export interface MealItemCreateInput {
  name: string;
  quantityG?: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealCreateInput {
  mealType: MealType;
  eatenAt: string;
  items: MealItemCreateInput[];
}

export type GetMealsResult = { kind: "success"; meals: Meal[] } | { kind: "error" };

export async function getMeals(): Promise<GetMealsResult> {
  try {
    const response = await apiFetch("/api/me/meals");

    if (response.status === 200) {
      return { kind: "success", meals: (await response.json()) as Meal[] };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export type CreateMealResult =
  | { kind: "success"; meal: MealWithItems }
  | { kind: "invalid"; message: string }
  | { kind: "error" };

export async function createMeal(input: MealCreateInput): Promise<CreateMealResult> {
  try {
    const response = await apiFetch("/api/me/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.status === 201) {
      return { kind: "success", meal: (await response.json()) as MealWithItems };
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      return { kind: "invalid", message: body?.error ?? "Invalid meal data" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
