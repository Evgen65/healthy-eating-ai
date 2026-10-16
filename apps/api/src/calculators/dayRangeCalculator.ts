export interface UtcDayRange {
  /** UTC calendar date in YYYY-MM-DD form. */
  date: string;
  /** Inclusive start of the day, 00:00:00.000 UTC. */
  start: Date;
  /** Exclusive end of the day - 00:00:00.000 UTC of the next day. */
  end: Date;
}

/**
 * "Today" is defined as the current UTC calendar day - not the server's
 * local day, and not any per-user timezone, since the app has no reliable
 * per-user timezone mechanism yet. meals.eaten_at is already written as a
 * UTC instant (the Web form converts a local datetime-local value to UTC
 * via toISOString() before sending it), so anchoring "today" to UTC keeps
 * the day boundary consistent with how eaten_at is actually stored,
 * instead of silently reinterpreting those instants against local time.
 */
export function getUtcDayRange(now: Date = new Date()): UtcDayRange {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { date: start.toISOString().slice(0, 10), start, end };
}

/**
 * Same UTC calendar-day rule as {@link getUtcDayRange}, anchored to an
 * explicit YYYY-MM-DD date instead of "now" - used by the History API so
 * a requested date resolves to the same day boundaries that
 * /nutrition/today uses for the current date. Callers must validate the
 * date format/validity first (see historySchema.ts); this assumes a
 * well-formed calendar date.
 */
export function getUtcDayRangeForDate(date: string): UtcDayRange {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { date, start, end };
}
