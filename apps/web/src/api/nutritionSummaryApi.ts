import type { NutritionSummary } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type GetTodayNutritionResult =
  | { kind: "found"; summary: NutritionSummary }
  | { kind: "target_not_found" }
  | { kind: "error" };

export async function getTodayNutrition(): Promise<GetTodayNutritionResult> {
  try {
    const response = await apiFetch("/api/me/nutrition/today");

    if (response.status === 200) {
      return { kind: "found", summary: (await response.json()) as NutritionSummary };
    }

    if (response.status === 404) {
      return { kind: "target_not_found" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
