import { randomUUID } from "node:crypto";
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser, loginTestUser } from "../helpers/auth";

const API_BASE_URL = "http://localhost:4000";
const TEST_PASSWORD = "Str0ngTestPassw0rd!";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID()}@example.com`;
}

test.describe("Auth API", () => {
  test("register creates a user and returns it without a password hash", async ({ request }) => {
    const email = uniqueEmail("register");
    const response = await request.post("/api/auth/register", { data: { email, password: TEST_PASSWORD } });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: expect.any(String), email });
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("passwordHash");
    expect(body).not.toHaveProperty("password_hash");
    expect(JSON.stringify(body)).not.toContain(TEST_PASSWORD);

    // Registration also logs the user in immediately.
    const sessionCookie = response.headers()["set-cookie"];
    expect(sessionCookie).toBeTruthy();

    await deleteTestUser(body.id);
  });

  test("duplicate registration is rejected with 409", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const response = await request.post("/api/auth/register", {
        data: { email: user.email, password: TEST_PASSWORD },
      });
      expect(response.status()).toBe(409);
      expect(await response.json()).toEqual({ error: "An account with this email already exists" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("registration rejects an invalid email with 400", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: { email: "not-an-email", password: TEST_PASSWORD },
    });
    expect(response.status()).toBe(400);
  });

  test("registration rejects a too-short password with 400", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: { email: uniqueEmail("shortpw"), password: "short" },
    });
    expect(response.status()).toBe(400);
  });

  test("login succeeds with correct credentials", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      // A fresh context proves login (not just registration) can establish
      // a session on its own.
      const freshContext = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
      try {
        const response = await freshContext.post("/api/auth/login", {
          data: { email: user.email, password: user.password },
        });
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ id: user.id, email: user.email });

        const meResponse = await freshContext.get("/api/auth/me");
        expect(meResponse.status()).toBe(200);
        expect(await meResponse.json()).toEqual({ id: user.id, email: user.email });
      } finally {
        await freshContext.dispose();
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("login with the wrong password returns a generic 401", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const { status, body } = await loginTestUser(request, user.email, "wrong-password-entirely");
      expect(status).toBe(401);
      expect(body).toEqual({ error: "Invalid email or password" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("login with an unknown email returns the same generic 401 (no account enumeration)", async ({ request }) => {
    const { status, body } = await loginTestUser(request, uniqueEmail("nobody"), TEST_PASSWORD);
    expect(status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password" });
  });

  test("GET /api/auth/me returns the current user when authenticated", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const response = await request.get("/api/auth/me");
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: user.id, email: user.email });
      expect(body).not.toHaveProperty("passwordHash");
      expect(body).not.toHaveProperty("password_hash");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("GET /api/auth/me returns 401 when unauthenticated", async ({ request }) => {
    const anonymousContext = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const response = await anonymousContext.get("/api/auth/me");
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: "Authentication required" });
    } finally {
      await anonymousContext.dispose();
    }
  });

  test("protected API without authentication returns a controlled 401, not a crash", async ({ request }) => {
    const anonymousContext = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
    try {
      const endpoints = [
        { method: "get" as const, path: "/api/me/profile" },
        { method: "get" as const, path: "/api/me/meals" },
        { method: "get" as const, path: "/api/me/nutrition/today" },
        { method: "get" as const, path: "/api/me/history/daily?date=2026-09-20" },
        { method: "get" as const, path: "/api/me/recommendations/today" },
        { method: "get" as const, path: "/api/me/plan/weekly?startDate=2026-09-21" },
        { method: "get" as const, path: "/api/me/shopping-list/weekly?startDate=2026-09-21" },
      ];

      for (const endpoint of endpoints) {
        const response = await anonymousContext[endpoint.method](endpoint.path);
        expect(response.status(), endpoint.path).toBe(401);
        expect(await response.json(), endpoint.path).toEqual({ error: "Authentication required" });
      }
    } finally {
      await anonymousContext.dispose();
    }
  });

  test("user A cannot access user B's data through /api/me", async ({ request }) => {
    const userA = await registerTestUser(request, { emailPrefix: "isolation-a" });
    const contextB = await playwrightRequest.newContext({ baseURL: API_BASE_URL });

    try {
      const userB = await registerTestUser(contextB, { emailPrefix: "isolation-b" });

      const mealPayload = {
        mealType: "lunch",
        eatenAt: "2026-09-20T12:00:00.000Z",
        items: [{ name: "User A's private meal", calories: 500, proteinG: 30, fatG: 10, carbsG: 40 }],
      };
      const createResponse = await request.post("/api/me/meals", { data: mealPayload });
      expect(createResponse.status()).toBe(201);

      // User B's own, separately authenticated context must see none of it.
      const userBMeals = await contextB.get("/api/me/meals");
      expect(userBMeals.status()).toBe(200);
      const userBMealsBody = await userBMeals.json();
      expect(userBMealsBody).toEqual([]);
      expect(JSON.stringify(userBMealsBody)).not.toContain("User A's private meal");

      await deleteTestUser(userB.id);
    } finally {
      await contextB.dispose();
      await deleteTestUser(userA.id);
    }
  });

  test("logout clears the session so protected access becomes unavailable", async ({ request }) => {
    const user = await registerTestUser(request);

    try {
      const beforeLogout = await request.get("/api/me/meals");
      expect(beforeLogout.status()).toBe(200);

      const logoutResponse = await request.post("/api/auth/logout");
      expect(logoutResponse.status()).toBe(200);

      const afterLogout = await request.get("/api/me/meals");
      expect(afterLogout.status()).toBe(401);
      expect(await afterLogout.json()).toEqual({ error: "Authentication required" });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
