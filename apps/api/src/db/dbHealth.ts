import type { Metrics } from "../metrics/metrics.js";

export type DbHealthResult = { ok: true } | { ok: false; error: unknown };

/**
 * Runs the health query and records outcome + duration metrics. The error is
 * handed back to the caller for logging only - it is never used as a label.
 */
export async function checkDatabaseHealth(query: () => Promise<unknown>, metrics: Metrics): Promise<DbHealthResult> {
  const startedAt = process.hrtime.bigint();
  let result: DbHealthResult;
  try {
    await query();
    result = { ok: true };
  } catch (error) {
    result = { ok: false, error };
  }
  metrics.dbHealthCheckDurationSeconds.observe(Number(process.hrtime.bigint() - startedAt) / 1e9);
  metrics.dbHealthChecksTotal.inc({ outcome: result.ok ? "ok" : "error" });
  return result;
}
