import { z } from "zod";

/**
 * Hard ceiling on the number of items a single analysis may report. Guards
 * against an unbounded payload if a provider ever ignores the prompt's
 * instruction to report at most this many items.
 */
export const MAX_AI_ANALYSIS_ITEMS = 20;

/**
 * Shape requested from the OpenAI Responses API via Structured Outputs
 * (see openAiMealAnalyzer.ts's use of `zodTextFormat`). Kept to plain
 * types only - OpenAI's strict-mode JSON Schema does not reliably support
 * every Zod refinement (min/max, positivity, trimming), so those business
 * rules are enforced separately below, against the already-parsed result,
 * before any of it is trusted.
 */
export const aiMealAnalysisRequestSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      estimatedQuantityG: z.number(),
      calories: z.number(),
      proteinG: z.number(),
      fatG: z.number(),
      carbsG: z.number(),
    }),
  ),
});

/**
 * Authoritative validation applied to the model's parsed output before any
 * of it is trusted. Rejects NaN/Infinity, non-positive quantities, negative
 * macros/calories, empty names, and more items than MAX_AI_ANALYSIS_ITEMS -
 * none of which Structured Outputs alone guarantees. An empty `items` array
 * is valid here on purpose: it is how "no food detected" is represented
 * (see openAiMealAnalyzer.ts), so this schema never requires at least one
 * item.
 */
export const aiMealAnalysisItemSchema = z.object({
  name: z.string().trim().min(1),
  estimatedQuantityG: z.number().finite().gt(0),
  calories: z.number().finite().gte(0),
  proteinG: z.number().finite().gte(0),
  fatG: z.number().finite().gte(0),
  carbsG: z.number().finite().gte(0),
});

export const aiMealAnalysisResultSchema = z.object({
  items: z.array(aiMealAnalysisItemSchema).max(MAX_AI_ANALYSIS_ITEMS),
});

export type ValidatedAiMealAnalysisItem = z.infer<typeof aiMealAnalysisItemSchema>;
