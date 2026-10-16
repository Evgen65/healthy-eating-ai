import type { WeeklyShoppingList } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type GetWeeklyShoppingListResult =
  | { kind: "found"; shoppingList: WeeklyShoppingList }
  | { kind: "target_not_found" }
  | { kind: "invalid_date" }
  | { kind: "error" };

/**
 * `startDate` must already be a well-formed YYYY-MM-DD (the native date
 * input guarantees this) - the Backend is the sole authority on validating
 * it and generating the shopping list (via the Weekly Plan), this just
 * forwards it and interprets the response.
 */
export async function getWeeklyShoppingList(startDate: string): Promise<GetWeeklyShoppingListResult> {
  try {
    const response = await apiFetch(`/api/me/shopping-list/weekly?startDate=${encodeURIComponent(startDate)}`);

    if (response.status === 200) {
      return { kind: "found", shoppingList: (await response.json()) as WeeklyShoppingList };
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
