import type { ActivityLevel, NutritionGoal, Sex } from "@healthy-eating-ai/shared";

export const FORMULA_VERSION = "mifflin-st-jeor-v1";

export interface NutritionCalculationInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
}

export interface NutritionCalculationOutput {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  formulaVersion: typeof FORMULA_VERSION;
}

export type NutritionCalculationResult =
  | { kind: "success"; result: NutritionCalculationOutput }
  | { kind: "negative_carbs" };

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

// Deterministic product rules for this learning application, not
// individually tunable or AI-derived.
const GOAL_CALORIE_MULTIPLIERS: Record<NutritionGoal, number> = {
  weight_loss: 0.85,
  maintain: 1,
  muscle_gain: 1.08,
};

const PROTEIN_FACTORS_G_PER_KG: Record<NutritionGoal, number> = {
  weight_loss: 1.8,
  maintain: 1.6,
  muscle_gain: 2.0,
};

const FAT_FACTOR_G_PER_KG = 0.8;

function calculateRawBmr(input: NutritionCalculationInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

/**
 * Pure Mifflin-St Jeor calculation. No I/O: no PostgreSQL, no Express, no
 * HTTP, no external/AI services - keeps this trivially unit-testable.
 *
 * Rounding follows the exact sequence required for deterministic output:
 * bmr/tdee/calorieTarget/proteinG/fatG are each rounded from their own raw
 * value, then carbsG is derived from the already-rounded calorieTarget,
 * proteinG and fatG (not from raw intermediates).
 */
export function calculateNutritionTarget(input: NutritionCalculationInput): NutritionCalculationResult {
  const rawBmr = calculateRawBmr(input);
  const rawTdee = rawBmr * ACTIVITY_FACTORS[input.activityLevel];
  const rawCalorieTarget = rawTdee * GOAL_CALORIE_MULTIPLIERS[input.goal];

  const bmr = Math.round(rawBmr);
  const tdee = Math.round(rawTdee);
  const calorieTarget = Math.round(rawCalorieTarget);
  const proteinG = Math.round(input.weightKg * PROTEIN_FACTORS_G_PER_KG[input.goal]);
  const fatG = Math.round(input.weightKg * FAT_FACTOR_G_PER_KG);

  const proteinCalories = proteinG * 4;
  const fatCalories = fatG * 9;
  const carbsG = Math.round((calorieTarget - proteinCalories - fatCalories) / 4);

  if (carbsG < 0) {
    return { kind: "negative_carbs" };
  }

  return {
    kind: "success",
    result: { bmr, tdee, calorieTarget, proteinG, fatG, carbsG, formulaVersion: FORMULA_VERSION },
  };
}
