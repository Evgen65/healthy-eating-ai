import { test, expect } from "@playwright/test";
import { mockAuthenticatedSession } from "../helpers/webAuth";

test.describe("Dashboard smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
  });

  test("shows the Dashboard heading", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });

  test("shows an understandable error when the nutrition target API is unreachable", async ({ page }) => {
    // Force a network failure via routing rather than relying on the API
    // simply not being started - this keeps the test deterministic even
    // when a developer happens to have the API running locally too.
    await page.route("**/api/me/**", (route) => route.abort("connectionrefused"));
    await page.goto("/dashboard");

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("Unable to load nutrition target");
  });
});
