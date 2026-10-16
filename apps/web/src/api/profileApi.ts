import type { UserProfile } from "@healthy-eating-ai/shared";
import { apiFetch } from "./httpClient";

export type ProfileFormInput = Omit<UserProfile, "id" | "userId" | "createdAt" | "updatedAt">;

export type GetProfileResult = { kind: "found"; profile: UserProfile } | { kind: "not_found" } | { kind: "error" };

export type SaveProfileResult =
  | { kind: "success"; profile: UserProfile }
  | { kind: "invalid"; message: string }
  | { kind: "error" };

export async function getProfile(): Promise<GetProfileResult> {
  try {
    const response = await apiFetch("/api/me/profile");

    if (response.status === 200) {
      return { kind: "found", profile: (await response.json()) as UserProfile };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

async function saveProfile(method: "POST" | "PUT", input: ProfileFormInput): Promise<SaveProfileResult> {
  try {
    const response = await apiFetch("/api/me/profile", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.status === 200 || response.status === 201) {
      return { kind: "success", profile: (await response.json()) as UserProfile };
    }

    if (response.status === 400 || response.status === 404 || response.status === 409) {
      const body = await response.json().catch(() => null);
      return { kind: "invalid", message: body?.error ?? "Invalid profile data" };
    }

    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export function createProfile(input: ProfileFormInput): Promise<SaveProfileResult> {
  return saveProfile("POST", input);
}

export function updateProfile(input: ProfileFormInput): Promise<SaveProfileResult> {
  return saveProfile("PUT", input);
}
