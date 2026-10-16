export interface MealItemNutrition {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/**
 * Summing floating-point grams (e.g. 3.5 + 0.1 + 0.2) routinely produces
 * artifacts like 3.8000000000000003 - rounding to one decimal place is
 * enough precision for a gram measurement and eliminates them.
 */
export function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function roundCalories(value: number): number {
  return Math.round(value);
}

/**
 * The single authoritative place calculated nutrition totals are produced -
 * every consumer (AI analysis, meal persistence, and any UI that previews a
 * total before persistence) must call this rather than summing items itself,
 * so rounding/normalization can never drift out of sync between them.
 *
 * Individual item values are never rounded here - only the aggregate sums,
 * since items may legitimately carry more precision (e.g. proteinG: 0.7)
 * than the totals should display.
 */
export function calculateMealTotals(items: MealItemNutrition[]): MealTotals {
  const raw = items.reduce<MealTotals>(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      proteinG: totals.proteinG + item.proteinG,
      fatG: totals.fatG + item.fatG,
      carbsG: totals.carbsG + item.carbsG,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  );

  return {
    calories: roundCalories(raw.calories),
    proteinG: roundToOneDecimal(raw.proteinG),
    fatG: roundToOneDecimal(raw.fatG),
    carbsG: roundToOneDecimal(raw.carbsG),
  };
}
