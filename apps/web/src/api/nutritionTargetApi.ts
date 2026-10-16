import type { NutritionTarget } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type GetNutritionTargetResult = { kind: "found"; target: NutritionTarget } | { kind: "not_found" } | { kind: "error" };

export async function getNutritionTarget(): Promise<GetNutritionTargetResult> {
  try {
    const response = await apiFetch("/api/me/nutrition-target");

    if (response.status === 200) {
      return { kind: "found", target: (await response.json()) as NutritionTarget };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export type CalculateNutritionTargetResult =
  | { kind: "success"; target: NutritionTarget }
  | { kind: "profile_not_found" }
  | { kind: "failed"; message: string }
  | { kind: "error" };

/**
 * Triggers a server-side (re)calculation from the currently stored
 * profile. No profile values are sent from the client - the backend is
 * the sole source of the calculation formula and the source of truth for
 * the profile it calculates from.
 */
export async function calculateNutritionTarget(): Promise<CalculateNutritionTargetResult> {
  try {
    const response = await apiFetch("/api/me/nutrition-target/calculate", { method: "POST" });

    if (response.status === 200) {
      return { kind: "success", target: (await response.json()) as NutritionTarget };
    }

    if (response.status === 404) {
      const body = await response.json().catch(() => null);
      if (body?.error === "Profile not found") {
        return { kind: "profile_not_found" };
      }
      return { kind: "failed", message: body?.error ?? "Unable to calculate nutrition target" };
    }

    if (response.status === 400 || response.status === 422) {
      const body = await response.json().catch(() => null);
      return { kind: "failed", message: body?.error ?? "Unable to calculate nutrition target" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
