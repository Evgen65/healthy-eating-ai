import { env } from "../config/env.js";
import type { MealAnalyzer } from "./mealAnalyzer.js";
import { UnsupportedAiProviderError } from "./mealAnalyzerErrors.js";
import { MockMealAnalyzer } from "./mockMealAnalyzer.js";
import { OpenAiMealAnalyzer } from "./openAiMealAnalyzer.js";

/**
 * Resolves the configured MealAnalyzer from AI_PROVIDER. Called once at
 * router module load (see mealAnalysisRoutes.ts), so an unsupported value
 * fails loudly at startup instead of surfacing as a confusing per-request
 * error - and, more importantly, instead of silently behaving like Mock.
 * A missing OPENAI_API_KEY is deliberately NOT checked here: that is
 * OpenAiMealAnalyzer's own concern, raised per-request only when the
 * endpoint is actually used (see its AiProviderNotConfiguredError), so the
 * server still starts normally and Mock stays switchable without a key.
 */
export function createMealAnalyzer(): MealAnalyzer {
  switch (env.aiProvider) {
    case "mock":
      return new MockMealAnalyzer();
    case "openai":
      return new OpenAiMealAnalyzer();
    default:
      throw new UnsupportedAiProviderError(
        `Unsupported AI_PROVIDER "${env.aiProvider}" - expected "mock" or "openai".`,
      );
  }
}
