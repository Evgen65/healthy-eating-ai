import { buildNutritionSummary, type NutritionSummary } from "@healthy-eating-ai/shared";
import { getUtcDayRange, getUtcDayRangeForDate } from "../calculators/dayRangeCalculator.js";
import { findNutritionTargetByUserId } from "../repositories/nutritionTargetRepository.js";
import { sumMealTotalsForUserBetween } from "../repositories/nutritionSummaryRepository.js";
import { userExists } from "../repositories/userRepository.js";

export type NutritionSummaryServiceResult =
  | { kind: "success"; summary: NutritionSummary }
  | { kind: "user_not_found" }
  | { kind: "target_not_found" };

/**
 * Shared by /nutrition/today (date = today's UTC calendar date) and the
 * History API (date = a caller-supplied, already-validated YYYY-MM-DD) so
 * both endpoints compute consumed/remaining the same way against the same
 * day-boundary rule.
 */
export async function getNutritionSummaryForDate(
  userId: string,
  date: string,
): Promise<NutritionSummaryServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const target = await findNutritionTargetByUserId(userId);
  if (!target) {
    return { kind: "target_not_found" };
  }

  const { start, end } = getUtcDayRangeForDate(date);
  const consumed = await sumMealTotalsForUserBetween(userId, start, end);

  // buildNutritionSummary normalizes target/consumed/remaining (whole
  // calories, grams to one decimal) - plain JS subtraction of a decimal
  // consumed value would otherwise leak artifacts like 29.700000000000003.
  return {
    kind: "success",
    summary: buildNutritionSummary(
      date,
      { calories: target.calorieTarget, proteinG: target.proteinG, fatG: target.fatG, carbsG: target.carbsG },
      consumed,
    ),
  };
}

export async function getTodayNutritionSummary(userId: string): Promise<NutritionSummaryServiceResult> {
  const { date } = getUtcDayRange();
  return getNutritionSummaryForDate(userId, date);
}
