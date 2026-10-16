import type { DailyRecommendationsResponse } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type GetTodayRecommendationsResult =
  | { kind: "found"; recommendations: DailyRecommendationsResponse }
  | { kind: "target_not_found" }
  | { kind: "error" };

export async function getTodayRecommendations(): Promise<GetTodayRecommendationsResult> {
  try {
    const response = await apiFetch("/api/me/recommendations/today");

    if (response.status === 200) {
      return { kind: "found", recommendations: (await response.json()) as DailyRecommendationsResponse };
    }

    if (response.status === 404) {
      return { kind: "target_not_found" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
