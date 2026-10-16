import path from "node:path";
import fs from "node:fs";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { createTestUser, deleteTestUser, countMealsForUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

// Playwright's test loader compiles spec files to CommonJS regardless of the
// repo's root "type": "module", so __dirname is available here.
const FIXTURES_DIR = path.join(__dirname, "../fixtures");
const SAMPLE_IMAGE = fs.readFileSync(path.join(FIXTURES_DIR, "sample-meal.jpg"));

const ATTEMPTS_HEADER = "x-ai-analysis-attempts";

/**
 * The magic filenames below are recognized only by MockMealAnalyzer (see
 * mockMealAnalyzer.ts) - a deterministic, monkey-patch-free seam for
 * simulating every Milestone 13C provider failure classification. The
 * image bytes are irrelevant here; only the multipart field's `name` is
 * inspected, so every request below reuses the same real fixture buffer.
 */
function postSimulated(request: APIRequestContext, fileName: string) {
  return request.post("/api/ai/meal-analysis", {
    multipart: { image: { name: fileName, mimeType: "image/jpeg", buffer: SAMPLE_IMAGE } },
  });
}

test.describe("Meal Analysis API reliability (Milestone 13C)", () => {
  // Milestone 14 security patch: this endpoint is authenticated, so every
  // test below runs against a logged-in session (registerTestUser sets the
  // cookie on this test's own `request` context) - none of these are
  // exercising auth itself, just the pre-existing reliability mappings, so
  // authentication is handled once here rather than in each test.
  let sessionUserId: string;

  test.beforeEach(async ({ request }) => {
    const user = await registerTestUser(request);
    sessionUserId = user.id;
  });

  test.afterEach(async () => {
    await deleteTestUser(sessionUserId);
  });

  test("provider timeout maps to a controlled 504 and persists nothing", async ({ request }) => {
    const user = await createTestUser();
    try {
      const response = await postSimulated(request, "simulate-timeout.jpg");
      expect(response.status()).toBe(504);
      expect(await response.json()).toEqual({ error: "Meal analysis timed out" });
      // Retryable classification - both attempts fail, so exactly 2.
      expect(response.headers()[ATTEMPTS_HEADER]).toBe("2");
      expect(await countMealsForUser(user.id)).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("temporary rate limiting maps to a controlled 429 without raw provider details", async ({ request }) => {
    const response = await postSimulated(request, "simulate-rate-limit.jpg");
    expect(response.status()).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ error: "Meal analysis is temporarily rate limited" });
    expect(JSON.stringify(body)).not.toMatch(/insufficient_quota|credit_balance|sk-|api[_-]?key/i);
  });

  test("exhausted quota/credits maps to a controlled 503 without billing details, and is never retried", async ({
    request,
  }) => {
    const response = await postSimulated(request, "simulate-quota-exhausted.jpg");
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: "Meal analysis service is temporarily unavailable" });
    expect(JSON.stringify(body)).not.toMatch(/insufficient_quota|credit_balance|sk-|api[_-]?key/i);
    // Non-retryable classification - a bad balance will not fix itself on retry.
    expect(response.headers()[ATTEMPTS_HEADER]).toBe("1");
  });

  test("provider outage (5xx) maps to a controlled 502 without crashing", async ({ request }) => {
    const response = await postSimulated(request, "simulate-provider-unavailable.jpg");
    expect(response.status()).toBe(502);
    expect(await response.json()).toEqual({ error: "Meal analysis service is temporarily unavailable" });
  });

  test("network failure maps to a controlled 502", async ({ request }) => {
    const response = await postSimulated(request, "simulate-network-error.jpg");
    expect(response.status()).toBe(502);
    expect(await response.json()).toEqual({ error: "Meal analysis service is temporarily unavailable" });
  });

  test("invalid/malformed structured output maps to a controlled 502 with no partial data, and is never retried", async ({
    request,
  }) => {
    const response = await postSimulated(request, "simulate-invalid-response.jpg");
    expect(response.status()).toBe(502);
    expect(await response.json()).toEqual({ error: "Meal analysis provider returned an invalid response" });
    expect(response.headers()[ATTEMPTS_HEADER]).toBe("1");
  });

  test("missing/invalid provider configuration maps to a controlled 503 and is never retried", async ({ request }) => {
    const response = await postSimulated(request, "simulate-not-configured.jpg");
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: "AI provider is not configured" });
    expect(response.headers()[ATTEMPTS_HEADER]).toBe("1");
  });

  test("a transient failure is retried exactly once and succeeds on the second attempt", async ({ request }) => {
    const response = await postSimulated(request, "simulate-transient-then-success.jpg");
    expect(response.status()).toBe(200);
    expect(response.headers()[ATTEMPTS_HEADER]).toBe("2");
    const body = await response.json();
    expect(body.provider).toBe("mock");
    expect(body.items).toHaveLength(2);
  });
});
