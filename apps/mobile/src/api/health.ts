import { API_BASE_URL } from "../config/env";

export type BackendHealthResult =
  | { kind: "reachable"; status: string; service: string }
  | { kind: "unreachable" };

/**
 * Minimal, unauthenticated connectivity check against the API's existing
 * GET /health (see apps/api/src/routes/health.ts) - Milestone 16
 * verification only, not a general-purpose API client. Never throws: every
 * failure (network error, non-200 response, malformed body) collapses to
 * the same controlled `{ kind: "unreachable" }` so the calling screen can
 * show a plain "Backend unavailable" message instead of a raw exception
 * object or stack trace.
 */
export async function checkBackendHealth(): Promise<BackendHealthResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      return { kind: "unreachable" };
    }

    const body = (await response.json()) as { status?: unknown; service?: unknown };
    if (typeof body.status !== "string" || typeof body.service !== "string") {
      return { kind: "unreachable" };
    }

    return { kind: "reachable", status: body.status, service: body.service };
  } catch {
    // Covers a refused/timed-out connection, DNS failure, malformed JSON,
    // etc. - all of it means "not reachable right now" to the UI.
    return { kind: "unreachable" };
  }
}
