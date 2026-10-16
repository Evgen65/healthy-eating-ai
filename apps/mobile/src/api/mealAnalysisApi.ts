import type { MealAnalysisResult } from "@healthy-eating-ai/shared";
import { File } from "expo-file-system";
import type { MealPhoto } from "../meals/mealPhoto";
import { apiRequest } from "./httpClient";
import { NETWORK_ERROR_MESSAGE } from "./messages";

/**
 * The existing authenticated POST /api/ai/meal-analysis (the same endpoint
 * and response shape Web uses - see apps/web/src/api/mealAnalysisApi.ts).
 * Analysis never persists anything; only Confirm saves a meal, through the
 * ordinary /api/me/meals endpoint.
 *
 * Every failure maps to a fixed, user-facing message (same wording as Web,
 * M13C semantics) - never a raw provider/backend error body.
 */
export type AnalyzeMealPhotoResult = { kind: "success"; result: MealAnalysisResult } | { kind: "failure"; message: string };

const GENERIC_ERROR_MESSAGE = "Meal analysis failed. Please try again.";
const NO_FOOD_MESSAGE = "No food detected in the selected image. Please choose a photo containing food.";
const RATE_LIMITED_MESSAGE = "Meal analysis is temporarily busy. Please try again shortly.";
const TIMEOUT_MESSAGE = "Meal analysis took too long. Please try again.";
const UNAVAILABLE_MESSAGE = "Meal analysis is temporarily unavailable. Please try again later.";
const CONFIGURATION_ERROR_MESSAGE = "Meal analysis is currently unavailable.";

// The backend allows up to 2 provider attempts of 45s each (see
// apps/api/src/ai/retryingMealAnalyzer.ts) plus the upload itself - the
// default 15s client timeout would abort a still-valid analysis.
const ANALYSIS_TIMEOUT_MS = 120_000;

function errorOf(body: unknown): unknown {
  return typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
}

function invalidMessage(error: unknown): string {
  switch (error) {
    case "Unsupported image type":
      return "Unsupported image format. Use JPEG, PNG, or WEBP.";
    case "Image is too large":
      return "Image is too large. Maximum size is 10 MB.";
    case "Image is required":
      return "Select an image first.";
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

/** Status -> message, kept separate from the request so it stays a pure function. */
export function analysisFailureMessage(status: number, body: unknown): string {
  switch (status) {
    case 400:
      return invalidMessage(errorOf(body));
    case 422:
      return errorOf(body) === "No food detected" ? NO_FOOD_MESSAGE : GENERIC_ERROR_MESSAGE;
    case 429:
      return RATE_LIMITED_MESSAGE;
    case 502:
      return UNAVAILABLE_MESSAGE;
    case 503:
      return errorOf(body) === "AI provider is not configured" ? CONFIGURATION_ERROR_MESSAGE : UNAVAILABLE_MESSAGE;
    case 504:
      return TIMEOUT_MESSAGE;
    default:
      // Includes 401: httpClient has already cleared the session and
      // AuthProvider is redirecting to Login - nothing auth-specific here.
      return GENERIC_ERROR_MESSAGE;
  }
}

export async function analyzeMealPhoto(photo: MealPhoto): Promise<AnalyzeMealPhotoResult> {
  const formData = new FormData();
  // Expo SDK's global fetch (expo/fetch) only serializes Blob-like parts -
  // the legacy React Native { uri, name, type } descriptor is rejected with
  // "Unsupported FormDataPart implementation". expo-file-system's File is
  // Blob-compatible (name, type, bytes()). No manual Content-Type header -
  // fetch adds multipart/form-data with the boundary.
  formData.append("image", new File(photo.uri));

  const result = await apiRequest("/api/ai/meal-analysis", {
    method: "POST",
    body: formData,
    timeoutMs: ANALYSIS_TIMEOUT_MS,
  });

  if (result.kind === "network_error") {
    return { kind: "failure", message: NETWORK_ERROR_MESSAGE };
  }
  if (result.status === 200) {
    return { kind: "success", result: result.body as MealAnalysisResult };
  }
  return { kind: "failure", message: analysisFailureMessage(result.status, result.body) };
}
