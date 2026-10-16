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

interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: string;
}

interface WeeklyShoppingList {
  startDate: string;
  endDate: string;
  shoppingListVersion: string;
  sourcePlanVersion: string;
  items: ShoppingListItem[];
  totalItems: number;
  notice: string;
}

// Matches the CALC-01 case already verified deterministically in
// nutritionTarget.api.spec.ts / reused by weeklyPlan.api.spec.ts - a stable
// baseline target for tests that only assert contract shape, not exact
// aggregated quantities.
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

// Produces the exact 3156 kcal / 176g protein / 70g fat / 456g carbs daily
// target that the Milestone 12A/12B reference Shopping List aggregation
// below was manually verified against (see the shared dev fixture user's
// profile) - distinct from PROFILE/CALC-01 above, which yields a different
// (2378 kcal) target and therefore different scaled ingredient quantities.
const REFERENCE_PROFILE: ProfileInput = {
  age: 30,
  sex: "female",
  heightCm: 180,
  weightKg: 88,
  activityLevel: "very_active",
  jobType: "mixed",
  workoutsPerWeek: 2,
  goal: "muscle_gain",
};

// The known deterministic-v1 aggregation for startDate=2026-09-21 under
// REFERENCE_PROFILE's daily target, manually verified during Milestone
// 12A/12B against the recipe catalog in weeklyPlanCatalog.ts. If the catalog
// legitimately changes, this test will fail and should be treated as a
// reported deviation, not silently loosened.
const REFERENCE_ITEMS: ShoppingListItem[] = [
  { name: "Chicken breast", quantity: 1719, unit: "g" },
  { name: "Cottage cheese", quantity: 747, unit: "g" },
  { name: "Couscous", quantity: 699, unit: "g" },
  { name: "Eggs", quantity: 12, unit: "pcs" },
  { name: "Greek yogurt", quantity: 2064, unit: "g" },
  { name: "Mixed berries", quantity: 656, unit: "g" },
  { name: "Mixed fruit", quantity: 1130, unit: "g" },
  { name: "Mixed vegetables", quantity: 2564, unit: "g" },
  { name: "Oats", quantity: 528, unit: "g" },
  { name: "Olive oil", quantity: 261, unit: "g" },
  { name: "Potatoes", quantity: 2412, unit: "g" },
  { name: "Rice", quantity: 1224, unit: "g" },
  { name: "Salad greens", quantity: 1017, unit: "g" },
  { name: "Turkey breast", quantity: 828, unit: "g" },
  { name: "White fish fillet", quantity: 1176, unit: "g" },
  { name: "Whole-grain bread", quantity: 339, unit: "g" },
];

/**
 * Registers a user and, through the public API on that same authenticated
 * context, creates a profile and its resulting deterministic nutrition
 * target.
 */
async function createUserWithTarget(request: APIRequestContext, profile: ProfileInput = PROFILE): Promise<RegisteredTestUser> {
  const user = await registerTestUser(request);
  const profileResponse = await request.post("/api/me/profile", { data: profile });
  expect(profileResponse.status()).toBe(201);

  const calculateResponse = await request.post("/api/me/nutrition-target/calculate");
  expect(calculateResponse.status()).toBe(200);

  return user;
}

async function getShoppingList(
  request: APIRequestContext,
  startDate?: string,
): Promise<{ status: number; body: WeeklyShoppingList }> {
  const query = startDate === undefined ? "" : `?startDate=${startDate}`;
  const response = await request.get(`/api/me/shopping-list/weekly${query}`);
  return { status: response.status(), body: await response.json() };
}

test.describe("Shopping List API", () => {
  test("returns a valid, deterministically sorted shopping list contract", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const { status, body } = await getShoppingList(request, "2026-09-21");

      expect(status).toBe(200);
      expect(body.startDate).toBe("2026-09-21");
      expect(body.endDate).toBe("2026-09-27");
      expect(body.shoppingListVersion).toBe("deterministic-v1");
      expect(body.sourcePlanVersion).toBe("deterministic-v1");
      expect(body.notice).toBeTruthy();

      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.totalItems).toBe(body.items.length);

      for (const item of body.items) {
        expect(item.name).toBeTruthy();
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.unit).toBeTruthy();
      }

      // Deterministic ordering: alphabetical by name, then unit as the
      // secondary key - derived from the response itself rather than
      // hard-coding the full reference list here (see the separate
      // reference-aggregation test for that).
      const sorted = [...body.items].sort((a, b) => {
        if (a.name !== b.name) {
          return a.name < b.name ? -1 : 1;
        }
        return a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0;
      });
      expect(body.items).toEqual(sorted);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("produces the known reference aggregation for the current deterministic-v1 catalog", async ({ request }) => {
    const user = await createUserWithTarget(request, REFERENCE_PROFILE);

    try {
      const { status, body } = await getShoppingList(request, "2026-09-21");

      expect(status).toBe(200);
      expect(body.totalItems).toBe(16);
      expect(body.items).toEqual(REFERENCE_ITEMS);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns identical shopping list data for repeated requests with the same parameters", async ({
    request,
  }) => {
    const user = await createUserWithTarget(request);

    try {
      const first = await getShoppingList(request, "2026-09-21");
      const second = await getShoppingList(request, "2026-09-21");

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects invalid start dates with a controlled 400", async ({ request }) => {
    const user = await createUserWithTarget(request);

    try {
      const missing = await getShoppingList(request);
      expect(missing.status).toBe(400);
      expect(missing.body).toEqual({ error: "Invalid start date" });

      const invalidStartDates = ["2026-02-30", "2026-13-01", "21-09-2026", "abc"];
      for (const startDate of invalidStartDates) {
        const { status, body } = await getShoppingList(request, startDate);
        expect(status, `startDate=${startDate}`).toBe(400);
        expect(body, `startDate=${startDate}`).toEqual({ error: "Invalid start date" });
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns a controlled 404 when the user has no nutrition target yet", async ({ request }) => {
    const userWithoutTarget = await registerTestUser(request);
    try {
      const noTargetResponse = await getShoppingList(request, "2026-09-21");
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

      const { status } = await getShoppingList(request, "2026-09-21");
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
