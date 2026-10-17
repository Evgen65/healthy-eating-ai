import type { Metrics } from "../metrics/metrics.js";
import { aiErrorCategory } from "./aiAnalysisLogging.js";

/** Provider label is limited to the supported providers, whatever the configuration says. */
function providerLabel(provider: string): "mock" | "openai" | "other" {
  return provider === "mock" || provider === "openai" ? provider : "other";
}

/**
 * Two separate questions are measured here:
 *  - provider execution outcome (ai_analysis_requests_total): did the
 *    provider call work, or which typed failure category ended it?
 *  - business result (ai_analysis_results_total): of the executions that
 *    succeeded, did the image contain food? "no_food" is a SUCCESSFUL
 *    provider execution and is never counted as a failure.
 */
export function recordAiAnalysisSuccess(metrics: Metrics, provider: string, durationMs: number, itemCount: number): void {
  const label = providerLabel(provider);
  metrics.aiAnalysisRequestsTotal.inc({ provider: label, outcome: "success" });
  metrics.aiAnalysisDurationSeconds.observe({ provider: label }, durationMs / 1000);
  metrics.aiAnalysisResultsTotal.inc({ result: itemCount === 0 ? "no_food" : "meal_detected" });
}

export function recordAiAnalysisFailure(metrics: Metrics, provider: string, durationMs: number, error: unknown): void {
  const label = providerLabel(provider);
  metrics.aiAnalysisRequestsTotal.inc({ provider: label, outcome: aiErrorCategory(error) });
  metrics.aiAnalysisDurationSeconds.observe({ provider: label }, durationMs / 1000);
}

export function recordAiRetry(metrics: Metrics, provider: string, error: unknown): void {
  metrics.aiAnalysisRetriesTotal.inc({ provider: providerLabel(provider), category: aiErrorCategory(error) });
}
