import type { MealAnalysisResult } from "@healthy-eating-ai/shared";
import type { MealAnalyzer } from "./mealAnalyzer.js";
import type { MealAnalysisInput } from "./mealAnalysisTypes.js";
import { MealAnalyzerError } from "./mealAnalyzerErrors.js";

/**
 * Total attempts allowed for a single Analyze click: 1 initial attempt + at
 * most 1 automatic retry. Combined with each attempt's own bounded timeout
 * (REQUEST_TIMEOUT_MS in openAiMealAnalyzer.ts, currently 45s), the worst
 * case total time for one request is roughly
 * MAX_ANALYSIS_ATTEMPTS * REQUEST_TIMEOUT_MS + RETRY_DELAY_MS - well under
 * a minute and a half, never unbounded, and never "several minutes".
 */
export const MAX_ANALYSIS_ATTEMPTS = 2;

/** Short, deterministic pause before a retry - long enough to not hammer a struggling provider, short enough to stay well within the user's patience. */
const RETRY_DELAY_MS = 250;

export interface AnalyzeWithRetryResult {
  result: MealAnalysisResult;
  attempts: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a single MealAnalyzer call with a conservative, capped retry. Only
 * failures the provider layer has explicitly classified as transient
 * (MealAnalyzerError#retryable - timeout, rate limit, provider outage,
 * network error) get a second attempt, and never more than one: a
 * persistent outage must fail fast, not hang the request. A successful
 * result (including a "no food" empty-items result, which is not an error)
 * and any non-retryable classification (missing configuration, exhausted
 * quota, invalid structured output, unknown) are returned/thrown
 * immediately, so a single Analyze click can never cause more than one
 * extra billed provider call. Works against the plain MealAnalyzer
 * interface, so it applies identically to MockMealAnalyzer (used by the
 * reliability test suite to simulate every scenario below without a live
 * OpenAI call) and OpenAiMealAnalyzer.
 */
export async function analyzeWithRetry(
  analyzer: MealAnalyzer,
  input: MealAnalysisInput,
  maxAttempts: number = MAX_ANALYSIS_ATTEMPTS,
): Promise<AnalyzeWithRetryResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await analyzer.analyze(input);
      return { result, attempts: attempt };
    } catch (error) {
      const canRetry = attempt < maxAttempts && error instanceof MealAnalyzerError && error.retryable;
      if (!canRetry) {
        if (error instanceof MealAnalyzerError) {
          error.attempts = attempt;
        }
        throw error;
      }
      console.log(
        `[ai] attempt ${attempt}/${maxAttempts} failed with a retryable error (${error.constructor.name}), retrying`,
      );
      await delay(RETRY_DELAY_MS);
    }
  }
  // Unreachable: the loop above always returns or throws on its final
  // iteration (maxAttempts >= 1).
  throw new Error("analyzeWithRetry: exhausted attempts without a result or error");
}
