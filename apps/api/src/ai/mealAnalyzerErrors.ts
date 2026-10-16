/**
 * Non-sensitive diagnostic context attached to a classified provider
 * failure - never the API key, image bytes, or full raw provider error
 * object. Consumed by route-level logging (mealAnalysisRoutes.ts) and by
 * openAiMealAnalyzer.ts when it classifies a raw OpenAI SDK error.
 */
export interface MealAnalyzerErrorMeta {
  provider?: string;
  model?: string;
  providerStatus?: number;
  providerErrorCode?: string;
  requestId?: string;
}

/**
 * Base class for every classified provider-layer failure (Milestone 13C).
 * `retryable` is fixed per concrete subclass below, not per instance, so
 * analyzeWithRetry (see retryingMealAnalyzer.ts) can decide whether to
 * retry from the error's type alone - never by parsing `.message` or
 * inspecting an HTTP status code. `attempts` is filled in by
 * analyzeWithRetry once it has made its final retry/give-up decision, for
 * logging and response-header diagnostics only.
 */
export class MealAnalyzerError extends Error {
  readonly retryable: boolean;
  readonly meta: MealAnalyzerErrorMeta;
  attempts?: number;

  constructor(message: string, retryable: boolean, meta: MealAnalyzerErrorMeta = {}, options?: { cause?: unknown }) {
    super(message, options);
    this.retryable = retryable;
    this.meta = meta;
  }
}

/**
 * AI_PROVIDER itself is not a supported value (e.g. a typo like "foobar").
 * Thrown once, synchronously, when the analyzer is resolved (see
 * mealAnalyzerFactory.ts) - a misconfigured provider name must fail loudly
 * at startup rather than silently behaving like Mock. Unrelated to the
 * per-request classification below (it can never happen mid-request), so
 * it deliberately does not extend MealAnalyzerError and is never retried.
 */
export class UnsupportedAiProviderError extends Error {}

/**
 * The selected real provider is missing required configuration or valid
 * credentials (e.g. AI_PROVIDER=openai without OPENAI_API_KEY, an invalid
 * key, or a permission error). Raised per-request only when the endpoint is
 * actually invoked, so the server still starts and Mock stays switchable at
 * any time without a key. Routes map this to HTTP 503. Never retried - a
 * bad key or missing permission will not fix itself between attempt 1 and
 * attempt 2.
 */
export class AiProviderNotConfiguredError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, false, meta, options);
  }
}

/**
 * The provider did not respond within the per-attempt request budget (see
 * REQUEST_TIMEOUT_MS in openAiMealAnalyzer.ts). Routes map this to HTTP
 * 504. Retried once, since a single slow response does not necessarily
 * mean the next one will be too.
 */
export class AiProviderTimeoutError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, true, meta, options);
  }
}

/**
 * Temporary rate limiting (HTTP 429) that is NOT an exhausted quota - see
 * AiProviderQuotaExhaustedError for that distinction. Routes map this to
 * HTTP 429. Retried once.
 */
export class AiProviderRateLimitError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, true, meta, options);
  }
}

/**
 * A 429 whose body identifies exhausted quota/credits (e.g. OpenAI's
 * `insufficient_quota` / `credit_balance_exhausted`) rather than temporary
 * throttling - retrying immediately cannot succeed, so unlike
 * AiProviderRateLimitError this is never retried. Routes map this to HTTP
 * 503 and never expose the billing/credit detail itself to the browser.
 */
export class AiProviderQuotaExhaustedError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, false, meta, options);
  }
}

/** The provider itself reported an outage (HTTP 5xx). Routes map this to HTTP 502. Retried once. */
export class AiProviderUnavailableError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, true, meta, options);
  }
}

/** A connection-level failure (DNS, TCP, TLS, aborted socket) before any HTTP response was received. Routes map this to HTTP 502. Retried once. */
export class AiProviderNetworkError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, true, meta, options);
  }
}

/**
 * The provider responded, but its structured output was missing, malformed,
 * or failed backend validation (aiMealAnalysisResultSchema) - too many
 * items, negative macros, an empty name, etc. Milestone 13C scope
 * explicitly excludes attempting to "repair" this, so it is never retried
 * (the same malformed shape would likely recur) and no partial data is ever
 * returned or persisted. Routes map this to HTTP 502.
 */
export class AiProviderInvalidResponseError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, false, meta, options);
  }
}

/**
 * Fallback for a provider failure that does not fit any category above
 * (e.g. an unexpected 4xx from the SDK). Kept deliberately non-retryable,
 * since its cause is unknown. Routes map this to HTTP 502. Never carries
 * the raw provider error message (which may include request internals) -
 * callers pass a short, sanitized description instead.
 */
export class AiProviderRequestError extends MealAnalyzerError {
  constructor(message: string, meta?: MealAnalyzerErrorMeta, options?: { cause?: unknown }) {
    super(message, false, meta, options);
  }
}
