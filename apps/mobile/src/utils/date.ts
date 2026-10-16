/**
 * Date helpers shared by Meals and History. They follow the Web app's
 * existing semantics exactly, so both clients agree on every value:
 *
 * - A meal's eatenAt is entered as a LOCAL date + time and sent as a UTC
 *   ISO instant (Web: `new Date(datetimeLocal).toISOString()`).
 * - History's default date is the device's LOCAL calendar date, and the
 *   selected YYYY-MM-DD is sent to the backend verbatim; the backend then
 *   interprets it as a UTC calendar day (see apps/api/src/calculators/
 *   dayRangeCalculator.ts). This is the project's known UTC-day limitation
 *   - it is deliberately not "fixed" on Mobile alone.
 * - Moving between History dates is pure calendar arithmetic on the
 *   YYYY-MM-DD string (via UTC), so no device-timezone conversion can ever
 *   shift the selected date to the previous/next day.
 */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local calendar date as YYYY-MM-DD - built from local getters, never toISOString() (which would give the UTC date). */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** An existing calendar date (rejects e.g. 2026-02-30), same rule as the backend's historySchema. */
export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Shifts a valid YYYY-MM-DD by whole days using UTC arithmetic - timezone/DST can never skip or repeat a date. */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Combines a local YYYY-MM-DD + HH:MM into a UTC ISO instant, or null if either part is not a real date/time. */
export function localDateTimeToIso(dateValue: string, timeValue: string): string | null {
  const dateMatch = DATE_PATTERN.exec(dateValue.trim());
  const timeMatch = TIME_PATTERN.exec(timeValue.trim());
  if (!dateMatch || !timeMatch || !isValidDateString(dateValue.trim())) {
    return null;
  }
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  const local = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

/** A stored UTC instant shown in the device's local time as "YYYY-MM-DD HH:MM" (no Intl dependency). */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return `${formatLocalDate(date)} ${formatLocalTime(date)}`;
}
