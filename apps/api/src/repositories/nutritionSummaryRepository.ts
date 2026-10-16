import { pool } from "../db/pool.js";

export interface MealTotalsSum {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

interface SumRow {
  calories: string;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
}

/**
 * Sums meals' Backend-calculated totals - never meal_items directly - for
 * one user within [start, end). COALESCE covers the no-meals-today case,
 * where SUM() would otherwise return NULL for every column. SUM() of
 * NUMERIC/INTEGER columns comes back from pg as strings, so each value is
 * cast with Number(), matching mealRepository's convention.
 */
export async function sumMealTotalsForUserBetween(userId: string, start: Date, end: Date): Promise<MealTotalsSum> {
  const result = await pool.query<SumRow>(
    `SELECT
       COALESCE(SUM(calories), 0) AS calories,
       COALESCE(SUM(protein_g), 0) AS protein_g,
       COALESCE(SUM(fat_g), 0) AS fat_g,
       COALESCE(SUM(carbs_g), 0) AS carbs_g
     FROM meals
     WHERE user_id = $1 AND eaten_at >= $2 AND eaten_at < $3`,
    [userId, start, end],
  );
  const row = result.rows[0];
  return {
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    fatG: Number(row.fat_g),
    carbsG: Number(row.carbs_g),
  };
}
