import path from "node:path";
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { deleteTestUser, countMealsForUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// Playwright's test loader compiles spec files to CommonJS regardless of the
// repo's root "type": "module", so __dirname is available here.
const FIXTURES_DIR = path.join(__dirname, "../fixtures");

const CHICKEN_BREAST = { name: "Chicken breast", estimatedQuantityG: 150, calories: 250, proteinG: 46, fatG: 5, carbsG: 0 };
const RICE = { name: "Rice", estimatedQuantityG: 180, calories: 230, proteinG: 5, fatG: 1, carbsG: 50 };
const TOTALS = { calories: 480, proteinG: 51, fatG: 6, carbsG: 50 };

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ATTEMPTS_HEADER = "x-ai-analysis-attempts";

const SUPPORTED_IMAGES: Array<{ mimeType: string; fileName: string }> = [
  { mimeType: "image/jpeg", fileName: "sample-meal.jpg" },
  { mimeType: "image/png", fileName: "sample-meal.png" },
  { mimeType: "image/webp", fileName: "sample-meal.webp" },
];

test.describe("Meal Analysis API", () => {
  // Milestone 14 security patch: POST /api/ai/meal-analysis calls a paid AI
  // provider, so it sits behind requireAuth like every other user-scoped
  // route (see mealAnalysisRoutes.ts) - every test below that expects the
  // analyzer to actually run first authenticates via the real
  // register/login flow (registerTestUser sets the session cookie on this
  // test's own `request` context, exactly like a real browser would).
  test("accepts supported JPEG PNG and WEBP images", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      for (const { mimeType, fileName } of SUPPORTED_IMAGES) {
        const buffer = fs.readFileSync(path.join(FIXTURES_DIR, fileName));

        const response = await request.post("/api/ai/meal-analysis", {
          multipart: {
            image: { name: fileName, mimeType, buffer },
          },
        });

        expect(response.status(), `${mimeType} should be accepted`).toBe(200);

        const body = await response.json();
        expect(body.provider).toBe("mock");
        expect(body.analysisVersion).toBe("mock-v1");
        expect(body.items).toHaveLength(2);
        expect(body.items[0]).toEqual(CHICKEN_BREAST);
        expect(body.items[1]).toEqual(RICE);
        expect(body.totals).toEqual(TOTALS);
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects meal analysis request without an image", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const response = await request.post("/api/ai/meal-analysis", {
        multipart: {},
      });

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "Image is required" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects unsupported meal analysis file type", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const response = await request.post("/api/ai/meal-analysis", {
        multipart: {
          image: { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("this is not an image") },
        },
      });

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "Unsupported image type" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects image larger than 10 MB", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const oversizedBuffer = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1, 0);

      const response = await request.post("/api/ai/meal-analysis", {
        multipart: {
          image: { name: "oversized.jpg", mimeType: "image/jpeg", buffer: oversizedBuffer },
        },
      });

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "Image is too large" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("does not persist meals during AI analysis", async ({ request }) => {
    // Dedicated sentinel user - counting meals scoped to this id stays
    // correct even though the API suite runs fully in parallel and other
    // tests are creating/deleting meals for their own users concurrently.
    // registerTestUser (not the direct-SQL db helper) so this request is
    // also authenticated.
    const user = await registerTestUser(request);

    try {
      expect(await countMealsForUser(user.id)).toBe(0);

      const buffer = fs.readFileSync(path.join(FIXTURES_DIR, "sample-meal.jpg"));
      const response = await request.post("/api/ai/meal-analysis", {
        multipart: {
          image: { name: "sample-meal.jpg", mimeType: "image/jpeg", buffer },
        },
      });
      expect(response.status()).toBe(200);

      // Analysis is a read-only estimate - it must never create a Meal or
      // meal_items row on its own. Only the separate "confirm" flow
      // (POST /api/users/:userId/meals) persists anything.
      expect(await countMealsForUser(user.id)).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("rejects an anonymous meal-analysis request with 401 and never reaches the AI provider", async ({
    request,
  }) => {
    // No registerTestUser/login here on purpose - this request's cookie jar
    // is empty, simulating a client with no session at all.
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, "sample-meal.jpg"));
    const response = await request.post("/api/ai/meal-analysis", {
      multipart: {
        image: { name: "sample-meal.jpg", mimeType: "image/jpeg", buffer },
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });

    // The attempts header is only ever set once analyzeWithRetry has
    // actually run (success or failure) - its absence here is the
    // observable proof that requireAuth rejected the request before the
    // (paid) AI provider was ever called.
    expect(response.headers()[ATTEMPTS_HEADER]).toBeUndefined();
  });
});
