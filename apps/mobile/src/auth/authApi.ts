import type { AuthUser } from "@healthy-eating-ai/shared";
import { apiRequest } from "../api/httpClient";
import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../api/messages";

/**
 * Mobile auth calls against the backend's mobile auth endpoints (see
 * apps/api/src/routes/authRoutes.ts) - the same users, password hashing and
 * JWT as Web, only delivered as `{ user, token }` instead of a cookie.
 * Every outcome is a typed result carrying a controlled, user-facing
 * message - the raw API error body is never shown as-is.
 */
export type AuthFailure =
  | { kind: "invalid_credentials"; message: string }
  | { kind: "duplicate_email"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "error"; message: string };

export type AuthResult = { kind: "success"; user: AuthUser; token: string } | AuthFailure;

export type CurrentUserResult =
  | { kind: "success"; user: AuthUser }
  | { kind: "unauthorized" }
  | { kind: "unavailable" };

function toAuthUser(value: unknown): AuthUser | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { id, email } = value as Partial<AuthUser>;
  return typeof id === "string" && typeof email === "string" ? { id, email } : null;
}

async function authenticate(path: string, email: string, password: string): Promise<AuthResult> {
  const result = await apiRequest(path, { method: "POST", body: { email, password }, authenticated: false });

  if (result.kind === "network_error") {
    return { kind: "network_error", message: NETWORK_ERROR_MESSAGE };
  }

  if (result.status === 200 || result.status === 201) {
    const body = result.body as { user?: unknown; token?: unknown } | null;
    const user = toAuthUser(body?.user);
    if (user && typeof body?.token === "string") {
      return { kind: "success", user, token: body.token };
    }
    return { kind: "error", message: GENERIC_ERROR_MESSAGE };
  }
  if (result.status === 401) {
    return { kind: "invalid_credentials", message: "Invalid email or password." };
  }
  if (result.status === 409) {
    return { kind: "duplicate_email", message: "An account with this email already exists." };
  }
  if (result.status === 400) {
    return { kind: "invalid", message: "Enter a valid email and a password of at least 8 characters." };
  }
  return { kind: "error", message: GENERIC_ERROR_MESSAGE };
}

export function login(email: string, password: string): Promise<AuthResult> {
  return authenticate("/api/auth/mobile/login", email, password);
}

export function register(email: string, password: string): Promise<AuthResult> {
  return authenticate("/api/auth/mobile/register", email, password);
}

/**
 * Session restore check. Deliberately three-way: only a real 401 means the
 * stored token is invalid - a network failure or 5xx means "cannot tell
 * right now", and must never cause a potentially valid token to be deleted.
 */
export async function getCurrentUser(): Promise<CurrentUserResult> {
  const result = await apiRequest("/api/auth/me");

  if (result.kind === "network_error") {
    return { kind: "unavailable" };
  }
  if (result.status === 401) {
    return { kind: "unauthorized" };
  }
  const user = result.status === 200 ? toAuthUser(result.body) : null;
  return user ? { kind: "success", user } : { kind: "unavailable" };
}
