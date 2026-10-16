import type { MealAnalysisResult } from "@healthy-eating-ai/shared";
import type { MealAnalysisInput } from "./mealAnalysisTypes.js";

/**
 * Provider-agnostic abstraction for turning a meal photo into a structured
 * estimate. The route composes against this interface, not against a
 * specific provider, so MockMealAnalyzer can later be swapped for e.g. an
 * OpenAIMealAnalyzer without changing the HTTP contract, the frontend, or
 * meal persistence/nutrition logic.
 */
export interface MealAnalyzer {
  analyze(input: MealAnalysisInput): Promise<MealAnalysisResult>;
}
