import { getToken, removeToken } from "../auth/tokenStorage";
import { API_BASE_URL } from "../config/env";

/**
 * A fetch that finished with an HTTP status (any status), or never got one
 * at all. "network_error" (refused connection, DNS failure, timeout) is kept
 * deliberately separate from a 401: a network outage says nothing about
 * whether the stored token is still valid.
 */
export type ApiResult = { kind: "response"; status: number; body: unknown } | { kind: "network_error" };

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT";
  /**
   * Sent as JSON - except FormData (multipart uploads), which is passed to
   * fetch untouched so React Native builds the multipart Content-Type
   * itself, boundary included.
   */
  body?: unknown;
  /**
   * `true` (default): attach the stored token as `Authorization: Bearer`
   * and treat a 401 as "this session is no longer valid". `false` for the
   * login/register calls themselves, where a 401 means "wrong credentials".
   */
  authenticated?: boolean;
  /** Overrides REQUEST_TIMEOUT_MS for a request the backend legitimately needs longer for (AI meal analysis). */
  timeoutMs?: number;
}

// fetch in React Native has no timeout of its own - an unreachable LAN host
// can otherwise hang a request (and the UI's loading state) for minutes.
const REQUEST_TIMEOUT_MS = 15_000;

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Lets AuthProvider react to a session becoming invalid in any authenticated request, without every screen handling 401 itself. Returns an unsubscribe function. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

async function handleUnauthorized(tokenUsed: string): Promise<void> {
  // Only clear the token if it is still the one this request sent - a slow
  // request from a previous session must never wipe out the token of a
  // newer login that happened while it was in flight.
  if ((await getToken()) !== tokenUsed) {
    return;
  }
  await removeToken();
  unauthorizedListeners.forEach((listener) => listener());
}

/**
 * The single place the mobile app talks HTTP to the API: builds the URL from
 * API_BASE_URL, attaches the Bearer token, parses the JSON body, and turns
 * every failure into a value (never a thrown exception). Screens and API
 * modules never construct an Authorization header themselves.
 */
export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<ApiResult> {
  const { method = "GET", body, authenticated = true, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const token = authenticated ? await getToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined || isFormData ? (body as FormData | undefined) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return { kind: "network_error" };
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && token) {
    await handleUnauthorized(token);
  }

  const responseBody: unknown = await response.json().catch(() => null);
  return { kind: "response", status: response.status, body: responseBody };
}
