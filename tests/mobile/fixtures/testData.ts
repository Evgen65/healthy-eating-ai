import type { MealItemSeed, ProfileInput } from "../helpers/testApi";

/**
 * Fixed, deterministic data for the Mobile suite. PROFILE is the same
 * CALC-01 profile the API suite already verifies (tests/api/
 * nutritionTarget.api.spec.ts, dailyNutrition.api.spec.ts): the backend
 * calculates a 2378 kcal / 153 P / 68 F / 289 C target for it. The Mobile
 * suite does not re-verify that formula - it only uses the stable result.
 */
export const PROFILE: ProfileInput = {
  age: 35,
  sex: "male",
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
  jobType: "desk",
  workoutsPerWeek: 3,
  goal: "weight_loss",
};

/** Values typed through the Mobile Profile form (deliberately different from PROFILE). */
export const UI_PROFILE = {
  age: "29",
  sex: "female",
  heightCm: "168",
  weightKg: "61.5",
  activityLevel: "light",
  jobType: "mixed",
  workoutsPerWeek: "2",
  goal: "maintain",
} as const;

/** One recognizable item; whole numbers so the backend's stored totals are exact. */
export const MEAL_ITEM: MealItemSeed = {
  name: "Mobile QA Oatmeal",
  quantityG: 250,
  calories: 410,
  proteinG: 14,
  fatG: 9,
  carbsG: 68,
};

/** Today's calendar date as the backend counts it (UTC day - the project's known limitation). */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
