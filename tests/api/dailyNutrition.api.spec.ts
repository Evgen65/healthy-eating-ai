import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser, type RegisteredTestUser } from "../helpers/auth";
import { buildNutritionSummary } from "../../packages/shared/src/nutritionSummary";

const API_BASE_URL = "http://localhost:4000";

interface ProfileInput {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "very_active";
  jobType: "desk" | "mixed" | "physical";
  workoutsPerWeek: number;
  goal: "weight_loss" | "maintain" | "muscle_gain";
}

interface NutritionValues {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

interface NutritionSummary {
  date: string;
  target: NutritionValues;
  consumed: NutritionValues;
  remaining: NutritionValues;
}

interface MealItemInput {
  name: string;
  quantityG?: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Matches the CALC-01 case already verified deterministically in
// nutritionTarget.api.spec.ts - reused here as the fixed baseline target
// that consumed/remaining assertions are computed against.
const PROFILE: ProfileInput = {
  age: 35,
  sex: "male",
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
  jobType: "desk",
  workoutsPerWeek: 3,
  goal: "weight_loss",
};

const TARGET: NutritionValues = { calories: 2378, proteinG: 153, fatG: 68, carbsG: 289 };

const ZERO: NutritionValues = { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 };

// "Chicken + Rice" split across two items - totals 480/51/6/50.
const CHICKEN_AND_RICE: MealItemInput[] = [
  { name: "Chicken", quantityG: 150, calories: 280, proteinG: 45, fatG: 5, carbsG: 0 },
  { name: "Rice", quantityG: 150, calories: 200, proteinG: 6, fatG: 1, carbsG: 50 },
];

const PROTEIN_SHAKE: MealItemInput[] = [
  { name: "Protein shake", quantityG: 300, calories: 250, proteinG: 40, fatG: 5, carbsG: 10 },
];

const LARGE_MEAL: MealItemInput[] = [
  { name: "Large meal", quantityG: 800, calories: 2000, proteinG: 200, fatG: 100, carbsG: 100 },
];

/**
 * Registers a user and, through the public API on that same authenticated
 * context, creates a profile and the fixed PROFILE/TARGET nutrition target
 * above.
 */
async function createUserWithTarget(request: APIRequestContext): Promise<RegisteredTestUser> {
  const user = await registerTestUser(request);
  const profileResponse = await request.post("/api/me/profile", { data: PROFILE });
  expect(profileResponse.status()).toBe(201);

  const calculateResponse = await request.post("/api/me/nutrition-target/calculate");
  expect(calculateResponse.status()).toBe(200);

  return user;
}

async function getTodaySummary(request: APIRequestContext): Promise<NutritionSummary> {
  const response = await request.get("/api/me/nutrition/today");
  expect(response.status()).toBe(200);
  return (await response.json()) as NutritionSummary;
}

async function createMeal(request: APIRequestContext, eatenAtIso: string, items: MealItemInput[]): Promise<void> {
  const response = await request.post("/api/me/meals", {
    data: { mealType: "lunch", eatenAt: eatenAtIso, items },
  });
  expect(response.status()).toBe(201);
}

/**
 * "Today" is the backend's documented UTC calendar day (see
 * dayRangeCalculator.ts). `date` is that day's YYYY-MM-DD, taken from the
 * /nutrition/today response itself rather than re-derived independently,
 * so the test never disagrees with the backend about what "today" is.
 * Noon UTC keeps the instant safely inside the day regardless of when
 * during the day the test happens to run.
 */
function noonUtcIso(date: string): string {
  return `${date}T12:00:00.000Z`;
}

function previousUtcDate(date: string): string {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  return start.toISOString().slice(0, 10);
}

test.describe("Daily Nutrition API", () => {
  test("returns zero consumed nutrition when user has no meals today", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const summary = await getTodaySummary(request);

      expect(summary.target).toEqual(TARGET);
      expect(summary.consumed).toEqual(ZERO);
      expect(summary.remaining).toEqual(TARGET);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("includes a single meal's totals in consumed and remaining nutrition", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { date } = await getTodaySummary(request);
      await createMeal(request, noonUtcIso(date), CHICKEN_AND_RICE);

      const summary = await getTodaySummary(request);

      expect(summary.consumed).toEqual({ calories: 480, proteinG: 51, fatG: 6, carbsG: 50 });
      expect(summary.remaining).toEqual({ calories: 1898, proteinG: 102, fatG: 62, carbsG: 239 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("aggregates totals across two meals eaten today", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { date } = await getTodaySummary(request);
      await createMeal(request, noonUtcIso(date), CHICKEN_AND_RICE);
      await createMeal(request, noonUtcIso(date), PROTEIN_SHAKE);

      const summary = await getTodaySummary(request);

      expect(summary.consumed).toEqual({ calories: 730, proteinG: 91, fatG: 11, carbsG: 60 });
      expect(summary.remaining).toEqual({ calories: 1648, proteinG: 62, fatG: 57, carbsG: 229 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("excludes a meal eaten on the previous UTC day from today's totals", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { date } = await getTodaySummary(request);
      await createMeal(request, noonUtcIso(date), CHICKEN_AND_RICE);
      await createMeal(request, noonUtcIso(previousUtcDate(date)), PROTEIN_SHAKE);

      const summary = await getTodaySummary(request);

      expect(summary.consumed).toEqual({ calories: 480, proteinG: 51, fatG: 6, carbsG: 50 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("does not include another user's meals in today's totals", async ({ request }) => {
    // Real isolation, not merely "a different id passed in the URL": user B
    // is a second, independently authenticated session on its own request
    // context - nothing about user A's context ever names user B's id.
    const userA = await createUserWithTarget(request);
    const contextB = await playwrightRequest.newContext({ baseURL: API_BASE_URL });

    try {
      const userB = await registerTestUser(contextB, { emailPrefix: "daily-nutrition-b" });

      const { date } = await getTodaySummary(request);
      await createMeal(request, noonUtcIso(date), CHICKEN_AND_RICE);
      await createMeal(contextB, noonUtcIso(date), LARGE_MEAL);

      const summary = await getTodaySummary(request);

      expect(summary.consumed).toEqual({ calories: 480, proteinG: 51, fatG: 6, carbsG: 50 });

      await deleteTestUser(userB.id);
    } finally {
      await contextB.dispose();
      await deleteTestUser(userA.id);
    }
  });
});

test.describe("Nutrition summary normalization", () => {
  test("remaining = target - consumed is normalized (70 - 40.3 -> 29.7, whole calories)", () => {
    // Precondition: plain JS subtraction really does produce the artifact.
    expect(70 - 40.3).not.toBe(29.7);

    const summary = buildNutritionSummary(
      "2026-09-26",
      { calories: 2000, proteinG: 150, fatG: 70, carbsG: 250 },
      { calories: 1234.6, proteinG: 40.3, fatG: 40.3, carbsG: 0.1 + 0.2 },
    );

    expect(summary.remaining).toEqual({ calories: 765, proteinG: 109.7, fatG: 29.7, carbsG: 249.7 });
    expect(summary.consumed).toEqual({ calories: 1235, proteinG: 40.3, fatG: 40.3, carbsG: 0.3 });
    expect(typeof summary.remaining.fatG).toBe("number");
  });

  test("Dashboard, History and Recommendations never expose a floating-point artifact", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { date } = await getTodaySummary(request);
      // TARGET.fatG is 68 and 68 - 38.3 === 29.700000000000003 in plain JS.
      expect(TARGET.fatG - 38.3).not.toBe(29.7);
      await createMeal(request, noonUtcIso(date), [
        { name: "Nuts", calories: 400, proteinG: 12.3, fatG: 38.3, carbsG: 10.1 },
      ]);

      const expectedRemaining = { calories: 1978, proteinG: 140.7, fatG: 29.7, carbsG: 278.9 };

      const today = await getTodaySummary(request);
      expect(today.remaining).toEqual(expectedRemaining);

      const historyResponse = await request.get(`/api/me/history/daily?date=${date}`);
      expect(historyResponse.status()).toBe(200);
      const history = (await historyResponse.json()) as NutritionSummary;
      expect(history.remaining).toEqual(expectedRemaining);

      const recommendationsResponse = await request.get("/api/me/recommendations/today");
      expect(recommendationsResponse.status()).toBe(200);
      const recommendationsText = await recommendationsResponse.text();
      expect(recommendationsText).toContain("You have 29.7 g of fat remaining today.");
      expect(recommendationsText).not.toMatch(/\d\.\d{2,}/);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
