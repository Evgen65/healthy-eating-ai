import { addDays, formatLocalDate } from "./date";

/**
 * Week helpers for Plan and Shopping. Same startDate semantics as the Web
 * PlanPage/ShoppingPage: the default week starts on the Monday of the
 * device's LOCAL calendar week, and the YYYY-MM-DD is sent to the backend
 * verbatim. Moving between weeks is string-based calendar arithmetic
 * (addDays, via UTC), so no timezone conversion can turn 2026-10-12 into
 * 2026-10-11. Nothing here decides plan content - that stays on the backend.
 */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Monday of the local calendar week containing `date` - mirrors Web's getMondayOfCurrentWeek. */
export function getCurrentWeekStart(date: Date = new Date()): string {
  const weekday = date.getDay(); // 0 (Sun) - 6 (Sat)
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  return addDays(formatLocalDate(date), offsetToMonday);
}

export function shiftWeek(startDate: string, weeks: number): string {
  return addDays(startDate, weeks * 7);
}

/** Display-only weekday name for a backend-returned YYYY-MM-DD (read as a calendar date, no device timezone involved). */
export function getWeekdayLabel(isoDate: string): string {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()];
}
