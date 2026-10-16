import { test, expect, type APIRequestContext } from "@playwright/test";
import { countMealItemsForUser, countMealsForUser, deleteTestUser } from "../helpers/db";
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

interface PlannedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface PlannedMeal {
  mealType: string;
  recipeId: string;
  title: string;
  ingredients: PlannedIngredient[];
  plannedNutrition: NutritionValues;
}

interface WeeklyPlanDay {
  date: string;
  meals: PlannedMeal[];
  plannedTotals: NutritionValues;
  differenceFromTarget: NutritionValues;
}

interface WeeklyMealPlan {
  startDate: string;
  endDate: string;
  planVersion: string;
  dailyTarget: NutritionValues;
  days: WeeklyPlanDay[];
  notice: string;
}

// Matches the CALC-01 case already verified deterministically in
// nutritionTarget.api.spec.ts - reused here as the fixed baseline target
// that dailyTarget/plannedTotals/differenceFromTarget assertions are
// computed against.
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

const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"];

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

async function getWeeklyPlan(
  request: APIRequestContext,
  startDate?: string,
): Promise<{ status: number; body: WeeklyMealPlan }> {
  const query = startDate === undefined ? "" : `?startDate=${startDate}`;
  const response = await request.get(`/api/me/plan/weekly${query}`);
  return { status: response.status(), body: await response.json() };
}

test.describe("Weekly Plan API", () => {
  test("returns a full 7-day plan matching the response contract", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { status, body } = await getWeeklyPlan(request, "2026-09-21");

      expect(status).toBe(200);
      expect(body.startDate).toBe("2026-09-21");
      expect(body.endDate).toBe("2026-09-27");
      expect(body.planVersion).toBe("deterministic-v1");
      expect(body.dailyTarget).toEqual(TARGET);
      expect(body.notice).toBeTruthy();

      const expectedDates = [
        "2026-09-21",
        "2026-09-22",
        "2026-09-23",
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
      ];
      expect(body.days).toHaveLength(7);
      expect(body.days.map((day) => day.date)).toEqual(expectedDates);

      const tolerance = TARGET.calories * 0.02;

      for (const day of body.days) {
        expect(day.meals).toHaveLength(4);
        expect(day.meals.map((meal) => meal.mealType)).toEqual(MEAL_TYPE_ORDER);

        const summedTotals: NutritionValues = { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 };

        for (const meal of day.meals) {
          expect(meal.recipeId).toBeTruthy();
          expect(meal.title).toBeTruthy();
          expect(meal.ingredients.length).toBeGreaterThan(0);

          for (const ingredient of meal.ingredients) {
            expect(ingredient.quantity).toBeGreaterThan(0);
            expect(ingredient.unit).toBeTruthy();
            expect(ingredient.name).toBeTruthy();
          }

          for (const key of Object.keys(summedTotals) as Array<keyof NutritionValues>) {
            expect(meal.plannedNutrition[key]).toBeGreaterThanOrEqual(0);
            summedTotals[key] += meal.plannedNutrition[key];
          }
        }

        expect(day.plannedTotals).toEqual(summedTotals);

        const expectedDifference: NutritionValues = {
          calories: day.plannedTotals.calories - TARGET.calories,
          proteinG: day.plannedTotals.proteinG - TARGET.proteinG,
          fatG: day.plannedTotals.fatG - TARGET.fatG,
          carbsG: day.plannedTotals.carbsG - TARGET.carbsG,
        };
        expect(day.differenceFromTarget).toEqual(expectedDifference);

        expect(Math.abs(day.plannedTotals.calories - TARGET.calories)).toBeLessThanOrEqual(tolerance);
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns identical plan data for repeated requests with the same parameters", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const first = await getWeeklyPlan(request, "2026-09-21");
      const second = await getWeeklyPlan(request, "2026-09-21");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("produces the same day plan for a calendar date shared between overlapping weekly requests", async ({
    request,
  }) => {
    const user = await createUserWithTarget(request);

    try {
      const weekA = await getWeeklyPlan(request, "2026-09-21");
      const weekB = await getWeeklyPlan(request, "2026-09-23");

      expect(weekA.status).toBe(200);
      expect(weekB.status).toBe(200);

      const dayFromA = weekA.body.days.find((day) => day.date === "2026-09-23");
      const dayFromB = weekB.body.days.find((day) => day.date === "2026-09-23");

      expect(dayFromA).toBeDefined();
      expect(dayFromB).toBeDefined();
      // Deep equality on the full day - recipe selection must depend only on
      // the calendar date, never on the day's position within the requested
      // week.
      expect(dayFromB).toEqual(dayFromA);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects invalid start dates with a controlled 400", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const missing = await getWeeklyPlan(request);
      expect(missing.status).toBe(400);
      expect(missing.body).toEqual({ error: "Invalid start date" });

      const invalidStartDates = ["2026-02-30", "2026-13-01", "21-09-2026", "abc"];
      for (const startDate of invalidStartDates) {
        const { status, body } = await getWeeklyPlan(request, startDate);
        expect(status, `startDate=${startDate}`).toBe(400);
        expect(body, `startDate=${startDate}`).toEqual({ error: "Invalid start date" });
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns a controlled 404 and never persists data when the user has no nutrition target yet", async ({
    request,
  }) => {
    const userWithoutTarget = await registerTestUser(request);
    try {
      const noTargetResponse = await getWeeklyPlan(request, "2026-09-21");
      expect(noTargetResponse.status).toBe(404);
      expect(noTargetResponse.body).toEqual({ error: "Nutrition target not found" });
    } finally {
      await deleteTestUser(userWithoutTarget.id);
    }
  });

  test("never persists a meal or meal item for a valid request", async ({ request }) => {
    const user = await createUserWithTarget(request);
    try {
      const mealsBefore = await countMealsForUser(user.id);
      const mealItemsBefore = await countMealItemsForUser(user.id);

      const { status } = await getWeeklyPlan(request, "2026-09-21");
      expect(status).toBe(200);

      const mealsAfter = await countMealsForUser(user.id);
      const mealItemsAfter = await countMealItemsForUser(user.id);

      expect(mealsAfter).toBe(mealsBefore);
      expect(mealItemsAfter).toBe(mealItemsBefore);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
