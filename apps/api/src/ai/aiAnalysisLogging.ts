import type { Logger } from "../logging/logger.js";
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
} from "./mealAnalyzerErrors.js";

export type AiErrorCategory =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "quota_exhausted"
  | "invalid_response"
  | "unavailable"
  | "network_error"
  | "request_failed"
  | "unknown";

/** Maps the existing typed provider errors to a stable, loggable category. */
export function aiErrorCategory(error: unknown): AiErrorCategory {
  if (error instanceof AiProviderNotConfiguredError) return "not_configured";
  if (error instanceof AiProviderTimeoutError) return "timeout";
  if (error instanceof AiProviderRateLimitError) return "rate_limited";
  if (error instanceof AiProviderQuotaExhaustedError) return "quota_exhausted";
  if (error instanceof AiProviderInvalidResponseError) return "invalid_response";
  if (error instanceof AiProviderUnavailableError) return "unavailable";
  if (error instanceof AiProviderNetworkError) return "network_error";
  if (error instanceof AiProviderRequestError) return "request_failed";
  return "unknown";
}

/** Safe, non-sensitive provider metadata of a classified failure (providerRequestId is the provider's own id, not ours). */
function safeProviderFields(error: unknown): Record<string, unknown> {
  if (!(error instanceof MealAnalyzerError)) {
    return {};
  }
  const { model, providerStatus, providerErrorCode, requestId } = error.meta;
  return { model, providerStatus, providerErrorCode, providerRequestId: requestId };
}

export interface AiFailureContext {
  provider: string;
  durationMs: number;
}

/** Logs `ai_analysis_failed`. The message of a classified error is a short sanitized description set by the provider layer. Never includes the image, credentials or a raw provider response. */
export function logAiAnalysisFailed(log: Logger, error: unknown, context: AiFailureContext): void {
  log.error({
    event: "ai_analysis_failed",
    provider: context.provider,
    category: aiErrorCategory(error),
    retryable: error instanceof MealAnalyzerError ? error.retryable : false,
    attempts: error instanceof MealAnalyzerError ? error.attempts : undefined,
    durationMs: context.durationMs,
    ...safeProviderFields(error),
    // Unclassified errors are unexpected: keep their safe serialization for diagnosis.
    ...(error instanceof MealAnalyzerError ? { message: error.message } : { err: error }),
  });
}
