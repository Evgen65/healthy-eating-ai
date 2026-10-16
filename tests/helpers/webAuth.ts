import type { Page } from "@playwright/test";

export interface MockAuthUser {
  id: string;
  email: string;
}

export const MOCK_AUTH_USER: MockAuthUser = { id: "00000000-0000-4000-8000-000000000001", email: "web-test@example.com" };

/**
 * The web-only Playwright suite runs with no live API server (see
 * playwright.config.ts - only `npm run dev:web` is started), so every
 * protected page is normally unreachable: AuthProvider's initial
 * GET /api/auth/me fails outright (nothing is listening on :4000) and
 * ProtectedRoute redirects to /login exactly as it would for a real
 * logged-out user. This intercepts that one request to simulate "already
 * logged in" for tests whose actual subject is a protected page's own
 * behavior, not the login/redirect flow itself (see
 * aiMealAnalysis.spec.ts's "no food" test for how it's used with a
 * follow-up route().
 */
export async function mockAuthenticatedSession(page: Page, user: MockAuthUser = MOCK_AUTH_USER): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }),
  );
}
