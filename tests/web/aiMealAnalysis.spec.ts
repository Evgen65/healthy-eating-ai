import path from "node:path";
import { test, expect } from "@playwright/test";
import { mockAuthenticatedSession } from "../helpers/webAuth";

// Committed under tests/fixtures (not a developer-local path) so the suite
// runs unmodified on any machine - same fixture used by the API/E2E suites.
const SAMPLE_PHOTO_PATH = path.join(__dirname, "../fixtures/sample-meal.jpg");

// The Meals page is a protected route (Milestone 14) - every test here
// needs a simulated session so ProtectedRoute doesn't redirect to /login
// before the AI Photo Analysis section under test ever renders.
test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page);
});

test.describe("AI Photo Analysis error handling", () => {
  test("shows a specific message when the backend reports no food detected", async ({ page }) => {
    // Route-intercepted rather than run against a real backend - this suite
    // starts only the web dev server (see playwright.config.ts) - and this
    // simulates the controlled 422 the API returns when no food/drink can
    // be identified in the photo (see mealAnalysisRoutes.ts), without any
    // live OpenAI call.
    await page.route("**/api/ai/meal-analysis", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "No food detected" }),
      }),
    );

    await page.goto("/meals");
    await expect(page.getByRole("heading", { name: "AI Photo Analysis" })).toBeVisible();

    await page.getByLabel("Meal photo").setInputFiles(SAMPLE_PHOTO_PATH);
    await page.getByRole("button", { name: "Analyze photo" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("No food detected in the selected image. Please choose a photo containing food.");

    // No AI estimate should ever be shown for a no-food response.
    await expect(page.getByRole("heading", { name: "AI meal estimate" })).not.toBeVisible();
  });
});

// Milestone 13C reliability UX - each of these backend responses is
// route-intercepted (no live OpenAI, no API server needed for this suite -
// see playwright.config.ts) and must produce its own specific, non-raw
// message while preserving the user's selection so they can retry without
// reselecting the file (see mealAnalysisRoutes.ts / mealAnalysisApi.ts for
// the corresponding backend/client contract).
const RELIABILITY_ERROR_SCENARIOS: Array<{
  label: string;
  status: number;
  body: { error: string };
  expectedMessage: string;
}> = [
  {
    label: "a temporary provider rate limit",
    status: 429,
    body: { error: "Meal analysis is temporarily rate limited" },
    expectedMessage: "Meal analysis is temporarily busy. Please try again shortly.",
  },
  {
    label: "a provider timeout",
    status: 504,
    body: { error: "Meal analysis timed out" },
    expectedMessage: "Meal analysis took too long. Please try again.",
  },
  {
    label: "a provider outage",
    status: 502,
    body: { error: "Meal analysis service is temporarily unavailable" },
    expectedMessage: "Meal analysis is temporarily unavailable. Please try again later.",
  },
  {
    label: "a missing provider configuration",
    status: 503,
    body: { error: "AI provider is not configured" },
    expectedMessage: "Meal analysis is currently unavailable.",
  },
];

test.describe("AI Photo Analysis reliability UX (Milestone 13C)", () => {
  for (const scenario of RELIABILITY_ERROR_SCENARIOS) {
    test(`shows a specific message and keeps the photo selected for retry after ${scenario.label}`, async ({
      page,
    }) => {
      await page.route("**/api/ai/meal-analysis", (route) =>
        route.fulfill({ status: scenario.status, contentType: "application/json", body: JSON.stringify(scenario.body) }),
      );

      await page.goto("/meals");
      await page.getByLabel("Meal photo").setInputFiles(SAMPLE_PHOTO_PATH);
      await page.getByRole("button", { name: "Analyze photo" }).click();

      const alert = page.getByRole("alert");
      await expect(alert).toBeVisible();
      await expect(alert).toHaveText(scenario.expectedMessage);

      // The selected photo/preview must survive the failure so the user
      // can press "Analyze photo" again without reselecting a file, and no
      // stale/partial AI estimate may appear.
      await expect(page.getByText(/^Selected: sample-meal\.jpg/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "AI meal estimate" })).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Analyze photo" })).toBeEnabled();
    });
  }
});
