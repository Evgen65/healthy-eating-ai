import { test, expect } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// The Web app's dev server proxies nothing - API calls go straight to the
// API server, which is a separate webServer entry in playwright.e2e.config.ts.
const API_BASE_URL = "http://localhost:4000";

// Produces the exact 3156 kcal / 176g protein / 70g fat / 456g carbs daily
// target that the reference Shopping List quantities asserted below
// (Chicken breast 1719 g, Eggs 12 pcs, Potatoes 2412 g, 16 items) were
// manually verified against during Milestone 12A/12B - see
// shoppingList.api.spec.ts's REFERENCE_PROFILE for the same fixture.
const PROFILE = {
  age: 30,
  sex: "female",
  heightCm: 180,
  weightKg: 88,
  activityLevel: "very_active",
  jobType: "mixed",
  workoutsPerWeek: 2,
  goal: "muscle_gain",
};

test.describe("Web E2E: weekly shopping list", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-shopping-list", baseUrl: API_BASE_URL });
    userId = user.id;

    // Business setup goes through the public API (not the UI) - the
    // Shopping page and week switching is the feature under test here.
    const profileResponse = await page.request.post(`${API_BASE_URL}/api/me/profile`, { data: PROFILE });
    expect(profileResponse.status()).toBe(201);

    const calculateResponse = await page.request.post(`${API_BASE_URL}/api/me/nutrition-target/calculate`);
    expect(calculateResponse.status()).toBe(200);
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user can view the weekly shopping list and switching weeks reloads it without a full page reload", async ({
    page,
  }) => {
    const mealsBeforeResponse = await page.request.get(`${API_BASE_URL}/api/me/meals`);
    expect(mealsBeforeResponse.status()).toBe(200);
    const mealsBeforeCount = (await mealsBeforeResponse.json()).length;

    // Phase 1 - open Shopping and select the reference week
    await page.goto("/shopping");
    await expect(page.getByRole("heading", { name: "Weekly Shopping List", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Week start")).toBeVisible();

    await page.getByLabel("Week start").fill("2026-09-21");
    await expect(page.getByText("Week: 2026-09-21 — 2026-09-27")).toBeVisible();

    // Phase 2 - total item count and Backend notice are rendered
    await expect(page.getByText("16 items")).toBeVisible();
    await expect(page.getByText("Generated from the weekly meal plan.")).toBeVisible();

    // Phase 3 - reference items render with their Backend quantity/unit
    const itemsList = page.locator(".shopping-page__items");
    await expect(itemsList.locator(".shopping-item")).toHaveCount(16);

    const chickenBreast = itemsList.locator(".shopping-item").filter({ hasText: "Chicken breast" });
    await expect(chickenBreast).toContainText("1719 g");

    const eggs = itemsList.locator(".shopping-item").filter({ hasText: "Eggs" });
    await expect(eggs).toContainText("12 pcs");

    const potatoes = itemsList.locator(".shopping-item").filter({ hasText: "Potatoes" });
    await expect(potatoes).toContainText("2412 g");

    // Phase 4 - ordering matches the Backend's deterministic alphabetical
    // sort (captured once here rather than duplicating the full reference
    // list already covered by shoppingList.api.spec.ts).
    const firstItemName = await itemsList.locator(".shopping-item").first().locator(".shopping-item__name").innerText();
    expect(firstItemName).toBe("Chicken breast");

    // Phase 5 - switch to an overlapping week via the date input (no full
    // page reload) and confirm the header/list update
    await page.getByLabel("Week start").fill("2026-09-23");
    await expect(page.getByText("Week: 2026-09-23 — 2026-09-29")).toBeVisible();
    await expect(itemsList.locator(".shopping-item")).toHaveCount(16);

    // Phase 6 - viewing/switching the shopping list never creates a real Meal
    const mealsAfterResponse = await page.request.get(`${API_BASE_URL}/api/me/meals`);
    expect(mealsAfterResponse.status()).toBe(200);
    const mealsAfterCount = (await mealsAfterResponse.json()).length;
    expect(mealsAfterCount).toBe(mealsBeforeCount);
  });
});
