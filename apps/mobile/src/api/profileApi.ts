import type { UserProfile } from "@healthy-eating-ai/shared";
import { apiRequest } from "./httpClient";

/**
 * Same contract as apps/web/src/api/profileApi.ts against the existing
 * /api/me/profile routes: the user is identified solely by the Bearer
 * token (backend req.user.id) - no userId is ever sent from the app.
 */
export type ProfileInput = Omit<UserProfile, "id" | "userId" | "createdAt" | "updatedAt">;

export type GetProfileResult =
  | { kind: "found"; profile: UserProfile }
  | { kind: "not_found" }
  | { kind: "network_error" }
  | { kind: "error" };

export type SaveProfileResult =
  | { kind: "success"; profile: UserProfile }
  | { kind: "invalid" }
  | { kind: "network_error" }
  | { kind: "error" };

export async function getProfile(): Promise<GetProfileResult> {
  const result = await apiRequest("/api/me/profile");
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200) {
    return { kind: "found", profile: result.body as UserProfile };
  }
  if (result.status === 404) {
    return { kind: "not_found" };
  }
  return { kind: "error" };
}

/** POST creates the profile (first save), PUT replaces it afterwards - exactly as the Web Profile page does. */
export async function saveProfile(input: ProfileInput, profileExists: boolean): Promise<SaveProfileResult> {
  const result = await apiRequest("/api/me/profile", { method: profileExists ? "PUT" : "POST", body: input });
  if (result.kind === "network_error") {
    return result;
  }
  if (result.status === 200 || result.status === 201) {
    return { kind: "success", profile: result.body as UserProfile };
  }
  if (result.status === 400) {
    return { kind: "invalid" };
  }
  return { kind: "error" };
}
