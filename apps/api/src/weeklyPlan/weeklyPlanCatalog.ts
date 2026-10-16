import type { MealType, PlannedIngredient, PlannedNutrition } from "@healthy-eating-ai/shared";

/**
 * Static deterministic recipe template. Nutrition values are simple
 * deterministic planning data for portion scaling (see weeklyPlanEngine.ts),
 * not laboratory-precise measurements.
 */
export interface RecipeTemplate {
  id: string;
  mealType: MealType;
  title: string;
  baseIngredients: PlannedIngredient[];
  baseNutrition: PlannedNutrition;
}

const breakfastTemplates: RecipeTemplate[] = [
  {
    id: "oatmeal-yogurt-berries",
    mealType: "breakfast",
    title: "Oatmeal with yogurt and berries",
    baseIngredients: [
      { name: "Oats", quantity: 80, unit: "g" },
      { name: "Greek yogurt", quantity: 150, unit: "g" },
      { name: "Mixed berries", quantity: 100, unit: "g" },
    ],
    baseNutrition: { calories: 480, proteinG: 28, fatG: 12, carbsG: 65 },
  },
  {
    id: "eggs-toast-vegetables",
    mealType: "breakfast",
    title: "Eggs with whole-grain toast and vegetables",
    baseIngredients: [
      { name: "Eggs", quantity: 2, unit: "pcs" },
      { name: "Whole-grain bread", quantity: 60, unit: "g" },
      { name: "Mixed vegetables", quantity: 100, unit: "g" },
      { name: "Olive oil", quantity: 5, unit: "g" },
    ],
    baseNutrition: { calories: 420, proteinG: 24, fatG: 22, carbsG: 32 },
  },
];

const lunchTemplates: RecipeTemplate[] = [
  {
    id: "chicken-rice-vegetables",
    mealType: "lunch",
    title: "Chicken with rice and vegetables",
    baseIngredients: [
      { name: "Chicken breast", quantity: 150, unit: "g" },
      { name: "Rice", quantity: 180, unit: "g" },
      { name: "Mixed vegetables", quantity: 150, unit: "g" },
      { name: "Olive oil", quantity: 10, unit: "g" },
    ],
    baseNutrition: { calories: 650, proteinG: 45, fatG: 15, carbsG: 80 },
  },
  {
    id: "turkey-potatoes-salad",
    mealType: "lunch",
    title: "Turkey with potatoes and salad",
    baseIngredients: [
      { name: "Turkey breast", quantity: 150, unit: "g" },
      { name: "Potatoes", quantity: 200, unit: "g" },
      { name: "Salad greens", quantity: 100, unit: "g" },
      { name: "Olive oil", quantity: 10, unit: "g" },
    ],
    baseNutrition: { calories: 600, proteinG: 42, fatG: 14, carbsG: 70 },
  },
];

const dinnerTemplates: RecipeTemplate[] = [
  {
    id: "fish-potatoes-vegetables",
    mealType: "dinner",
    title: "Fish with potatoes and vegetables",
    baseIngredients: [
      { name: "White fish fillet", quantity: 180, unit: "g" },
      { name: "Potatoes", quantity: 200, unit: "g" },
      { name: "Mixed vegetables", quantity: 150, unit: "g" },
      { name: "Olive oil", quantity: 10, unit: "g" },
    ],
    baseNutrition: { calories: 580, proteinG: 40, fatG: 16, carbsG: 65 },
  },
  {
    id: "chicken-couscous-salad",
    mealType: "dinner",
    title: "Chicken with couscous and salad",
    baseIngredients: [
      { name: "Chicken breast", quantity: 150, unit: "g" },
      { name: "Couscous", quantity: 150, unit: "g" },
      { name: "Salad greens", quantity: 100, unit: "g" },
      { name: "Olive oil", quantity: 10, unit: "g" },
    ],
    baseNutrition: { calories: 610, proteinG: 43, fatG: 15, carbsG: 70 },
  },
];

const snackTemplates: RecipeTemplate[] = [
  {
    id: "yogurt-fruit",
    mealType: "snack",
    title: "Greek yogurt with fruit",
    baseIngredients: [
      { name: "Greek yogurt", quantity: 170, unit: "g" },
      { name: "Mixed fruit", quantity: 100, unit: "g" },
    ],
    baseNutrition: { calories: 200, proteinG: 15, fatG: 4, carbsG: 28 },
  },
  {
    id: "cottage-cheese-fruit",
    mealType: "snack",
    title: "Cottage cheese with fruit",
    baseIngredients: [
      { name: "Cottage cheese", quantity: 150, unit: "g" },
      { name: "Mixed fruit", quantity: 100, unit: "g" },
    ],
    baseNutrition: { calories: 190, proteinG: 18, fatG: 3, carbsG: 22 },
  },
];

export const RECIPE_CATALOG: Record<MealType, RecipeTemplate[]> = {
  breakfast: breakfastTemplates,
  lunch: lunchTemplates,
  dinner: dinnerTemplates,
  snack: snackTemplates,
};

/** Stable per-day meal order for the response contract. */
export const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * Stable meal calorie allocation percentages (must sum to 1). Used by the
 * engine to derive each meal slot's calorie target from the user's daily
 * calorie target before recipe portion scaling.
 */
export const MEAL_CALORIE_ALLOCATION: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};
