import { test, expect } from "@playwright/test";
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

interface NutritionExpectation {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  formulaVersion: string;
}

interface NutritionTestCase {
  id: string;
  profile: ProfileInput;
  expected: NutritionExpectation;
}

const FORMULA_VERSION = "mifflin-st-jeor-v1";

const cases: NutritionTestCase[] = [
  {
    id: "CALC-01",
    profile: {
      age: 35,
      sex: "male",
      heightCm: 180,
      weightKg: 85,
      activityLevel: "moderate",
      jobType: "desk",
      workoutsPerWeek: 3,
      goal: "weight_loss",
    },
    expected: {
      bmr: 1805,
      tdee: 2798,
      calorieTarget: 2378,
      proteinG: 153,
      fatG: 68,
      carbsG: 289,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-02",
    profile: {
      age: 35,
      sex: "male",
      heightCm: 180,
      weightKg: 85,
      activityLevel: "moderate",
      jobType: "desk",
      workoutsPerWeek: 3,
      goal: "maintain",
    },
    expected: {
      bmr: 1805,
      tdee: 2798,
      calorieTarget: 2798,
      proteinG: 136,
      fatG: 68,
      carbsG: 411,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-03",
    profile: {
      age: 35,
      sex: "male",
      heightCm: 180,
      weightKg: 85,
      activityLevel: "moderate",
      jobType: "desk",
      workoutsPerWeek: 3,
      goal: "muscle_gain",
    },
    expected: {
      bmr: 1805,
      tdee: 2798,
      calorieTarget: 3022,
      proteinG: 170,
      fatG: 68,
      carbsG: 433,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-04",
    profile: {
      age: 30,
      sex: "female",
      heightCm: 165,
      weightKg: 60,
      activityLevel: "light",
      jobType: "desk",
      workoutsPerWeek: 2,
      goal: "weight_loss",
    },
    expected: {
      bmr: 1320,
      tdee: 1815,
      calorieTarget: 1543,
      proteinG: 108,
      fatG: 48,
      carbsG: 170,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-05",
    profile: {
      age: 30,
      sex: "female",
      heightCm: 165,
      weightKg: 60,
      activityLevel: "light",
      jobType: "desk",
      workoutsPerWeek: 2,
      goal: "maintain",
    },
    expected: {
      bmr: 1320,
      tdee: 1815,
      calorieTarget: 1815,
      proteinG: 96,
      fatG: 48,
      carbsG: 250,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-06",
    profile: {
      age: 30,
      sex: "female",
      heightCm: 165,
      weightKg: 60,
      activityLevel: "light",
      jobType: "desk",
      workoutsPerWeek: 2,
      goal: "muscle_gain",
    },
    expected: {
      bmr: 1320,
      tdee: 1815,
      calorieTarget: 1961,
      proteinG: 120,
      fatG: 48,
      carbsG: 262,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-07",
    profile: {
      age: 40,
      sex: "male",
      heightCm: 175,
      weightKg: 90,
      activityLevel: "sedentary",
      jobType: "desk",
      workoutsPerWeek: 0,
      goal: "maintain",
    },
    expected: {
      bmr: 1799,
      tdee: 2159,
      calorieTarget: 2159,
      proteinG: 144,
      fatG: 72,
      carbsG: 234,
      formulaVersion: FORMULA_VERSION,
    },
  },
  {
    id: "CALC-08",
    profile: {
      age: 28,
      sex: "female",
      heightCm: 170,
      weightKg: 65,
      activityLevel: "very_active",
      jobType: "physical",
      workoutsPerWeek: 5,
      goal: "maintain",
    },
    expected: {
      bmr: 1412,
      tdee: 2435,
      calorieTarget: 2435,
      proteinG: 104,
      fatG: 52,
      carbsG: 388,
      formulaVersion: FORMULA_VERSION,
    },
  },
];

test.describe("Nutrition Target API", () => {
  for (const { id, profile, expected } of cases) {
    test(`${id} calculates and persists the exact deterministic nutrition target`, async ({ request }) => {
      const user: RegisteredTestUser = await registerTestUser(request);

      try {
        const profileResponse = await request.post("/api/me/profile", { data: profile });
        expect(profileResponse.status()).toBe(201);

        const calculateResponse = await request.post("/api/me/nutrition-target/calculate");
        expect(calculateResponse.status()).toBe(200);

        const calculated = await calculateResponse.json();
        expect(calculated).toMatchObject({ userId: user.id, ...expected });

        const getResponse = await request.get("/api/me/nutrition-target");
        expect(getResponse.status()).toBe(200);

        const persisted = await getResponse.json();
        expect(persisted).toMatchObject({ userId: user.id, ...expected });
      } finally {
        await deleteTestUser(user.id);
      }
    });
  }
});
