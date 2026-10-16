import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// The Web app's dev server proxies nothing - API calls go straight to the
// API server, which is a separate webServer entry in playwright.e2e.config.ts.
const API_BASE_URL = "http://localhost:4000";

interface DashboardValues {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// Scoped to each nutrient's "target" row (a `role="group"` labelled e.g.
// "Calories target"): the Dashboard now also shows Consumed/Remaining, and
// with no meals in this flow Remaining always equals Target, so an
// unscoped page-wide text match would be ambiguous.
async function expectDashboardValues(page: Page, values: DashboardValues): Promise<void> {
  await expect(
    page.getByRole("group", { name: "Calories target" }).getByText(`${values.calories} kcal`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Protein target" }).getByText(`${values.protein} g`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Fat target" }).getByText(`${values.fat} g`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Carbohydrates target" }).getByText(`${values.carbs} g`, { exact: true }),
  ).toBeVisible();
}

const INITIAL_TARGET: DashboardValues = { calories: 2378, protein: 153, fat: 68, carbs: 289 };
const RECALCULATED_TARGET: DashboardValues = { calories: 2798, protein: 136, fat: 68, carbs: 411 };

test.describe("Web E2E: profile to nutrition flow", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await registerTestUser(page.request, {
      emailPrefix: "e2e-profile-to-nutrition",
      baseUrl: API_BASE_URL,
    });
    userId = user.id;
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user can create profile, calculate nutrition target and recalculate after profile change", async ({
    page,
  }) => {
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

    // Phase 2 - calculate the nutrition target from the empty-target state
    await page.goto("/dashboard");
    await expect(page.getByText("Your nutrition target has not been calculated yet.")).toBeVisible();

    await page.getByRole("button", { name: "Calculate Nutrition Target" }).click();
    await expectDashboardValues(page, INITIAL_TARGET);

    // Phase 3 - values survive a reload (persisted via the API, not just React state)
    await page.reload();
    await expectDashboardValues(page, INITIAL_TARGET);

    // Phase 4 - change only the goal on the profile
    await page.goto("/profile");
    await expect(page.getByLabel("Age")).toHaveValue("35");
    await expect(page.getByLabel("Goal")).toHaveValue("weight_loss");

    await page.getByLabel("Goal").selectOption("maintain");
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByText("Profile saved successfully")).toBeVisible();

    // Phase 5 - the stored target must not change until an explicit recalculation
    await page.goto("/dashboard");
    await expectDashboardValues(page, INITIAL_TARGET);

    // Phase 6 - recalculate, updating in place without a manual reload
    await page.getByRole("button", { name: "Recalculate" }).click();
    await expectDashboardValues(page, RECALCULATED_TARGET);

    // Phase 7 - the recalculated values persist across a reload
    await page.reload();
    await expectDashboardValues(page, RECALCULATED_TARGET);
  });
});
