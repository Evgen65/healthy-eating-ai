import type { MealAnalysisItem, MealAnalysisResult } from "@healthy-eating-ai/shared";
import { calculateMealTotals } from "../calculators/mealTotalsCalculator.js";
import type { MealAnalyzer } from "./mealAnalyzer.js";
import type { MealAnalysisInput } from "./mealAnalysisTypes.js";
import {
  AiProviderInvalidResponseError,
  AiProviderNetworkError,
  AiProviderNotConfiguredError,
  AiProviderQuotaExhaustedError,
  AiProviderRateLimitError,
  AiProviderTimeoutError,
  AiProviderUnavailableError,
  type MealAnalyzerError,
} from "./mealAnalyzerErrors.js";

const MOCK_ITEMS: MealAnalysisItem[] = [
  { name: "Chicken breast", estimatedQuantityG: 150, calories: 250, proteinG: 46, fatG: 5, carbsG: 0 },
  { name: "Rice", estimatedQuantityG: 180, calories: 230, proteinG: 5, fatG: 1, carbsG: 50 },
];

/**
 * Magic `originalName` values recognized ONLY by MockMealAnalyzer - a
 * controllable, dependency-injection-free test seam for the Milestone 13C
 * reliability suite (tests/api/mealAnalysisReliability.api.spec.ts) to
 * deterministically exercise every provider failure classification without
 * monkey-patching this class or ever calling live OpenAI. The uploaded
 * image bytes are irrelevant for these - only the multipart field name is
 * inspected. Any other filename is completely unaffected and keeps the
 * original unconditional MOCK_ITEMS behavior below.
 */
const SIMULATED_FAILURES: Record<string, () => MealAnalyzerError> = {
  "simulate-timeout.jpg": () => new AiProviderTimeoutError("Simulated provider timeout", { provider: "mock" }),
  "simulate-rate-limit.jpg": () => new AiProviderRateLimitError("Simulated temporary rate limit", { provider: "mock" }),
  "simulate-quota-exhausted.jpg": () =>
    new AiProviderQuotaExhaustedError("Simulated exhausted quota/credits", { provider: "mock" }),
  "simulate-provider-unavailable.jpg": () =>
    new AiProviderUnavailableError("Simulated provider outage (5xx)", { provider: "mock" }),
  "simulate-network-error.jpg": () => new AiProviderNetworkError("Simulated network failure", { provider: "mock" }),
  "simulate-invalid-response.jpg": () =>
    new AiProviderInvalidResponseError("Simulated malformed structured output", { provider: "mock" }),
  "simulate-not-configured.jpg": () =>
    new AiProviderNotConfiguredError("Simulated missing/invalid configuration", { provider: "mock" }),
};

/**
 * Fails on every odd-numbered call for this filename and succeeds on every
 * even-numbered one - not just "fails once ever" - so the retry scenario
 * (attempt 1 fails, attempt 2 succeeds) is reproduced identically on every
 * separate Analyze request, even against a long-lived dev/test server that
 * has already served this filename before.
 */
const SIMULATED_TRANSIENT_THEN_SUCCESS = "simulate-transient-then-success.jpg";

/**
 * Deterministic stand-in for a real vision-based analyzer (Milestone 9A) -
 * makes no network/AI call and always returns the same fixed estimate
 * regardless of the uploaded image (with the sole exception of the magic
 * filenames above, added in Milestone 13C for reliability testing).
 * `totals` is derived from MOCK_ITEMS via the same calculator meal
 * persistence uses for item totals, rather than being hand-maintained
 * separately, so the two can never drift apart.
 */
export class MockMealAnalyzer implements MealAnalyzer {
  private transientCallCounts = new Map<string, number>();

  async analyze(input: MealAnalysisInput): Promise<MealAnalysisResult> {
    const failureFactory = SIMULATED_FAILURES[input.originalName];
    if (failureFactory) {
      throw failureFactory();
    }

    if (input.originalName === SIMULATED_TRANSIENT_THEN_SUCCESS) {
      const callCount = (this.transientCallCounts.get(input.originalName) ?? 0) + 1;
      this.transientCallCounts.set(input.originalName, callCount);
      if (callCount % 2 === 1) {
        throw new AiProviderNetworkError("Simulated transient network failure (first attempt)", { provider: "mock" });
      }
    }

    return {
      provider: "mock",
      analysisVersion: "mock-v1",
      items: MOCK_ITEMS,
      totals: calculateMealTotals(MOCK_ITEMS),
    };
  }
}
