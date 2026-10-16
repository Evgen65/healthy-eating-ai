import path from "node:path";
import { test, expect, type Page, type Request } from "@playwright/test";
import { deleteTestUser, findMealsForUser, findMealItemsForMeal } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// The Web app's dev server proxies nothing - API calls go straight to the
// API server, which is a separate webServer entry in playwright.e2e.config.ts.
const API_BASE_URL = "http://localhost:4000";
const MEAL_ANALYSIS_URL = `${API_BASE_URL}/api/ai/meal-analysis`;
const MEAL_CREATE_URL = `${API_BASE_URL}/api/me/meals`;

// Committed under tests/fixtures (not a developer-local path) so the suite
// runs unmodified on any machine - see mealAnalysis.api.spec.ts for the
// same fixture used on the API side.
const SAMPLE_PHOTO_PATH = path.join(__dirname, "../fixtures/sample-meal.jpg");

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
// NutritionSummaryCard / other e2e specs) so values that happen to collide
// in plain text still resolve to the correct row.
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
 * Formats "now" for a `datetime-local` input, matching the exact strategy
 * dailyNutrition.e2e.spec.ts already uses: the Meals form parses this value
 * with `new Date(value)` (local time) and converts it to a UTC instant via
 * toISOString() before sending it, so using the current local time always
 * produces "now" - trivially within today's UTC calendar day (the
 * backend's documented "today", see dayRangeCalculator.ts) and within
 * today's local calendar day (the History page's default date), avoiding
 * an independent timezone interpretation in this test.
 */
function nowAsDatetimeLocalValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

test.describe("Web E2E: AI-assisted meal flow", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-ai-meal-flow", baseUrl: API_BASE_URL });
    userId = user.id;

    const profileResponse = await page.request.post(`${API_BASE_URL}/api/me/profile`, { data: PROFILE });
    expect(profileResponse.status()).toBe(201);

    const calculateResponse = await page.request.post(`${API_BASE_URL}/api/me/nutrition-target/calculate`);
    expect(calculateResponse.status()).toBe(200);
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user can analyze correct confirm and track an AI-assisted meal", async ({ page }) => {
    const analysisRequests: Request[] = [];
    const mealCreateRequests: Request[] = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") {
        return;
      }
      if (req.url() === MEAL_ANALYSIS_URL) {
        analysisRequests.push(req);
      } else if (req.url() === MEAL_CREATE_URL) {
        mealCreateRequests.push(req);
      }
    });

    // Phase 1 - open Meals: both entry points are present
    await page.goto("/meals");
    await expect(page.getByRole("heading", { name: "Meals", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Meal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Photo Analysis" })).toBeVisible();

    // Phase 2 - upload the fixture photo through the accessible file input
    await page.getByLabel("Meal photo").setInputFiles(SAMPLE_PHOTO_PATH);
    await expect(page.getByText(/^Selected: sample-meal\.jpg/)).toBeVisible();

    // Phase 3 - analyze the photo and wait for the observable UI result
    await page.getByRole("button", { name: "Analyze photo" }).click();
    await expect(page.getByRole("heading", { name: "AI meal estimate" })).toBeVisible();
    expect(analysisRequests).toHaveLength(1);
    expect(mealCreateRequests).toHaveLength(0);

    // Original Mock estimate - Chicken breast (item 1) and Rice (item 2)
    await expect(page.getByLabel("Name (AI item 1)")).toHaveValue("Chicken breast");
    await expect(page.getByLabel("Quantity in grams (AI item 1)")).toHaveValue("150");
    await expect(page.getByLabel("Calories (AI item 1)")).toHaveValue("250");
    await expect(page.getByLabel("Protein in grams (AI item 1)")).toHaveValue("46");
    await expect(page.getByLabel("Fat in grams (AI item 1)")).toHaveValue("5");
    await expect(page.getByLabel("Carbohydrates in grams (AI item 1)")).toHaveValue("0");

    await expect(page.getByLabel("Name (AI item 2)")).toHaveValue("Rice");
    await expect(page.getByLabel("Quantity in grams (AI item 2)")).toHaveValue("180");
    await expect(page.getByLabel("Calories (AI item 2)")).toHaveValue("230");
    await expect(page.getByLabel("Protein in grams (AI item 2)")).toHaveValue("5");
    await expect(page.getByLabel("Fat in grams (AI item 2)")).toHaveValue("1");
    await expect(page.getByLabel("Carbohydrates in grams (AI item 2)")).toHaveValue("50");

    const totals = page.locator(".ai-meal-estimate__totals");
    await expect(totals.getByText("480 kcal")).toBeVisible();
    await expect(totals).toContainText("Protein 51 g");
    await expect(totals).toContainText("Fat 6 g");
    await expect(totals).toContainText("Carbohydrates 50 g");

    // Phase 4 - correct item 2 (Rice -> Potatoes); item 1 is left untouched
    await page.getByLabel("Name (AI item 2)").fill("Potatoes");
    await page.getByLabel("Quantity in grams (AI item 2)").fill("200");
    await page.getByLabel("Calories (AI item 2)").fill("160");
    await page.getByLabel("Protein in grams (AI item 2)").fill("4");
    await page.getByLabel("Fat in grams (AI item 2)").fill("0");
    await page.getByLabel("Carbohydrates in grams (AI item 2)").fill("36");

    await expect(page.getByLabel("Name (AI item 1)")).toHaveValue("Chicken breast");
    await expect(page.getByLabel("Quantity in grams (AI item 1)")).toHaveValue("150");
    await expect(page.getByLabel("Calories (AI item 1)")).toHaveValue("250");
    await expect(page.getByLabel("Protein in grams (AI item 1)")).toHaveValue("46");
    await expect(page.getByLabel("Fat in grams (AI item 1)")).toHaveValue("5");
    await expect(page.getByLabel("Carbohydrates in grams (AI item 1)")).toHaveValue("0");

    await expect(totals.getByText("410 kcal")).toBeVisible();
    await expect(totals).toContainText("Protein 50 g");
    await expect(totals).toContainText("Fat 5 g");
    await expect(totals).toContainText("Carbohydrates 36 g");

    // Phase 5 - set meal metadata (same day-boundary strategy as
    // dailyNutrition.e2e.spec.ts - see nowAsDatetimeLocalValue above)
    await page.getByLabel("Meal type (AI meal)").selectOption("lunch");
    await page.getByLabel("Eaten at (AI meal)").fill(nowAsDatetimeLocalValue());

    // Phase 6 - confirm; rapid duplicate clicks must not create duplicate Meals
    const confirmButton = page.getByRole("button", { name: "Confirm meal" });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await expect(page.getByText("Meal saved successfully")).toBeVisible();
    expect(mealCreateRequests).toHaveLength(1);
    expect(analysisRequests).toHaveLength(1);

    const confirmBody = mealCreateRequests[0].postData() ?? "";
    expect(confirmBody).toContain("Chicken breast");
    expect(confirmBody).toContain("Potatoes");
    expect(confirmBody).not.toContain("Rice");

    // Phase 7 - transient AI state is cleared after a successful confirmation
    await expect(page.getByRole("heading", { name: "AI meal estimate" })).not.toBeVisible();
    await expect(page.getByText(/^Selected: sample-meal\.jpg/)).not.toBeVisible();

    // Phase 8 - the persisted Meal appears in the Meals list without a reload
    const mealListItems = page.locator(".meals-list__item");
    await expect(mealListItems).toHaveCount(1);
    await expect(mealListItems.first().getByRole("heading", { name: "Lunch" })).toBeVisible();
    await expect(mealListItems.first().getByText("410 kcal")).toBeVisible();
    await expect(mealListItems.first()).toContainText("Protein 50 g");
    await expect(mealListItems.first()).toContainText("Fat 5 g");
    await expect(mealListItems.first()).toContainText("Carbohydrates 36 g");

    // Phase 9 - DB verification: exactly one Meal for this flow, with the
    // corrected totals and exactly its two corrected items (no Rice)
    const dbMeals = await findMealsForUser(userId);
    expect(dbMeals).toHaveLength(1);
    const dbMeal = dbMeals[0];
    expect(dbMeal).toMatchObject({ mealType: "lunch", calories: 410, proteinG: 50, fatG: 5, carbsG: 36 });

    const dbItems = await findMealItemsForMeal(dbMeal.id);
    expect(dbItems).toHaveLength(2);
    expect(dbItems).toContainEqual({
      name: "Chicken breast",
      quantityG: 150,
      calories: 250,
      proteinG: 46,
      fatG: 5,
      carbsG: 0,
    });
    expect(dbItems).toContainEqual({
      name: "Potatoes",
      quantityG: 200,
      calories: 160,
      proteinG: 4,
      fatG: 0,
      carbsG: 36,
    });
    expect(dbItems.some((item) => item.name === "Rice")).toBe(false);

    // Phase 10 - Dashboard reflects the persisted totals
    const expectedConsumed: NutritionRowValues = { target: "2378 kcal", consumed: "410 kcal", remaining: "1968 kcal" };
    await page.goto("/dashboard");
    await expectNutritionRow(page, "Calories", expectedConsumed);
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "50 g", remaining: "103 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "5 g", remaining: "63 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "36 g", remaining: "253 g" });

    // Phase 11 - History for the same logical date (left at its own
    // default - "today" - rather than re-deriving the date independently
    // here) shows the same Lunch entry and daily totals
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "History", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily Summary" })).toBeVisible();

    const historyItems = page.locator(".history-meals-list__item");
    await expect(historyItems).toHaveCount(1);
    await expect(historyItems.first().getByRole("heading", { name: "Lunch" })).toBeVisible();
    await expect(historyItems.first().getByText("410 kcal")).toBeVisible();
    await expect(historyItems.first()).toContainText("Protein 50 g");
    await expect(historyItems.first()).toContainText("Fat 5 g");
    await expect(historyItems.first()).toContainText("Carbohydrates 36 g");

    await expectNutritionRow(page, "Calories", expectedConsumed);
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "50 g", remaining: "103 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "5 g", remaining: "63 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "36 g", remaining: "253 g" });

    // Phase 12 - a reload leaves the persisted values intact (Backend-
    // derived, not temporary React state)
    await page.reload();
    await expect(historyItems).toHaveCount(1);
    await expectNutritionRow(page, "Calories", expectedConsumed);
  });
});
