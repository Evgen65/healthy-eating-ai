import type { NutritionTarget } from "@healthy-eating-ai/shared";
import { pool } from "../db/pool.js";
import type { NutritionCalculationOutput } from "../calculators/nutritionCalculator.js";

interface NutritionTargetRow {
  user_id: string;
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  formula_version: string;
  created_at: Date;
  updated_at: Date;
}

function mapRowToNutritionTarget(row: NutritionTargetRow): NutritionTarget {
  return {
    userId: row.user_id,
    bmr: row.bmr,
    tdee: row.tdee,
    calorieTarget: row.calorie_target,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    formulaVersion: row.formula_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findNutritionTargetByUserId(userId: string): Promise<NutritionTarget | null> {
  const result = await pool.query<NutritionTargetRow>("SELECT * FROM nutrition_targets WHERE user_id = $1", [
    userId,
  ]);
  const row = result.rows[0];
  return row ? mapRowToNutritionTarget(row) : null;
}

/**
 * Inserts a new nutrition target, or updates the existing one for this
 * user - the unique constraint on user_id guarantees at most one row per
 * user, so recalculation never creates a duplicate.
 */
export async function upsertNutritionTarget(
  userId: string,
  calculation: NutritionCalculationOutput,
): Promise<NutritionTarget> {
  const result = await pool.query<NutritionTargetRow>(
    `INSERT INTO nutrition_targets
       (user_id, bmr, tdee, calorie_target, protein_g, fat_g, carbs_g, formula_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE
       SET bmr = EXCLUDED.bmr,
           tdee = EXCLUDED.tdee,
           calorie_target = EXCLUDED.calorie_target,
           protein_g = EXCLUDED.protein_g,
           fat_g = EXCLUDED.fat_g,
           carbs_g = EXCLUDED.carbs_g,
           formula_version = EXCLUDED.formula_version,
           updated_at = now()
     RETURNING *`,
    [
      userId,
      calculation.bmr,
      calculation.tdee,
      calculation.calorieTarget,
      calculation.proteinG,
      calculation.fatG,
      calculation.carbsG,
      calculation.formulaVersion,
    ],
  );
  return mapRowToNutritionTarget(result.rows[0]);
}
