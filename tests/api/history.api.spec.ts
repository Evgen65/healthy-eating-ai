import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser, type RegisteredTestUser } from "../helpers/auth";

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

interface MealItemInput {
  name: string;
  quantityG?: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

// Matches the CALC-01 case already verified deterministically in
// nutritionTarget.api.spec.ts - reused as the fixed baseline target that
// consumed/remaining assertions are computed against.
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

const OATMEAL: MealItemInput[] = [{ name: "Oatmeal", quantityG: 200, calories: 250, proteinG: 8, fatG: 5, carbsG: 45 }];

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

async function createMeal(
  request: APIRequestContext,
  mealType: MealType,
  eatenAtIso: string,
  items: MealItemInput[],
): Promise<void> {
  const response = await request.post("/api/me/meals", { data: { mealType, eatenAt: eatenAtIso, items } });
  expect(response.status()).toBe(201);
}

test.describe("Meal History API", () => {
  test("returns meals only for the requested history date", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      await createMeal(request, "lunch", "2026-09-10T12:00:00.000Z", CHICKEN_AND_RICE);
      await createMeal(request, "lunch", "2026-09-11T12:00:00.000Z", PROTEIN_SHAKE);

      const response = await request.get("/api/me/history/daily?date=2026-09-10");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.date).toBe("2026-09-10");
      expect(body.meals).toHaveLength(1);
      expect(body.meals[0]).toMatchObject({ calories: 480, proteinG: 51, fatG: 6, carbsG: 50 });
      expect(body.consumed).toEqual({ calories: 480, proteinG: 51, fatG: 6, carbsG: 50 });
      expect(body.remaining).toEqual({ calories: 1898, proteinG: 102, fatG: 62, carbsG: 239 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns history meals ordered by eatenAt ascending", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      // Created deliberately out of chronological order (18:30, 08:00,
      // 13:15) so the assertion below only passes if the Backend sorts by
      // eatenAt rather than returning rows in insertion order.
      await createMeal(request, "dinner", "2026-09-10T18:30:00.000Z", PROTEIN_SHAKE);
      await createMeal(request, "breakfast", "2026-09-10T08:00:00.000Z", OATMEAL);
      await createMeal(request, "lunch", "2026-09-10T13:15:00.000Z", CHICKEN_AND_RICE);

      const response = await request.get("/api/me/history/daily?date=2026-09-10");
      const body = await response.json();

      expect(body.meals.map((meal: { eatenAt: string }) => meal.eatenAt)).toEqual([
        "2026-09-10T08:00:00.000Z",
        "2026-09-10T13:15:00.000Z",
        "2026-09-10T18:30:00.000Z",
      ]);
      expect(body.meals.map((meal: { mealType: string }) => meal.mealType)).toEqual(["breakfast", "lunch", "dinner"]);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns empty meals and zero consumed for a day with no meals", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const response = await request.get("/api/me/history/daily?date=2026-09-12");
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.meals).toEqual([]);
      expect(body.consumed).toEqual(ZERO);
      expect(body.remaining).toEqual(TARGET);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects invalid history dates", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const missingDate = await request.get("/api/me/history/daily");
      expect(missingDate.status()).toBe(400);
      expect(await missingDate.json()).toEqual({ error: "Invalid date" });

      const invalidFormat = await request.get("/api/me/history/daily?date=10-09-2026");
      expect(invalidFormat.status()).toBe(400);
      expect(await invalidFormat.json()).toEqual({ error: "Invalid date" });

      const impossibleDate = await request.get("/api/me/history/daily?date=2026-02-30");
      expect(impossibleDate.status()).toBe(400);
      expect(await impossibleDate.json()).toEqual({ error: "Invalid date" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("does not include another user's meals in history", async ({ request }) => {
    const userA = await createUserWithTarget(request);
    const contextB = await playwrightRequest.newContext({ baseURL: API_BASE_URL });

    try {
      const userB = await registerTestUser(contextB, { emailPrefix: "history-b" });

      await createMeal(request, "lunch", "2026-09-10T12:00:00.000Z", CHICKEN_AND_RICE);
      await createMeal(contextB, "lunch", "2026-09-10T12:00:00.000Z", LARGE_MEAL);

      const response = await request.get("/api/me/history/daily?date=2026-09-10");
      const body = await response.json();

      expect(body.meals).toHaveLength(1);
      expect(body.consumed).toEqual({ calories: 480, proteinG: 51, fatG: 6, carbsG: 50 });

      await deleteTestUser(userB.id);
    } finally {
      await contextB.dispose();
      await deleteTestUser(userA.id);
    }
  });
});
