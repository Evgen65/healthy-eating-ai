import { test, expect } from "@playwright/test";
import { deleteTestUser, findMealsForUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

interface MealItemInput {
  name: string;
  quantityG?: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Chosen so summing in floating point reproduces classic IEEE754 artifacts
// (3.5 + 0.1 + 0.2 === 3.8000000000000003 in raw JS) while calories, protein
// and carbs each accumulate their own artifact-prone remainder too.
const ITEMS: MealItemInput[] = [
  { name: "Item A", calories: 100, proteinG: 30, fatG: 3.5, carbsG: 1 },
  { name: "Item B", calories: 50, proteinG: 0.7, fatG: 0.1, carbsG: 1.6 },
  { name: "Item C", calories: 43, proteinG: 0.8, fatG: 0.2, carbsG: 3.5 },
];

test.describe("Meal totals normalization", () => {
  test("rounds calculated meal totals to clean numeric values, in the API response and persisted row", async ({
    request,
  }) => {
    const user = await registerTestUser(request);

    try {
      const response = await request.post("/api/me/meals", {
        data: { mealType: "lunch", eatenAt: "2026-09-15T12:00:00.000Z", items: ITEMS },
      });
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.calories).toBe(193);
      expect(body.proteinG).toBe(31.5);
      expect(body.fatG).toBe(3.8);
      expect(body.carbsG).toBe(6.1);

      // Item-level values are validated/stored as supplied, never rounded to
      // hide the issue - only the aggregate totals are normalized.
      expect(body.items).toHaveLength(3);
      expect(body.items[1]).toMatchObject({ proteinG: 0.7, fatG: 0.1, carbsG: 1.6 });
      expect(body.items[2]).toMatchObject({ proteinG: 0.8, fatG: 0.2, carbsG: 3.5 });

      // The authoritative persisted row must be clean too, not just the
      // JSON response - a presentation-only fix would leave this failing.
      const [persisted] = await findMealsForUser(user.id);
      expect(persisted.calories).toBe(193);
      expect(persisted.proteinG).toBe(31.5);
      expect(persisted.fatG).toBe(3.8);
      expect(persisted.carbsG).toBe(6.1);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
