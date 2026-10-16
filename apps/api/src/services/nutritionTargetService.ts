import type { NutritionTarget } from "@healthy-eating-ai/shared";
import { calculateNutritionTarget } from "../calculators/nutritionCalculator.js";
import { findNutritionTargetByUserId, upsertNutritionTarget } from "../repositories/nutritionTargetRepository.js";
import { findProfileByUserId } from "../repositories/profileRepository.js";
import { userExists } from "../repositories/userRepository.js";

export type NutritionTargetServiceResult =
  | { kind: "success"; target: NutritionTarget }
  | { kind: "user_not_found" }
  | { kind: "profile_not_found" }
  | { kind: "target_not_found" }
  | { kind: "invalid_calculation" };

export async function calculateAndPersistNutritionTarget(userId: string): Promise<NutritionTargetServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const profile = await findProfileByUserId(userId);
  if (!profile) {
    return { kind: "profile_not_found" };
  }

  const calculation = calculateNutritionTarget({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
  });

  if (calculation.kind === "negative_carbs") {
    return { kind: "invalid_calculation" };
  }

  const target = await upsertNutritionTarget(userId, calculation.result);
  return { kind: "success", target };
}

export async function getNutritionTarget(userId: string): Promise<NutritionTargetServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const target = await findNutritionTargetByUserId(userId);
  if (!target) {
    return { kind: "target_not_found" };
  }

  return { kind: "success", target };
}
