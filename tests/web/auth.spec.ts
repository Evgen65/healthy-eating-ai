import { test, expect, type Page, type Route } from "@playwright/test";
import { mockAuthenticatedSession, MOCK_AUTH_USER } from "../helpers/webAuth";

// This suite runs with no live API server (see playwright.config.ts) - every
// /api/auth/* call is route-intercepted to simulate the backend's documented
// contract (see authRoutes.ts) without a real database or bcrypt/JWT round
// trip. Backend behavior itself is covered by tests/api/auth.api.spec.ts.
//
// login/register are credentialed (`credentials: "include"`), cross-origin
// (page on :5173, API on :4000) POSTs with a `Content-Type: application/json`
// header - that combination is a non-"simple" CORS request, so the browser
// sends a real OPTIONS preflight first. It must be answered with the right
// Access-Control-* headers (matching what app.ts's real `cors()` middleware
// sends) or the browser rejects the whole exchange as a network error before
// the mocked POST response ever reaches application code.
const WEB_ORIGIN = "http://localhost:5173";

async function mockJsonRoute(page: Page, pattern: string, status: number, body: unknown): Promise<void> {
  await page.route(pattern, (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": WEB_ORIGIN,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
      return;
    }
    route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": WEB_ORIGIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(body),
    });
  });
}

test.describe("Login", () => {
  test("successful login redirects to the Dashboard", async ({ page }) => {
    await mockJsonRoute(page, "**/api/auth/login", 200, MOCK_AUTH_USER);

    await page.goto("/login");
    await page.getByLabel("Email").fill(MOCK_AUTH_USER.email);
    await page.getByLabel("Password").fill("Str0ngPassw0rd!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });

  test("invalid credentials show a controlled message and keep the user on the login page", async ({ page }) => {
    await mockJsonRoute(page, "**/api/auth/login", 401, { error: "Invalid email or password" });

    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Registration", () => {
  test("successful registration redirects to the Dashboard", async ({ page }) => {
    await mockJsonRoute(page, "**/api/auth/register", 201, MOCK_AUTH_USER);

    await page.goto("/register");
    await page.getByLabel("Email").fill(MOCK_AUTH_USER.email);
    await page.getByLabel("Password").fill("Str0ngPassw0rd!");
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });
});

test.describe("Logout", () => {
  test("logging out returns the user to the Login page", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockJsonRoute(page, "**/api/auth/logout", 200, {});

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });
});
