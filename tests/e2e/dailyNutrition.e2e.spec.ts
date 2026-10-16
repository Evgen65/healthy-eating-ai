import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// The Web app's dev server proxies nothing - API calls go straight to the
// API server, which is a separate webServer entry in playwright.e2e.config.ts.
const API_BASE_URL = "http://localhost:4000";

interface NutritionRowValues {
  target: string;
  consumed: string;
  remaining: string;
}

// Scoped to each nutrient's own `role="group"` row (see
// NutritionSummaryCard), the same pattern profileToNutrition.e2e.spec.ts
// uses, so Target/Consumed/Remaining values that happen to collide in text
// still resolve to the correct row.
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

/**
 * Formats "now" for a `datetime-local` input. The Meals form parses that
 * value with `new Date(value)` (interpreted as local time) and converts it
 * to a UTC instant before sending it to the API - using the current local
 * time means the resulting instant is always "now", which is trivially
 * within today's UTC calendar day (the backend's documented "today", see
 * dayRangeCalculator.ts) at the moment the meal is saved.
 */
function nowAsDatetimeLocalValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

test.describe("Web E2E: daily nutrition after adding meals", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    // Registered on page.request (not the standalone `request` fixture) so
    // the session cookie lands in the SAME browser context the test then
    // navigates with - the SPA's own fetch calls need to see it too.
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-daily-nutrition", baseUrl: API_BASE_URL });
    userId = user.id;
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user sees consumed and negative remaining nutrition after adding meals", async ({ page }) => {
    // Phase 1 - create profile through the UI
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    await page.getByLabel("Age").fill("35");
    await page.getByLabel("Sex").selectOption("male");
    await page.getByLabel("Height (cm)").fill("180");
    await page.getByLabel("Weight (kg)").fill("85");
    await page.getByLabel("Activity level").selectOption("moderate");
    await page.getByLabel("Job type").selectOption("desk");
    await page.getByLabel("Workouts per week").fill("3");
    await page.getByLabel("Goal").selectOption("weight_loss");

    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile saved successfully")).toBeVisible();

    // Phase 2 - calculate the nutrition target
    await page.goto("/dashboard");
    await expect(page.getByText("Your nutrition target has not been calculated yet.")).toBeVisible();

    await page.getByRole("button", { name: "Calculate Nutrition Target" }).click();
    await expectNutritionRow(page, "Calories", { target: "2378 kcal", consumed: "0 kcal", remaining: "2378 kcal" });
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "0 g", remaining: "153 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "0 g", remaining: "68 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "0 g", remaining: "289 g" });

    // Phase 3 - add one meal through the UI that exceeds the calorie target
    await page.goto("/meals");
    await expect(page.getByRole("heading", { name: "Meals" })).toBeVisible();

    await page.getByRole("button", { name: "Add Meal" }).click();
    await page.getByLabel("Meal type").selectOption("lunch");
    await page.getByLabel("Eaten at").fill(nowAsDatetimeLocalValue());
    await page.getByLabel("Name (item 1)").fill("E2E high calorie meal");
    await page.getByLabel("Quantity (g) (item 1)").fill("500");
    await page.getByLabel("Calories (item 1)").fill("2500");
    await page.getByLabel("Protein (g) (item 1)").fill("160");
    await page.getByLabel("Fat (g) (item 1)").fill("80");
    await page.getByLabel("Carbohydrates (g) (item 1)").fill("300");

    await page.getByRole("button", { name: "Save Meal" }).click();
    await expect(page.getByText("Meal saved successfully")).toBeVisible();

    // Phase 4 - the Dashboard reflects consumed/negative remaining nutrition
    const expectedAfterMeal: Record<string, NutritionRowValues> = {
      Calories: { target: "2378 kcal", consumed: "2500 kcal", remaining: "-122 kcal" },
      Protein: { target: "153 g", consumed: "160 g", remaining: "-7 g" },
      Fat: { target: "68 g", consumed: "80 g", remaining: "-12 g" },
      Carbohydrates: { target: "289 g", consumed: "300 g", remaining: "-11 g" },
    };

    await page.goto("/dashboard");
    for (const [label, values] of Object.entries(expectedAfterMeal)) {
      await expectNutritionRow(page, label, values);
    }

    // Phase 5 - the values persist across a reload (Backend-derived, not just React state)
    await page.reload();
    for (const [label, values] of Object.entries(expectedAfterMeal)) {
      await expectNutritionRow(page, label, values);
    }
  });
});
