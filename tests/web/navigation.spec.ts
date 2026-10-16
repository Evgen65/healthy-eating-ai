import { test, expect } from "@playwright/test";
import { mockAuthenticatedSession } from "../helpers/webAuth";

test.describe("Navigation smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
  });

  test("root redirects to /dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("sidebar shows all navigation links", async ({ page }) => {
    await page.goto("/dashboard");

    for (const label of ["Dashboard", "Meals", "History", "Plan", "Shopping", "Profile"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("navigates to Meals", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Meals" }).click();

    await expect(page).toHaveURL(/\/meals/);
    await expect(page.getByRole("heading", { name: "Meals" })).toBeVisible();
  });

  test("navigates to History", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "History" }).click();

    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  });

  const remainingRoutes = [
    { label: "Plan", path: "/plan" },
    { label: "Shopping", path: "/shopping" },
    { label: "Profile", path: "/profile" },
  ];

  for (const { label, path } of remainingRoutes) {
    test(`navigates to ${label}`, async ({ page }) => {
      await page.goto("/dashboard");
      await page.getByRole("link", { name: label }).click();

      await expect(page).toHaveURL(new RegExp(path));
      // level: 1 disambiguates from nested content headings that may
      // legitimately contain the nav label as a substring (e.g. Plan's
      // "Daily planned totals" contains "Plan") - see dashboard.spec.ts /
      // recommendations.e2e.spec.ts for the same convention.
      await expect(page.getByRole("heading", { name: label, level: 1 })).toBeVisible();
    });
  }

  test("unknown route shows Not Found page with a way back to Dashboard", async ({ page }) => {
    await page.goto("/something-that-does-not-exist");

    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const backLink = page.getByRole("link", { name: "Back to Dashboard" });
    await expect(backLink).toBeVisible();

    await backLink.click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

test.describe("Navigation smoke tests: unauthenticated", () => {
  // No mockAuthenticatedSession here - GET /api/auth/me fails outright
  // (no API server in this suite), so AuthProvider settles into "logged
  // out" exactly like a real expired/missing session would.
  test("unauthenticated visitor is redirected to /login for any protected route", async ({ page }) => {
    await page.goto("/meals");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });
});
