import { test, expect, type Page, type Locator } from "@playwright/test";
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
// NutritionSummaryCard / dailyNutrition.e2e.spec.ts) so values that happen
// to collide in plain text still resolve to the correct row.
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

// Recommendation cards are the only <li> elements inside <main> (the
// sidebar's own nav items are a separate <ul> outside it), so scoping to
// the main landmark's list items gives DOM-order access to them without
// resorting to a CSS class selector.
function recommendationItems(page: Page): Locator {
  return page.getByRole("main").getByRole("listitem");
}

test.describe("Web E2E: recommendations", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-recommendations", baseUrl: API_BASE_URL });
    userId = user.id;

    const profileResponse = await page.request.post(`${API_BASE_URL}/api/me/profile`, { data: PROFILE });
    expect(profileResponse.status()).toBe(201);

    const calculateResponse = await page.request.post(`${API_BASE_URL}/api/me/nutrition-target/calculate`);
    expect(calculateResponse.status()).toBe(200);
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user sees updated daily recommendations after nutrition changes", async ({ page }) => {
    // Phase 1 - initial state, no meals today
    await page.goto("/recommendations");
    await expect(page.getByRole("heading", { name: "Recommendations", level: 1 })).toBeVisible();

    await expectNutritionRow(page, "Calories", { target: "2378 kcal", consumed: "0 kcal", remaining: "2378 kcal" });
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "0 g", remaining: "153 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "0 g", remaining: "68 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "0 g", remaining: "289 g" });

    const items = recommendationItems(page);
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText("You have 2378 kcal remaining today.");
    await expect(items.nth(1)).toContainText("You still need about 153 g of protein today.");
    await expect(items.nth(2)).toContainText("You have 68 g of fat remaining today.");
    await expect(items.nth(3)).toContainText("You have 289 g of carbohydrates remaining today.");

    // Phase 2 - create today's meal through the public API (meal creation
    // via the Web UI is already covered by dailyNutrition.e2e.spec.ts; this
    // test stays focused on Recommendations).
    const mealResponse = await page.request.post(`${API_BASE_URL}/api/me/meals`, {
      data: {
        mealType: "lunch",
        eatenAt: new Date().toISOString(),
        items: [{ name: "E2E recommendations meal", calories: 2500, proteinG: 100, fatG: 50, carbsG: 200 }],
      },
    });
    expect(mealResponse.status()).toBe(201);

    // Phase 3 - navigate away and back using normal in-app navigation
    // rather than injecting React state.
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations", level: 1 })).toBeVisible();

    await expectNutritionRow(page, "Calories", { target: "2378 kcal", consumed: "2500 kcal", remaining: "-122 kcal" });
    await expectNutritionRow(page, "Protein", { target: "153 g", consumed: "100 g", remaining: "53 g" });
    await expectNutritionRow(page, "Fat", { target: "68 g", consumed: "50 g", remaining: "18 g" });
    await expectNutritionRow(page, "Carbohydrates", { target: "289 g", consumed: "200 g", remaining: "89 g" });

    // Phase 4 - recommendation cards in calorie/protein/fat/carbohydrate
    // order, with user-visible warning/info labels (never internal codes)
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText("Warning");
    await expect(items.nth(0)).toContainText("You have exceeded today's calorie target by 122 kcal.");
    await expect(items.nth(1)).toContainText("Info");
    await expect(items.nth(1)).toContainText("You still need about 53 g of protein today.");
    await expect(items.nth(2)).toContainText("Info");
    await expect(items.nth(2)).toContainText("You have 18 g of fat remaining today.");
    await expect(items.nth(3)).toContainText("Info");
    await expect(items.nth(3)).toContainText("You have 89 g of carbohydrates remaining today.");

    // Phase 5 - a reload leaves the same data in place (Backend-derived,
    // not just React state)
    await page.reload();
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText("You have exceeded today's calorie target by 122 kcal.");

    // Phase 6 - the sidebar reflects Recommendations as the active page
    await expect(page.getByRole("link", { name: "Recommendations" })).toHaveClass(/nav-link--active/);
  });
});
