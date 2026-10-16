import { z } from "zod";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Same strict real-calendar validation as historySchema.ts's
 * isValidCalendarDate - rejects dates that don't exist (e.g. 2026-02-30)
 * rather than letting Date.UTC() silently roll them into the next
 * day/month.
 */
function isValidCalendarDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const weeklyPlanQuerySchema = z.object({
  startDate: z.string().refine(isValidCalendarDate, { message: "Invalid start date" }),
});
