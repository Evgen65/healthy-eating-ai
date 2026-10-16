import type { WeeklyMealPlan } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type GetWeeklyPlanResult =
  | { kind: "found"; plan: WeeklyMealPlan }
  | { kind: "target_not_found" }
  | { kind: "invalid_date" }
  | { kind: "error" };

/**
 * `startDate` must already be a well-formed YYYY-MM-DD (the native date
 * input guarantees this) - the Backend is the sole authority on validating
 * it and generating the plan, this just forwards it and interprets the
 * response.
 */
export async function getWeeklyPlan(startDate: string): Promise<GetWeeklyPlanResult> {
  try {
    const response = await apiFetch(`/api/me/plan/weekly?startDate=${encodeURIComponent(startDate)}`);

    if (response.status === 200) {
      return { kind: "found", plan: (await response.json()) as WeeklyMealPlan };
    }

    if (response.status === 400) {
      return { kind: "invalid_date" };
    }

    if (response.status === 404) {
      return { kind: "target_not_found" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
