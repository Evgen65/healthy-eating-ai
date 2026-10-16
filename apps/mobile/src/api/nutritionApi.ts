import type { NutritionSummary } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

/**
 * Today's target/consumed/remaining and the target calculation action -
 * the same endpoints the Web Dashboard uses. All numbers come from the
 * backend; Mobile never computes a target or a remaining value itself.
 */
export type TodayNutritionResult =
  | { kind: "found"; summary: NutritionSummary }
  | { kind: "target_not_found" }
  | { kind: "network_error" }
  | { kind: "error" };

export type CalculateTargetResult =
  | { kind: "success" }
  | { kind: "profile_not_found" }
  | { kind: "failed" }
  | { kind: "network_error" }
  | { kind: "error" };

export async function getTodayNutrition(): Promise<TodayNutritionResult> {
  const result = await apiRequest("/api/me/nutrition/today");
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "found", summary: result.body as NutritionSummary };
  }
  if (result.status === 404) {
    return { kind: "target_not_found" };
  }
  return { kind: "error" };
}

/** Server-side (re)calculation from the stored profile - no profile values are sent from the device. */
export async function calculateNutritionTarget(): Promise<CalculateTargetResult> {
  const result = await apiRequest("/api/me/nutrition-target/calculate", { method: "POST" });
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "success" };
  }
  if (result.status === 404) {
    const body = result.body as { error?: unknown } | null;
    return body?.error === "Profile not found" ? { kind: "profile_not_found" } : { kind: "failed" };
  }
  if (result.status === 400 || result.status === 422) {
    return { kind: "failed" };
  }
  return { kind: "error" };
}
