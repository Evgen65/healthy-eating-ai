/**
 * Meal totals are always derived from items on the Backend - the client
 * must never be trusted to supply authoritative totals. The calculation
 * (including normalization of floating-point artifacts) lives in the
 * shared package so the Frontend can preview the same totals before a meal
 * is persisted, without duplicating the rounding logic.
 */
export { calculateMealTotals, type MealItemNutrition, type MealTotals } from "@healthy-eating-ai/shared";
