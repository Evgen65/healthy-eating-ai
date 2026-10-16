import { test, expect } from "@playwright/test";
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

test.describe("Web E2E: weekly meal plan", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-weekly-plan", baseUrl: API_BASE_URL });
    userId = user.id;

    // Business setup goes through the public API (not the UI) - the Plan
    // page and week switching is the feature under test here.
    const profileResponse = await page.request.post(`${API_BASE_URL}/api/me/profile`, { data: PROFILE });
    expect(profileResponse.status()).toBe(201);

    const calculateResponse = await page.request.post(`${API_BASE_URL}/api/me/nutrition-target/calculate`);
    expect(calculateResponse.status()).toBe(200);
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("user can view the weekly plan and switching weeks keeps a shared calendar date's recipes stable", async ({
    page,
  }) => {
    const mealsBeforeResponse = await page.request.get(`${API_BASE_URL}/api/me/meals`);
    expect(mealsBeforeResponse.status()).toBe(200);
    const mealsBeforeCount = (await mealsBeforeResponse.json()).length;

    // Phase 1 - open Plan and select the first target week
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "Weekly Meal Plan", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Week start")).toBeVisible();

    await page.getByLabel("Week start").fill("2026-09-21");
    await expect(page.getByText("Week: 2026-09-21 — 2026-09-27")).toBeVisible();

    // Phase 2 - daily target and generic notice are rendered from the Backend
    const targetSection = page.locator(".plan-page__target");
    await expect(targetSection.getByRole("heading", { name: "Daily nutrition target" })).toBeVisible();
    await expect(targetSection).toContainText("2378 kcal");
    await expect(targetSection).toContainText("153 g");
    await expect(targetSection).toContainText("68 g");
    await expect(targetSection).toContainText("289 g");

    await expect(
      page.getByText("Generic meal plan template; does not account for allergies or medical dietary needs."),
    ).toBeVisible();

    // Phase 3 - exactly 7 day cards, first one is the requested startDate
    const dayCards = page.locator(".plan-day-card");
    await expect(dayCards).toHaveCount(7);

    const firstDay = dayCards.first();
    await expect(firstDay.locator(".plan-day-card__date")).toHaveText("2026-09-21");
    await expect(firstDay.getByRole("heading", { name: "Monday", level: 2 })).toBeVisible();

    // Phase 4 - exactly 4 meals per day, in the fixed Breakfast/Lunch/Dinner/Snack order
    const firstDayMeals = firstDay.locator(".plan-meal");
    await expect(firstDayMeals).toHaveCount(4);
    await expect(firstDayMeals.nth(0).getByRole("heading", { level: 3 })).toHaveText("Breakfast");
    await expect(firstDayMeals.nth(1).getByRole("heading", { level: 3 })).toHaveText("Lunch");
    await expect(firstDayMeals.nth(2).getByRole("heading", { level: 3 })).toHaveText("Dinner");
    await expect(firstDayMeals.nth(3).getByRole("heading", { level: 3 })).toHaveText("Snack");

    // Phase 5 - at least one recipe title/ingredient render, and daily
    // totals/difference sections are present
    await expect(firstDayMeals.first().locator(".plan-meal__title")).not.toHaveText("");
    await expect(firstDayMeals.first().locator(".plan-meal__ingredients li").first()).toBeVisible();
    await expect(firstDay.getByRole("heading", { name: "Daily planned totals" })).toBeVisible();
    await expect(firstDay.getByRole("heading", { name: "Difference from target" })).toBeVisible();

    // Phase 6 - capture the full rendering of 2026-09-23 (the Wednesday of
    // this first week) so the next week's rendering of the same calendar
    // date can be compared against it, instead of duplicating the recipe
    // catalog in this test.
    const week1Day23 = dayCards.filter({ hasText: "2026-09-23" });
    await expect(week1Day23).toHaveCount(1);
    const week1Day23Text = await week1Day23.innerText();

    // Phase 7 - switch to an overlapping week via the date input (no full
    // page reload) and confirm the header updates
    await page.getByLabel("Week start").fill("2026-09-23");
    await expect(page.getByText("Week: 2026-09-23 — 2026-09-29")).toBeVisible();

    const week2Cards = page.locator(".plan-day-card");
    await expect(week2Cards).toHaveCount(7);
    await expect(week2Cards.first().locator(".plan-day-card__date")).toHaveText("2026-09-23");

    // Phase 8 - the calendar date shared by both weekly requests renders
    // identically - proves recipe selection depends on the date, not on the
    // day's position within the requested week.
    const week2Day23Text = await week2Cards.first().innerText();
    expect(week2Day23Text).toBe(week1Day23Text);

    // Phase 9 - viewing/switching the plan never creates a real Meal
    const mealsAfterResponse = await page.request.get(`${API_BASE_URL}/api/me/meals`);
    expect(mealsAfterResponse.status()).toBe(200);
    const mealsAfterCount = (await mealsAfterResponse.json()).length;
    expect(mealsAfterCount).toBe(mealsBeforeCount);
  });
});
