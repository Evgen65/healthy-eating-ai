import type { MealAnalysisResult } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type AnalyzeMealPhotoResult =
  | { kind: "success"; result: MealAnalysisResult }
  | { kind: "invalid"; message: string }
  | { kind: "no-food"; message: string }
  | { kind: "rate-limited"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

const GENERIC_ERROR_MESSAGE = "Meal analysis failed. Please try again.";
const NO_FOOD_MESSAGE = "No food detected in the selected image. Please choose a photo containing food.";
const RATE_LIMITED_MESSAGE = "Meal analysis is temporarily busy. Please try again shortly.";
const TIMEOUT_MESSAGE = "Meal analysis took too long. Please try again.";
const UNAVAILABLE_MESSAGE = "Meal analysis is temporarily unavailable. Please try again later.";
const CONFIGURATION_ERROR_MESSAGE = "Meal analysis is currently unavailable.";

function mapInvalidMessage(error: unknown): string {
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

export async function analyzeMealPhoto(file: File): Promise<AnalyzeMealPhotoResult> {
  try {
    const formData = new FormData();
    formData.append("image", file);

    // apiFetch (not a bare fetch) so the httpOnly session cookie is actually
    // sent cross-origin (see httpClient.ts) - this endpoint is authenticated
    // (Milestone 14) and a plain fetch would silently drop the cookie.
    const response = await apiFetch("/api/ai/meal-analysis", {
      method: "POST",
      body: formData,
    });

    if (response.status === 200) {
      return { kind: "success", result: (await response.json()) as MealAnalysisResult };
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      return { kind: "invalid", message: mapInvalidMessage(body?.error) };
    }

    if (response.status === 422) {
      const body = await response.json().catch(() => null);
      if (body?.error === "No food detected") {
        return { kind: "no-food", message: NO_FOOD_MESSAGE };
      }
      return { kind: "error", message: GENERIC_ERROR_MESSAGE };
    }

    if (response.status === 429) {
      return { kind: "rate-limited", message: RATE_LIMITED_MESSAGE };
    }

    if (response.status === 504) {
      return { kind: "timeout", message: TIMEOUT_MESSAGE };
    }

    if (response.status === 503) {
      const body = await response.json().catch(() => null);
      if (body?.error === "AI provider is not configured") {
        return { kind: "unavailable", message: CONFIGURATION_ERROR_MESSAGE };
      }
      return { kind: "unavailable", message: UNAVAILABLE_MESSAGE };
    }

    if (response.status === 502) {
      return { kind: "unavailable", message: UNAVAILABLE_MESSAGE };
    }

    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  } catch {
    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  }
}
