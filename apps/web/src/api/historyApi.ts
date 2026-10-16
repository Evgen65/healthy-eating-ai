import type { DailyHistory } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type GetDailyHistoryResult =
  | { kind: "found"; history: DailyHistory }
  | { kind: "target_not_found" }
  | { kind: "invalid_date" }
  | { kind: "error" };

/**
 * `date` must already be a well-formed YYYY-MM-DD (the native date input
 * guarantees this) - the Backend is the sole authority on validating and
 * aggregating it, this just forwards it and interprets the response.
 */
export async function getDailyHistory(date: string): Promise<GetDailyHistoryResult> {
  try {
    const response = await apiFetch(`/api/me/history/daily?date=${encodeURIComponent(date)}`);

    if (response.status === 200) {
      return { kind: "found", history: (await response.json()) as DailyHistory };
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
