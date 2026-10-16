import { test, expect } from "@playwright/test";

test.describe("Health API", () => {
  test("GET /health returns 200", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
  });

  test("GET /health/db returns 200 and reports the database as ok", async ({ request }) => {
    const response = await request.get("/health/db");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "database" });
  });
});
