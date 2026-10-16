import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

export interface RegisteredTestUser {
  id: string;
  email: string;
  password: string;
}

// Deliberately not milestone-min-length-only (8) but comfortably above it -
// this is a fixed, non-secret test password shared by every registered
// test user, never meant to guard anything real.
const TEST_PASSWORD = "Str0ngTestPassw0rd!";

/**
 * Registers a brand-new user with a unique, collision-proof email through
 * the real POST /api/auth/register endpoint - never a direct DB insert -
 * so the given request context's cookie jar ends up holding a genuine
 * session exactly the way a real user's browser would after signing up.
 * Safe under fully-parallel workers: `Date.now()` + a UUID means no two
 * calls, even from different workers in the same millisecond, ever produce
 * the same email.
 *
 * `baseUrl` is required when `request` belongs to a browser context whose
 * own baseURL points at the Web origin (e.g. `page.request` in an E2E
 * spec) - the API lives on a different origin there. API-level specs can
 * omit it since their `request` fixture's baseURL already IS the API.
 */
export async function registerTestUser(
  request: APIRequestContext,
  options: { emailPrefix?: string; baseUrl?: string } = {},
): Promise<RegisteredTestUser> {
  const emailPrefix = options.emailPrefix ?? "qa";
  const baseUrl = options.baseUrl ?? "";
  const email = `${emailPrefix}-${Date.now()}-${randomUUID()}@example.com`;

  const response = await request.post(`${baseUrl}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  if (response.status() !== 201) {
    throw new Error(
      `registerTestUser: expected 201 from /api/auth/register for ${email}, got ${response.status()}`,
    );
  }

  const body = await response.json();
  return { id: body.id as string, email, password: TEST_PASSWORD };
}

/** Logs an already-registered user in on the given request context - used to prove a second, independent context can authenticate as the same user, or to re-authenticate after a logout. */
export async function loginTestUser(
  request: APIRequestContext,
  email: string,
  password: string,
  baseUrl = "",
): Promise<{ status: number; body: unknown }> {
  const response = await request.post(`${baseUrl}/api/auth/login`, { data: { email, password } });
  return { status: response.status(), body: await response.json().catch(() => null) };
}
