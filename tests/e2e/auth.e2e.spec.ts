import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";

const API_BASE_URL = "http://localhost:4000";
const TEST_PASSWORD = "Str0ngE2ePassw0rd!";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID()}@example.com`;
}

test.describe("Web E2E: authentication business flow", () => {
  test("register, view own meal, log out, and lose access to protected routes", async ({ page }) => {
    const email = uniqueEmail("e2e-auth-flow");
    let userId: string | undefined;

    try {
      // Phase 1 - register through the real UI form
      await page.goto("/register");
      await expect(page.getByRole("heading", { name: "Register" })).toBeVisible();

      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Register" }).click();

      // Registration logs the user in immediately and lands on the Dashboard.
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();

      const meResponse = await page.request.get(`${API_BASE_URL}/api/auth/me`);
      expect(meResponse.status()).toBe(200);
      userId = (await meResponse.json()).id as string;

      // Phase 2 - create and view a meal that belongs to this account
      await page.goto("/meals");
      await expect(page.getByRole("heading", { name: "Meals", level: 1 })).toBeVisible();
      await expect(page.getByText("No meals recorded yet.")).toBeVisible();

      await page.getByRole("button", { name: "Add Meal" }).click();
      await page.getByLabel("Meal type").selectOption("breakfast");
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      await page
        .getByLabel("Eaten at")
        .fill(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
      await page.getByLabel("Name (item 1)").fill("E2E auth-flow meal");
      await page.getByLabel("Calories (item 1)").fill("300");
      await page.getByLabel("Protein (g) (item 1)").fill("20");
      await page.getByLabel("Fat (g) (item 1)").fill("10");
      await page.getByLabel("Carbohydrates (g) (item 1)").fill("30");
      await page.getByRole("button", { name: "Save Meal" }).click();

      await expect(page.getByText("Meal saved successfully")).toBeVisible();
      const mealListItems = page.locator(".meals-list__item");
      await expect(mealListItems).toHaveCount(1);
      await expect(mealListItems.first().getByRole("heading", { name: "Breakfast" })).toBeVisible();

      // Phase 3 - log out
      await page.getByRole("button", { name: "Log out" }).click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

      // Phase 4 - protected routes are unavailable after logout
      await page.goto("/meals");
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    } finally {
      if (userId) {
        await deleteTestUser(userId);
      }
    }
  });

  test("user A's meal is never visible to user B", async ({ browser }) => {
    const emailA = uniqueEmail("e2e-isolation-a");
    const emailB = uniqueEmail("e2e-isolation-b");
    let userIdA: string | undefined;
    let userIdB: string | undefined;

    // Two fully independent browser contexts - separate cookie jars, exactly
    // like two different people on two different computers. Nothing here
    // shares state except the same real backend and database.
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      await pageA.goto("/register");
      await pageA.getByLabel("Email").fill(emailA);
      await pageA.getByLabel("Password").fill(TEST_PASSWORD);
      await pageA.getByRole("button", { name: "Register" }).click();
      await expect(pageA).toHaveURL(/\/dashboard/);

      const meResponseA = await pageA.request.get(`${API_BASE_URL}/api/auth/me`);
      userIdA = (await meResponseA.json()).id as string;

      await pageA.goto("/meals");
      await pageA.getByRole("button", { name: "Add Meal" }).click();
      await pageA.getByLabel("Meal type").selectOption("dinner");
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      await pageA
        .getByLabel("Eaten at")
        .fill(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
      await pageA.getByLabel("Name (item 1)").fill("User A's private meal");
      await pageA.getByLabel("Calories (item 1)").fill("400");
      await pageA.getByLabel("Protein (g) (item 1)").fill("25");
      await pageA.getByLabel("Fat (g) (item 1)").fill("15");
      await pageA.getByLabel("Carbohydrates (g) (item 1)").fill("35");
      await pageA.getByRole("button", { name: "Save Meal" }).click();
      await expect(pageA.getByText("Meal saved successfully")).toBeVisible();

      // User B - a completely separate session/context
      const pageB = await contextB.newPage();
      await pageB.goto("/register");
      await pageB.getByLabel("Email").fill(emailB);
      await pageB.getByLabel("Password").fill(TEST_PASSWORD);
      await pageB.getByRole("button", { name: "Register" }).click();
      await expect(pageB).toHaveURL(/\/dashboard/);

      const meResponseB = await pageB.request.get(`${API_BASE_URL}/api/auth/me`);
      userIdB = (await meResponseB.json()).id as string;

      await pageB.goto("/meals");
      await expect(pageB.getByRole("heading", { name: "Meals", level: 1 })).toBeVisible();
      await expect(pageB.getByText("No meals recorded yet.")).toBeVisible();
      await expect(pageB.locator(".meals-list__item")).toHaveCount(0);
      await expect(pageB.getByText("User A's private meal")).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
      if (userIdA) {
        await deleteTestUser(userIdA);
      }
      if (userIdB) {
        await deleteTestUser(userIdB);
      }
    }
  });
});
