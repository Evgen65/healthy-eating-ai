import { randomUUID } from "node:crypto";
import { test, expect, type Request } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// Milestone 15F - double-submit regression coverage for the three forms that
// only guarded against a duplicate write with React state (`submitting` /
// `saving`), not a synchronously-checked ref. State set inside an event
// handler does not repaint the DOM (and therefore does not actually disable
// the button) until after the handler returns, so two clicks landing back to
// back in the same task - exactly what `button.evaluate` below simulates,
// unlike two separate Playwright `.click()` calls which each get a full
// round trip and comfortably let React re-render in between - both read the
// same pre-update `submitting`/`saving` value and both proceed. MealsPage's
// Add Meal/AI Confirm forms already guard with a ref (see submitInFlight/
// aiConfirmInFlight there, and aiMealFlow.e2e.spec.ts's own rapid-click
// coverage for AI Confirm) - this file is the same regression class for
// Register, Login and Profile save, which used to lack that ref guard.
const API_BASE_URL = "http://localhost:4000";

test.describe("Web E2E: double-submit prevention (Milestone 15F)", () => {
  test("rapid double-click on Register submit sends exactly one write", async ({ page }) => {
    const email = `e2e-dbl-register-${Date.now()}-${randomUUID()}@example.com`;
    let userId: string | undefined;

    try {
      const registerRequests: Request[] = [];
      page.on("request", (req) => {
        if (req.method() === "POST" && req.url().endsWith("/api/auth/register")) {
          registerRequests.push(req);
        }
      });

      await page.goto("/register");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("Str0ngDblSubmit1!");

      // Two synchronous clicks in the same task - see file header comment
      // for why this (not two separate Playwright .click() calls) is what
      // actually exercises the race.
      await page.getByRole("button", { name: "Register" }).evaluate((el) => {
        (el as HTMLButtonElement).click();
        (el as HTMLButtonElement).click();
      });

      await expect(page).toHaveURL(/\/dashboard/);
      expect(registerRequests).toHaveLength(1);

      const meResponse = await page.request.get(`${API_BASE_URL}/api/auth/me`);
      userId = (await meResponse.json()).id as string;
    } finally {
      if (userId) {
        await deleteTestUser(userId);
      }
    }
  });

  test("rapid double-click on Login submit sends exactly one write", async ({ page }) => {
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-dbl-login", baseUrl: API_BASE_URL });

    try {
      // Registration itself logs the user in - clear that cookie so the
      // Login form under test is actually reachable and unauthenticated.
      await page.request.post(`${API_BASE_URL}/api/auth/logout`);

      const loginRequests: Request[] = [];
      page.on("request", (req) => {
        if (req.method() === "POST" && req.url().endsWith("/api/auth/login")) {
          loginRequests.push(req);
        }
      });

      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);

      await page.getByRole("button", { name: "Log in" }).evaluate((el) => {
        (el as HTMLButtonElement).click();
        (el as HTMLButtonElement).click();
      });

      await expect(page).toHaveURL(/\/dashboard/);
      expect(loginRequests).toHaveLength(1);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rapid double-click on Profile save sends exactly one write", async ({ page }) => {
    const user = await registerTestUser(page.request, { emailPrefix: "e2e-dbl-profile", baseUrl: API_BASE_URL });

    try {
      const profileRequests: Request[] = [];
      page.on("request", (req) => {
        if (req.method() === "POST" && req.url().endsWith("/api/me/profile")) {
          profileRequests.push(req);
        }
      });

      await page.goto("/profile");
      await page.getByLabel("Age").fill("30");
      await page.getByLabel("Sex").selectOption("male");
      await page.getByLabel("Height (cm)").fill("180");
      await page.getByLabel("Weight (kg)").fill("80");
      await page.getByLabel("Activity level").selectOption("moderate");
      await page.getByLabel("Job type").selectOption("desk");
      await page.getByLabel("Workouts per week").fill("3");
      await page.getByLabel("Goal").selectOption("maintain");

      await page.getByRole("button", { name: "Save Profile" }).evaluate((el) => {
        (el as HTMLButtonElement).click();
        (el as HTMLButtonElement).click();
      });

      await expect(page.getByText("Profile saved successfully")).toBeVisible();
      // POST only - a second racing click that lands as a duplicate CREATE
      // would 409 (see profileService.ts's profile_exists), not silently
      // succeed as a second write, so this alone would already catch it;
      // asserting the request count catches it more directly.
      expect(profileRequests).toHaveLength(1);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
