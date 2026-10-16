import type { AuthUser } from "@healthy-eating-ai/shared";
import { apiFetch } from "../api/httpClient";

export type RegisterResult =
  | { kind: "success"; user: AuthUser }
  | { kind: "duplicate_email"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

export type LoginResult =
  | { kind: "success"; user: AuthUser }
  | { kind: "invalid_credentials"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function register(email: string, password: string): Promise<RegisterResult> {
  try {
    // A wrong-shaped/duplicate response here is an expected outcome to
    // handle inline, not a session expiring - skip the global 401/event
    // plumbing apiFetch would otherwise trigger (register itself never
    // returns 401, but login below shares this same reasoning).
    const response = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      skipUnauthorizedEvent: true,
    });

    if (response.status === 201) {
      return { kind: "success", user: (await response.json()) as AuthUser };
    }
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      return { kind: "duplicate_email", message: body?.error ?? "An account with this email already exists" };
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      return { kind: "invalid", message: body?.error ?? "Invalid email or password" };
    }
    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  } catch {
    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      skipUnauthorizedEvent: true,
    });

    if (response.status === 200) {
      return { kind: "success", user: (await response.json()) as AuthUser };
    }
    if (response.status === 401) {
      const body = await response.json().catch(() => null);
      return { kind: "invalid_credentials", message: body?.error ?? "Invalid email or password" };
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      return { kind: "invalid", message: body?.error ?? "Invalid email or password" };
    }
    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  } catch {
    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", skipUnauthorizedEvent: true });
  } catch {
    // Best-effort: even if the network call fails, the caller (AuthContext)
    // still clears local state, so the UI always ends up logged out.
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await apiFetch("/api/auth/me", { skipUnauthorizedEvent: true });
    if (response.status === 200) {
      return (await response.json()) as AuthUser;
    }
    return null;
  } catch {
    return null;
  }
}
