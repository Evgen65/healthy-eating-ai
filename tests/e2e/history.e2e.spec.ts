import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// The Web app's dev server proxies nothing - API calls go straight to the
// API server, which is a separate webServer entry in playwright.e2e.config.ts.
const API_BASE_URL = "http://localhost:4000";

const PROFILE = {
  age: 35,
  sex: "male",
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
  jobType: "desk",
  workoutsPerWeek: 3,
  goal: "weight_loss",
};

interface NutritionRowValues {
  target: string;
  consumed: string;
  remaining: string;
}

// Scoped to each nutrient's own `role="group"` row (see
// NutritionSummaryCard / profileToNutrition.e2e.spec.ts) so values that
// happen to collide in plain text still resolve to the correct row.
async function expectNutritionRow(page: Page, label: string, values: NutritionRowValues): Promise<void> {
  await expect(
    page.getByRole("group", { name: `${label} target` }).getByText(values.target, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: `${label} consumed` }).getByText(values.consumed, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: `${label} remaining` }).getByText(values.remaining, { exact: true }),
  ).toBeVisible();
}

test.describe("Web E2E: history review", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    // Registered on page.request (not the standalone `request` fixture) so
    // the session cookie lands in the SAME browser context the test then
    // navigates with - the SPA's own fetch calls need to see it too.
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-history", baseUrl: API_BASE_URL });
    userId = user.id;

    // Business setup goes through the public API (not the UI) - History
    // display and date switching is the feature under test here, and meal
    // creation through the Web UI is already covered by
    // dailyNutrition.e2e.spec.ts.
    const profileResponse = await page.request.post(`${API_BASE_URL}/api/me/profile`, { data: PROFILE });
    expect(profileResponse.status()).toBe(201);

    const calculateResponse = await page.request.post(`${API_BASE_URL}/api/me/nutrition-target/calculate`);
    expect(calculateResponse.status()).toBe(200);

    async function createMeal(
      mealType: string,
      eatenAtIso: string,
      item: { name: string; calories: number; proteinG: number; fatG: number; carbsG: number },
    ): Promise<void> {
      const response = await page.request.post(`${API_BASE_URL}/api/me/meals`, {
        data: { mealType, eatenAt: eatenAtIso, items: [item] },
      });
      expect(response.status()).toBe(201);
    }

    await createMeal("breakfast", "2026-09-10T08:00:00.000Z", {
      name: "Oatmeal",
      calories: 250,
      proteinG: 40,
      fatG: 5,
      carbsG: 10,
    });
    await createMeal("lunch", "2026-09-10T13:30:00.000Z", {
      name: "Chicken & Rice",
      calories: 480,
      proteinG: 51,
      fatG: 6,
      carbsG: 50,
    });
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user can review meal history and empty days", async ({ page }) => {
    // Phase 1 - open History and select the historical date with meals
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "History", level: 1 })).toBeVisible();

    await page.getByLabel("Date").fill("2026-09-10");
    await expect(page.getByRole("heading", { name: "Daily Summary" })).toBeVisible();

    // Phase 2 - Daily Summary matches the two meals' combined totals
    await expectNutritionRow(page, "Calories", { target: "2378 kcal", consumed: "730 kcal", remaining: "1648 kcal" });
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "91 g", remaining: "62 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "11 g", remaining: "57 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "60 g", remaining: "229 g" });

    // Phase 3 - both meals shown in chronological order (Breakfast before Lunch)
    const mealItems = page.locator(".history-meals-list__item");
    await expect(mealItems).toHaveCount(2);
    await expect(mealItems.nth(0).getByRole("heading", { name: "Breakfast" })).toBeVisible();
    await expect(mealItems.nth(0).getByText("250 kcal")).toBeVisible();
    await expect(mealItems.nth(1).getByRole("heading", { name: "Lunch" })).toBeVisible();
    await expect(mealItems.nth(1).getByText("480 kcal")).toBeVisible();

    // Phase 4 - switch to an empty historical date, without a full page reload
    await page.getByLabel("Date").fill("2026-09-11");
    await expect(page.getByText("No meals recorded for this date.")).toBeVisible();
    await expectNutritionRow(page, "Calories", { target: "2378 kcal", consumed: "0 kcal", remaining: "2378 kcal" });
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "0 g", remaining: "153 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "0 g", remaining: "68 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "0 g", remaining: "289 g" });

    // Phase 5 - switching back restores the historical meals and summary
    await page.getByLabel("Date").fill("2026-09-10");
    await expect(page.locator(".history-meals-list__item")).toHaveCount(2);
    await expectNutritionRow(page, "Calories", { target: "2378 kcal", consumed: "730 kcal", remaining: "1648 kcal" });

    // Phase 6 - a reload leaves the page functional (no persisted-date
    // requirement - it may fall back to its documented default date)
    await page.reload();
    await expect(page.getByRole("heading", { name: "History", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Date")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily Summary" })).toBeVisible();
  });
});
