import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { MealAnalysisResult } from "@healthy-eating-ai/shared";
import { calculateMealTotals } from "../calculators/mealTotalsCalculator.js";
import { env } from "../config/env.js";
import { aiMealAnalysisRequestSchema, aiMealAnalysisResultSchema, MAX_AI_ANALYSIS_ITEMS } from "./aiMealAnalysisSchema.js";
import { getLogger } from "../logging/requestContext.js";
import type { MealAnalyzer } from "./mealAnalyzer.js";
import type { MealAnalysisInput } from "./mealAnalysisTypes.js";
import {
  AiProviderInvalidResponseError,
  AiProviderNetworkError,
  AiProviderNotConfiguredError,
  AiProviderQuotaExhaustedError,
  AiProviderRateLimitError,
  AiProviderRequestError,
  AiProviderTimeoutError,
  AiProviderUnavailableError,
  MealAnalyzerError,
  type MealAnalyzerErrorMeta,
} from "./mealAnalyzerErrors.js";

// OpenAI's own reported reason for an exhausted-quota 429 - distinct from a
// temporary rate limit (see AiProviderQuotaExhaustedError). Matched against
// both `error.code` and `error.type` since the exact field the API
// populates has varied across API versions.
const QUOTA_EXHAUSTED_CODES = new Set(["insufficient_quota", "credit_balance_exhausted"]);

export const OPENAI_ANALYSIS_VERSION = "openai-v1";

// Suggested order of magnitude from the milestone brief (30-60s) - long
// enough for a real vision call, short enough that a single hung request
// can never block the Express process indefinitely.
const REQUEST_TIMEOUT_MS = 45_000;

const STRUCTURED_OUTPUT_SCHEMA_NAME = "meal_analysis";

const SYSTEM_INSTRUCTIONS = `You are a food estimation assistant for a nutrition tracking app.

Analyze only the visible food and drink in the photo. For each distinct food
or drink item, estimate:
- its name
- approximate edible portion size in grams (estimatedQuantityG)
- calories
- protein in grams (proteinG)
- fat in grams (fatG)
- carbohydrates in grams (carbsG)

Report at most ${MAX_AI_ANALYSIS_ITEMS} items. If the image contains no food or
drink that can be reasonably identified, return an empty items list.

Be conservative about what you report:
- Report only food or drink that is visibly present in the image. Do not
  invent additional dishes, drinks, ingredients, sauces, toppings, or side
  items that are not visible.
- Do not infer hidden ingredients just because they are common in a typical
  recipe for that dish. Visible evidence always takes priority over recipe
  assumptions.
- Only list an ingredient as its own separate item when it is visually
  distinguishable or strongly supported by the visible dish itself.
- If a mixed or composite dish cannot be reliably decomposed from what is
  visible, report it as a single generic composite item (for example "Mixed
  vegetable salad" or "Cold mixed vegetable soup") instead of guessing at
  hidden ingredients.
- If the exact identity of a dish is uncertain, use a conservative, broader
  generic name rather than a specific but unsupported one (for example
  "Omelet" instead of "Tuna omelet" when no tuna is visible).
- Never invent an additional drink or side dish that is not visible in the
  photo.
- Returning fewer conservative items is better than returning more items that
  include a guess.

Do not invent extra items beyond what is visually present:
- Every returned item must correspond to a visually distinct food/drink
  portion, region, or container that is actually visible in the image. Do not
  return an item you cannot point to in the image.
- Do not infer additional food or drink from color, texture, recipe
  convention, shadows, tableware, or background objects.
- The number of returned items should not exceed the number of visually
  distinguishable food/drink components, unless multiple components are
  clearly separable within the same plate or bowl.
- If the image shows one bowl containing one mixed dish and no separate cup,
  glass, plate, or food portion, return one composite food item rather than
  inventing an additional dish or drink.
- If an uncertain visual region could plausibly be part of an existing dish,
  merge it into that broader composite item instead of creating a new item
  for it.
- When deciding between (A) adding another uncertain item or (B) keeping
  fewer, broader items, always prefer (B).
- Before finalizing your result, verify internally that each item you are
  about to report has direct visible support in the image, and remove any
  item that does not.

Focus on the primary meal area:
- Focus on the primary meal area. Ignore peripheral or background objects
  unless they are clearly identifiable as food or drink intended to be
  consumed as part of this meal.
- Do not classify jars, condiment containers, spice containers, packaging,
  tableware, or partially visible background objects as food or drink unless
  their edible contents are visually clear and unambiguous.
- If a peripheral object is ambiguous, omit it rather than guessing at what
  it might contain.

Important rules:
- All values are approximate estimates, not laboratory-precise measurements.
- Infer reasonable portions from visible evidence in the image only.
- Do not pretend exact accuracy.
- Do not diagnose health conditions, recommend medication, or make medical
  claims of any kind.
- Do not judge whether the meal is "good" or "bad", and do not give dietary
  advice.
- You are not given, and must not assume, anything about the person eating -
  no age, sex, weight, or nutrition target. Analyze only what is visible in
  the photo.`;

const USER_PROMPT =
  "Identify each visible food/drink item in this photo and estimate its portion size and nutrition as instructed.";

/**
 * Real vision-based MealAnalyzer (Milestone 13A) behind the same
 * MealAnalyzer abstraction MockMealAnalyzer implements - the HTTP route and
 * the rest of the app never see OpenAI-specific types. Uses the OpenAI
 * Responses API with Structured Outputs (zodTextFormat) so the model's
 * output is schema-constrained JSON, never prose that has to be regex- or
 * markdown-parsed. The client is not trusted with totals or with item-level
 * business rules (positive quantity, non-negative macros, non-empty name,
 * item count) - those are computed/enforced here on the Backend from the
 * validated items only.
 */
export class OpenAiMealAnalyzer implements MealAnalyzer {
  private client: OpenAI | null = null;

  /**
   * A single provider attempt - no retry loop here. Retrying a transient
   * failure is analyzeWithRetry's job (see retryingMealAnalyzer.ts), which
   * the route applies uniformly on top of whichever MealAnalyzer is
   * configured. Keeping this method single-attempt means the OpenAI client
   * is built with its own `maxRetries: 0` (see getClient) - otherwise the
   * SDK's built-in retry and analyzeWithRetry's retry would compound into
   * far more than the milestone's "max 2 attempts total" budget.
   */
  async analyze(input: MealAnalysisInput): Promise<MealAnalysisResult> {
    const client = this.getClient();
    const startedAt = Date.now();
    const baseMeta: MealAnalyzerErrorMeta = { provider: "openai", model: env.openaiModel };

    try {
      const response = await client.responses.parse(
        {
          model: env.openaiModel,
          instructions: SYSTEM_INSTRUCTIONS,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: USER_PROMPT },
                {
                  type: "input_image",
                  detail: "auto",
                  image_url: toDataUrl(input),
                },
              ],
            },
          ],
          text: { format: zodTextFormat(aiMealAnalysisRequestSchema, STRUCTURED_OUTPUT_SCHEMA_NAME) },
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );

      const parsed = aiMealAnalysisRequestSchema.safeParse(response.output_parsed);
      if (!parsed.success) {
        throw new AiProviderInvalidResponseError("OpenAI meal analysis returned no structured output", baseMeta);
      }

      const validated = aiMealAnalysisResultSchema.safeParse(parsed.data);
      if (!validated.success) {
        throw new AiProviderInvalidResponseError("OpenAI meal analysis output failed validation", baseMeta);
      }

      const items = validated.data.items;
      logOutcome({
        model: env.openaiModel,
        durationMs: Date.now() - startedAt,
        success: true,
        itemCount: items.length,
      });

      return {
        provider: "openai",
        analysisVersion: OPENAI_ANALYSIS_VERSION,
        items,
        totals: calculateMealTotals(items),
      };
    } catch (error) {
      const classified = classifyProviderError(error, baseMeta);
      logOutcome({
        model: env.openaiModel,
        durationMs: Date.now() - startedAt,
        success: false,
        classification: classified.constructor.name,
        providerStatus: classified.meta.providerStatus,
        providerErrorCode: classified.meta.providerErrorCode,
        requestId: classified.meta.requestId,
      });
      throw classified;
    }
  }

  /**
   * Deferred client construction: the key is checked (and the client built)
   * only when an analysis is actually requested, not when this analyzer is
   * instantiated at startup (see mealAnalyzerFactory.ts). This lets the
   * server start normally with AI_PROVIDER=openai even before a key is
   * configured, and fail with a controlled error only on actual use.
   * `maxRetries: 0` - see the analyze() doc comment for why the SDK's own
   * retry must stay disabled.
   */
  private getClient(): OpenAI {
    if (!env.openaiApiKey) {
      throw new AiProviderNotConfiguredError("OPENAI_API_KEY is not set");
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: env.openaiApiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
    }
    return this.client;
  }
}

/**
 * Classifies a raw OpenAI SDK error (or, in the rare case that a
 * MealAnalyzerError was thrown directly above for an invalid structured
 * response, passes it through unchanged) into one of this module's typed,
 * provider-neutral errors. This is the one place that inspects
 * OpenAI-specific error classes/status codes/error codes - the route and
 * everything above it only ever sees the typed result. Never rethrows the
 * raw error or attaches its full body - only a short sanitized message as
 * `cause`, plus non-sensitive status/code/request-id metadata for logging.
 */
function classifyProviderError(error: unknown, meta: MealAnalyzerErrorMeta): MealAnalyzerError {
  if (error instanceof MealAnalyzerError) {
    return error;
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new AiProviderTimeoutError("OpenAI meal analysis request timed out", meta, { cause: sanitizeError(error) });
  }
  if (error instanceof APIConnectionError) {
    return new AiProviderNetworkError("OpenAI meal analysis network request failed", meta, {
      cause: sanitizeError(error),
    });
  }
  if (error instanceof RateLimitError) {
    const code = error.code ?? error.type ?? undefined;
    const withMeta: MealAnalyzerErrorMeta = {
      ...meta,
      providerStatus: error.status,
      providerErrorCode: code,
      requestId: error.requestID ?? undefined,
    };
    if (code && QUOTA_EXHAUSTED_CODES.has(code)) {
      return new AiProviderQuotaExhaustedError("OpenAI reported exhausted quota/credits", withMeta, {
        cause: sanitizeError(error),
      });
    }
    return new AiProviderRateLimitError("OpenAI rate limit exceeded", withMeta, { cause: sanitizeError(error) });
  }
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new AiProviderNotConfiguredError(
      "OpenAI rejected the request due to an authentication or permission error",
      { ...meta, providerStatus: error.status, providerErrorCode: error.code ?? error.type ?? undefined, requestId: error.requestID ?? undefined },
      { cause: sanitizeError(error) },
    );
  }
  if (error instanceof InternalServerError) {
    return new AiProviderUnavailableError(
      "OpenAI provider returned a server error",
      { ...meta, providerStatus: error.status, requestId: error.requestID ?? undefined },
      { cause: sanitizeError(error) },
    );
  }
  if (error instanceof APIError) {
    // Any other APIError we don't special-case above (e.g. an unexpected
    // 400/404/409) - unknown cause, so conservatively non-retryable.
    return new AiProviderRequestError(
      "OpenAI meal analysis request failed",
      { ...meta, providerStatus: error.status ?? undefined, providerErrorCode: error.code ?? error.type ?? undefined, requestId: error.requestID ?? undefined },
      { cause: sanitizeError(error) },
    );
  }

  // Not an OpenAI SDK error at all (e.g. a bug in this module) - never
  // rethrown raw, since it can carry internals that shouldn't reach the
  // browser.
  return new AiProviderRequestError("OpenAI meal analysis request failed", meta, { cause: sanitizeError(error) });
}

function toDataUrl(input: MealAnalysisInput): string {
  return `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;
}

/** Strips a raw SDK/network error down to a short, loggable message only - never the full error object, which may embed request details. */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}

interface AnalysisOutcome {
  model: string;
  durationMs: number;
  success: boolean;
  itemCount?: number;
  classification?: string;
  providerStatus?: number;
  providerErrorCode?: string;
  requestId?: string;
}

/**
 * Debug-friendly, privacy-conscious logging: provider name, model, timing,
 * success/failure, item count, and - on failure - the internal
 * classification plus non-sensitive provider status/error-code/request-id
 * metadata (useful for correlating with OpenAI's own dashboard/support).
 * Never the API key, the uploaded image, or the raw model response/body.
 */
function logOutcome(outcome: AnalysisOutcome): void {
  // Success is reported by the route as ai_analysis_succeeded; this adds the
  // provider-side detail (model, item count, provider status / request id).
  getLogger()[outcome.success ? "debug" : "info"]({
    event: "ai_provider_call_completed",
    provider: "openai",
    model: outcome.model,
    durationMs: outcome.durationMs,
    success: outcome.success,
    itemCount: outcome.itemCount,
    classification: outcome.classification,
    providerStatus: outcome.providerStatus,
    providerErrorCode: outcome.providerErrorCode,
    providerRequestId: outcome.requestId,
  });
}
