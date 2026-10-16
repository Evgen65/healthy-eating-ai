import type { DailyHistory } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

export type DailyHistoryResult =
  | { kind: "found"; history: DailyHistory }
  | { kind: "target_not_found" }
  | { kind: "invalid_date" }
  | { kind: "network_error" }
  | { kind: "error" };

/**
 * `date` is a YYYY-MM-DD sent verbatim - the backend validates it and
 * aggregates that (UTC) calendar day, exactly as for the Web History page.
 */
export async function getDailyHistory(date: string): Promise<DailyHistoryResult> {
  const result = await apiRequest(`/api/me/history/daily?date=${encodeURIComponent(date)}`);
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "found", history: result.body as DailyHistory };
  }
  if (result.status === 400) {
    return { kind: "invalid_date" };
  }
  if (result.status === 404) {
    return { kind: "target_not_found" };
  }
  return { kind: "error" };
}
