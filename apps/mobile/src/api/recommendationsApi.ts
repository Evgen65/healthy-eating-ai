import type { DailyRecommendationsResponse } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

export type TodayRecommendationsResult =
  | { kind: "found"; recommendations: DailyRecommendationsResponse }
  | { kind: "target_not_found" }
  | { kind: "network_error" }
  | { kind: "error" };

/**
 * Today's deterministic recommendations - the same endpoint the Web
 * Recommendations page uses. The backend derives them from today's
 * nutrition summary; Mobile only renders them.
 */
export async function getTodayRecommendations(): Promise<TodayRecommendationsResult> {
  const result = await apiRequest("/api/me/recommendations/today");
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "found", recommendations: result.body as DailyRecommendationsResponse };
  }
  if (result.status === 404) {
    return { kind: "target_not_found" };
  }
  return { kind: "error" };
}
