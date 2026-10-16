import type { Meal } from "./meal.js";
import { roundToOneDecimal } from "./mealTotals.js";

export interface NutritionSummaryValues {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface NutritionSummary {
  date: string;
  target: NutritionSummaryValues;
  consumed: NutritionSummaryValues;
  remaining: NutritionSummaryValues;
}

export interface DailyHistory extends NutritionSummary {
  meals: Meal[];
}

/**
 * Same precision rule as calculateMealTotals: calories are whole numbers,
 * grams have at most one decimal place. Values stay numbers (never
 * strings) - this only strips floating-point artifacts such as
 * 70 - 40.3 = 29.700000000000003.
 */
export function normalizeNutritionValues(values: NutritionSummaryValues): NutritionSummaryValues {
  return {
    calories: Math.round(values.calories),
    proteinG: roundToOneDecimal(values.proteinG),
    fatG: roundToOneDecimal(values.fatG),
    carbsG: roundToOneDecimal(values.carbsG),
  };
}

/**
 * The single authoritative place remaining = target - consumed is
 * derived, for every endpoint that returns a NutritionSummary
 * (/nutrition/today, /history/daily, and recommendations built from it).
 * Every part of the result is normalized, so no client ever receives a
 * value like 29.700000000000003 and no client needs to re-round it.
 */
export function buildNutritionSummary(
  date: string,
  target: NutritionSummaryValues,
  consumed: NutritionSummaryValues,
): NutritionSummary {
  return {
    date,
    target: normalizeNutritionValues(target),
    consumed: normalizeNutritionValues(consumed),
    remaining: normalizeNutritionValues({
      calories: target.calories - consumed.calories,
      proteinG: target.proteinG - consumed.proteinG,
      fatG: target.fatG - consumed.fatG,
      carbsG: target.carbsG - consumed.carbsG,
    }),
  };
}
