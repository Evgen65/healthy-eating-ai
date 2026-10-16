import { z } from "zod";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rejects calendar dates that don't actually exist (e.g. 2026-02-30,
 * 2026-13-01) rather than letting Date silently roll them over into the
 * next day/month - Date.UTC() normalizes out-of-range components instead
 * of throwing, so the round trip back to (year, month, day) is compared
 * against the input to catch that.
 */
function isValidCalendarDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const historyQuerySchema = z.object({
  date: z.string().refine(isValidCalendarDate, { message: "Invalid date" }),
});
