import type { DailyHistory } from "@healthy-eating-ai/shared";
import { getUtcDayRangeForDate } from "../calculators/dayRangeCalculator.js";
import { findMealsByUserIdBetween } from "../repositories/mealRepository.js";
import { getNutritionSummaryForDate } from "./nutritionSummaryService.js";

export type DailyHistoryResult =
  | { kind: "success"; history: DailyHistory }
  | { kind: "user_not_found" }
  | { kind: "target_not_found" };

/**
 * Reuses getNutritionSummaryForDate for target/consumed/remaining (same
 * user/target checks and the same day-boundary rule as /nutrition/today),
 * then adds the day's meals - summary data only, oldest first.
 */
export async function getDailyHistory(userId: string, date: string): Promise<DailyHistoryResult> {
  const summaryResult = await getNutritionSummaryForDate(userId, date);
  if (summaryResult.kind !== "success") {
    return summaryResult;
  }

  const { start, end } = getUtcDayRangeForDate(date);
  const meals = await findMealsByUserIdBetween(userId, start, end);

  return { kind: "success", history: { ...summaryResult.summary, meals } };
}
