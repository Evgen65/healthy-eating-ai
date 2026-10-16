import type { WeeklyMealPlan } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

export type WeeklyPlanResult =
  | { kind: "found"; plan: WeeklyMealPlan }
  | { kind: "target_not_found" }
  | { kind: "invalid_date" }
  | { kind: "network_error" }
  | { kind: "error" };

/**
 * `startDate` is a YYYY-MM-DD sent verbatim - the backend validates it and
 * generates the (deterministic) plan, exactly as for the Web Plan page.
 */
export async function getWeeklyPlan(startDate: string): Promise<WeeklyPlanResult> {
  const result = await apiRequest(`/api/me/plan/weekly?startDate=${encodeURIComponent(startDate)}`);
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "found", plan: result.body as WeeklyMealPlan };
  }
  if (result.status === 400) {
    return { kind: "invalid_date" };
  }
  if (result.status === 404) {
    return { kind: "target_not_found" };
  }
  return { kind: "error" };
}
