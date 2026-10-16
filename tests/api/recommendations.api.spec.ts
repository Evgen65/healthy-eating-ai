import { test, expect, type APIRequestContext } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser, type RegisteredTestUser } from "../helpers/auth";

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

interface MealItemInput {
  name: string;
  quantityG?: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

interface NutritionRecommendation {
  code: string;
  level: "info" | "warning";
  message: string;
}

// Matches the CALC-01 case already verified deterministically in
// nutritionTarget.api.spec.ts - reused here as the fixed baseline target
// that consumed/remaining/recommendation assertions are computed against.
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

/**
 * "Today" is the backend's documented UTC calendar day (see
 * dayRangeCalculator.ts), taken from the /nutrition/today response itself
 * rather than re-derived independently, so this suite never disagrees with
 * the backend about what "today" is.
 */
async function getTodayDate(request: APIRequestContext): Promise<string> {
  const response = await request.get("/api/me/nutrition/today");
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.date as string;
}

/**
 * Noon UTC keeps the instant safely inside the day regardless of when
 * during the day the test happens to run.
 */
function noonUtcIso(date: string): string {
  return `${date}T12:00:00.000Z`;
}

async function createMeal(request: APIRequestContext, eatenAtIso: string, items: MealItemInput[]): Promise<void> {
  const response = await request.post("/api/me/meals", {
    data: { mealType: "lunch", eatenAt: eatenAtIso, items },
  });
  expect(response.status()).toBe(201);
}

async function getTodayRecommendations(
  request: APIRequestContext,
): Promise<{ status: number; body: { summary: { target: NutritionValues; consumed: NutritionValues; remaining: NutritionValues }; recommendations: NutritionRecommendation[] } }> {
  const response = await request.get("/api/me/recommendations/today");
  return { status: response.status(), body: await response.json() };
}

test.describe("Recommendations API", () => {
  test("returns full remaining recommendations when user has no meals today", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { status, body } = await getTodayRecommendations(request);

      expect(status).toBe(200);
      expect(body.summary.target).toEqual(TARGET);
      expect(body.summary.consumed).toEqual(ZERO);
      expect(body.summary.remaining).toEqual(TARGET);

      expect(body.recommendations).toEqual([
        { code: "CALORIES_REMAINING", level: "info", message: "You have 2378 kcal remaining today." },
        { code: "PROTEIN_REMAINING", level: "info", message: "You still need about 153 g of protein today." },
        { code: "FAT_REMAINING", level: "info", message: "You have 68 g of fat remaining today." },
        { code: "CARBS_REMAINING", level: "info", message: "You have 289 g of carbohydrates remaining today." },
      ]);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns mixed exceeded and remaining recommendation states", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const date = await getTodayDate(request);
      await createMeal(request, noonUtcIso(date), [
        { name: "Mixed meal", calories: 2500, proteinG: 100, fatG: 50, carbsG: 200 },
      ]);

      const { status, body } = await getTodayRecommendations(request);

      expect(status).toBe(200);
      expect(body.summary.consumed).toEqual({ calories: 2500, proteinG: 100, fatG: 50, carbsG: 200 });
      expect(body.summary.remaining).toEqual({ calories: -122, proteinG: 53, fatG: 18, carbsG: 89 });

      expect(body.recommendations).toEqual([
        {
          code: "CALORIES_EXCEEDED",
          level: "warning",
          message: "You have exceeded today's calorie target by 122 kcal.",
        },
        { code: "PROTEIN_REMAINING", level: "info", message: "You still need about 53 g of protein today." },
        { code: "FAT_REMAINING", level: "info", message: "You have 18 g of fat remaining today." },
        { code: "CARBS_REMAINING", level: "info", message: "You have 89 g of carbohydrates remaining today." },
      ]);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns target met recommendations when macros are exceeded", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const date = await getTodayDate(request);
      await createMeal(request, noonUtcIso(date), [
        { name: "Large meal", calories: 2500, proteinG: 160, fatG: 80, carbsG: 300 },
      ]);

      const { status, body } = await getTodayRecommendations(request);

      expect(status).toBe(200);
      expect(body.summary.remaining).toEqual({ calories: -122, proteinG: -7, fatG: -12, carbsG: -11 });

      expect(body.recommendations).toEqual([
        {
          code: "CALORIES_EXCEEDED",
          level: "warning",
          message: "You have exceeded today's calorie target by 122 kcal.",
        },
        { code: "PROTEIN_TARGET_MET", level: "info", message: "You have met today's protein target." },
        { code: "FAT_TARGET_MET", level: "info", message: "You have reached or exceeded today's fat target." },
        {
          code: "CARBS_TARGET_MET",
          level: "info",
          message: "You have reached or exceeded today's carbohydrate target.",
        },
      ]);

      // No recommendation may ever phrase an exceeded macro as a negative
      // amount still to consume.
      for (const recommendation of body.recommendations) {
        expect(recommendation.message).not.toMatch(/-\d/);
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns calorie target reached when remaining calories are exactly zero", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const date = await getTodayDate(request);
      await createMeal(request, noonUtcIso(date), [
        { name: "Exact calorie meal", calories: 2378, proteinG: 100, fatG: 50, carbsG: 200 },
      ]);

      const { status, body } = await getTodayRecommendations(request);

      expect(status).toBe(200);
      expect(body.summary.remaining.calories).toBe(0);
      expect(body.recommendations[0]).toEqual({
        code: "CALORIES_TARGET_REACHED",
        level: "info",
        message: "You have reached today's calorie target.",
      });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns a controlled 404 when the user has no nutrition target yet", async ({ request }) => {
    const user = await registerTestUser(request);
    try {
      const response = await request.get("/api/me/recommendations/today");
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "Nutrition target not found" });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
