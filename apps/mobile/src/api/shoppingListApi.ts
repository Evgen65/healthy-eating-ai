import type { WeeklyShoppingList } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

export type WeeklyShoppingListResult =
  | { kind: "found"; shoppingList: WeeklyShoppingList }
  | { kind: "target_not_found" }
  | { kind: "invalid_date" }
  | { kind: "network_error" }
  | { kind: "error" };

/**
 * `startDate` is a YYYY-MM-DD sent verbatim - the backend builds the list
 * from that week's plan (aggregation, ordering), exactly as for the Web
 * Shopping page. Mobile never aggregates ingredients itself.
 */
export async function getWeeklyShoppingList(startDate: string): Promise<WeeklyShoppingListResult> {
  const result = await apiRequest(`/api/me/shopping-list/weekly?startDate=${encodeURIComponent(startDate)}`);
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "found", shoppingList: result.body as WeeklyShoppingList };
  }
  if (result.status === 400) {
    return { kind: "invalid_date" };
  }
  if (result.status === 404) {
    return { kind: "target_not_found" };
  }
  return { kind: "error" };
}
