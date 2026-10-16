import type { Meal, MealWithItems } from "@healthy-eating-ai/shared";
import { calculateMealTotals } from "../calculators/mealTotalsCalculator.js";
import {
  deleteMealById,
  findMealById,
  findMealsByUserId,
  insertMealWithItems,
  updateMealWithItems,
} from "../repositories/mealRepository.js";
import { userExists } from "../repositories/userRepository.js";
import type { MealInput } from "../schemas/mealSchema.js";

export type CreateMealResult = { kind: "success"; meal: MealWithItems } | { kind: "user_not_found" };

export type ListMealsResult = { kind: "success"; meals: Meal[] } | { kind: "user_not_found" };

export type GetMealResult =
  | { kind: "success"; meal: MealWithItems }
  | { kind: "user_not_found" }
  | { kind: "meal_not_found" };

export type ReplaceMealResult =
  | { kind: "success"; meal: MealWithItems }
  | { kind: "user_not_found" }
  | { kind: "meal_not_found" };

export type DeleteMealResult = { kind: "success" } | { kind: "user_not_found" } | { kind: "meal_not_found" };

export async function createMeal(userId: string, input: MealInput): Promise<CreateMealResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const totals = calculateMealTotals(input.items);
  const meal = await insertMealWithItems(userId, input, totals);
  return { kind: "success", meal };
}

export async function listMeals(userId: string): Promise<ListMealsResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const meals = await findMealsByUserId(userId);
  return { kind: "success", meals };
}

export async function getMeal(userId: string, mealId: string): Promise<GetMealResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const meal = await findMealById(userId, mealId);
  if (!meal) {
    return { kind: "meal_not_found" };
  }

  return { kind: "success", meal };
}

export async function replaceMeal(userId: string, mealId: string, input: MealInput): Promise<ReplaceMealResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const totals = calculateMealTotals(input.items);
  const meal = await updateMealWithItems(userId, mealId, input, totals);
  if (!meal) {
    return { kind: "meal_not_found" };
  }

  return { kind: "success", meal };
}

export async function deleteMeal(userId: string, mealId: string): Promise<DeleteMealResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const deleted = await deleteMealById(userId, mealId);
  if (!deleted) {
    return { kind: "meal_not_found" };
  }

  return { kind: "success" };
}
