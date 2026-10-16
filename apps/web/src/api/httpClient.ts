import { API_BASE_URL } from "../config/env";

/**
 * Fired whenever any apiFetch call gets a 401 from a `/api/me/...`-style
 * protected endpoint - AuthProvider listens for this to clear its in-memory
 * user state the moment a session expires or is revoked server-side,
 * without every page/API module needing its own 401-handling logic. Never
 * fired for /api/auth/login or /api/auth/register themselves (a wrong
 * password there is an expected, not a session-expiry, 401).
 */
export const UNAUTHORIZED_EVENT = "heai:unauthorized";

export interface ApiFetchOptions extends RequestInit {
  /** Suppresses the UNAUTHORIZED_EVENT dispatch on a 401 - used by the auth endpoints themselves, where a 401 means "wrong credentials", not "your session just expired". */
  skipUnauthorizedEvent?: boolean;
}

/**
 * Thin fetch wrapper shared by every api/*.ts module. Always sends the
 * httpOnly session cookie cross-origin (`credentials: "include"`) - without
 * this, the Web app (localhost:5173) could never call the authenticated API
 * (localhost:4000) at all. Centralizing the 401 -> global-logout behavior
 * here is what keeps auth logic out of every individual page.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { skipUnauthorizedEvent, ...init } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: "include" });

  if (response.status === 401 && !skipUnauthorizedEvent) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  return response;
}
