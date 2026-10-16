import type { DailyRecommendationsResponse } from "@healthy-eating-ai/shared";
import { getTodayNutritionSummary } from "./nutritionSummaryService.js";
import { generateDailyRecommendations } from "../recommendations/recommendationEngine.js";

export type RecommendationServiceResult =
  | { kind: "success"; response: DailyRecommendationsResponse }
  | { kind: "user_not_found" }
  | { kind: "target_not_found" };

/**
 * Composes the existing daily nutrition summary (same "today" UTC
 * day-boundary rule as GET /nutrition/today - see dayRangeCalculator.ts)
 * with the pure recommendation engine. Nothing here re-queries meals or
 * re-derives target/consumed/remaining independently.
 */
export async function getTodayRecommendations(userId: string): Promise<RecommendationServiceResult> {
  const result = await getTodayNutritionSummary(userId);
  if (result.kind !== "success") {
    return result;
  }

  return {
    kind: "success",
    response: {
      date: result.summary.date,
      summary: result.summary,
      recommendations: generateDailyRecommendations(result.summary),
    },
  };
}
