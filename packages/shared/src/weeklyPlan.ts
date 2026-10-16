import type { MealType } from "./meal.js";

export interface PlannedNutrition {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface PlannedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface PlannedMeal {
  mealType: MealType;
  recipeId: string;
  title: string;
  ingredients: PlannedIngredient[];
  plannedNutrition: PlannedNutrition;
}

export interface WeeklyPlanDay {
  date: string;
  meals: PlannedMeal[];
  plannedTotals: PlannedNutrition;
  differenceFromTarget: PlannedNutrition;
}

export interface WeeklyMealPlan {
  startDate: string;
  endDate: string;
  planVersion: string;
  dailyTarget: PlannedNutrition;
  days: WeeklyPlanDay[];
  notice: string;
}
