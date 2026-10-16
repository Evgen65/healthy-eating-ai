import type { NutritionSummary } from "./nutritionSummary.js";

export type RecommendationLevel = "info" | "warning";

/**
 * A single deterministic, numeric-state observation (e.g. "153 g of
 * protein remaining") - never a food suggestion or medical claim. `code` is
 * a stable machine-readable identifier a future Web UI/automation can key
 * off of; `message` is the human-readable rendering of the same fact.
 */
export interface NutritionRecommendation {
  code: string;
  level: RecommendationLevel;
  message: string;
}

export interface DailyRecommendationsResponse {
  date: string;
  summary: NutritionSummary;
  recommendations: NutritionRecommendation[];
}
