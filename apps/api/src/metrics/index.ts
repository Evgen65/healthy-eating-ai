import { createMetrics } from "./metrics.js";

/** Whether the /metrics endpoint is exposed. Off unless METRICS_ENABLED is "true" or "1". */
export function isMetricsEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  const value = source.METRICS_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}

/** The process-wide metrics instance. Default Node metrics are only collected when metrics are enabled. */
export const metrics = createMetrics({ collectDefaults: isMetricsEnabled() });
