import { randomUUID } from "node:crypto";
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser } from "../helpers/auth";

const API_BASE_URL = "http://localhost:4000";
const TEST_PASSWORD = "Str0ngTestPassw0rd!";

const validProfilePayload = {
  age: 35,
  sex: "male",
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
  jobType: "desk",
  workoutsPerWeek: 3,
  goal: "weight_loss",
};

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID()}@example.com`;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Every Bearer test runs in its own fresh, cookie-less context - the mobile
 * endpoints never set a cookie, but a fresh context makes it impossible for
 * a test to pass because of a cookie picked up elsewhere rather than the
 * Authorization header itself.
 */
async function withFreshContext<T>(fn: (context: APIRequestContext) => Promise<T>): Promise<T> {
  const context = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
  try {
    return await fn(context);
  } finally {
    await context.dispose();
  }
}

async function mobileRegister(context: APIRequestContext, emailPrefix: string) {
  const email = uniqueEmail(emailPrefix);
  const response = await context.post("/api/auth/mobile/register", { data: { email, password: TEST_PASSWORD } });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user: { id: string; email: string }; token: string };
  return { id: body.user.id, email, token: body.token };
}

test.describe("Mobile Bearer auth API", () => {
  test("mobile register returns user + token, sets no cookie, and never exposes the password/hash", async () => {
    await withFreshContext(async (context) => {
      const email = uniqueEmail("mobile-register");
      const response = await context.post("/api/auth/mobile/register", { data: { email, password: TEST_PASSWORD } });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toEqual({ user: { id: expect.any(String), email }, token: expect.any(String) });
      expect(JSON.stringify(body)).not.toContain(TEST_PASSWORD);
      expect(JSON.stringify(body)).not.toMatch(/password/i);
      expect(response.headers()["set-cookie"]).toBeUndefined();

      await deleteTestUser(body.user.id);
    });
  });

  test("mobile login returns a token but never the password/password_hash", async () => {
    await withFreshContext(async (context) => {
      const user = await mobileRegister(context, "mobile-login");
      try {
        const response = await context.post("/api/auth/mobile/login", {
          data: { email: user.email, password: TEST_PASSWORD },
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ user: { id: user.id, email: user.email }, token: expect.any(String) });
        expect(JSON.stringify(body)).not.toContain(TEST_PASSWORD);
        expect(JSON.stringify(body)).not.toMatch(/password/i);
        expect(response.headers()["set-cookie"]).toBeUndefined();
      } finally {
        await deleteTestUser(user.id);
      }
    });
  });

  test("mobile login with wrong password or unknown email returns the same neutral 401", async () => {
    await withFreshContext(async (context) => {
      const user = await mobileRegister(context, "mobile-invalid");
      try {
        const wrongPassword = await context.post("/api/auth/mobile/login", {
          data: { email: user.email, password: "wrong-password-entirely" },
        });
        expect(wrongPassword.status()).toBe(401);
        const wrongPasswordBody = await wrongPassword.json();
        expect(wrongPasswordBody).toEqual({ error: "Invalid email or password" });

        const unknownEmail = await context.post("/api/auth/mobile/login", {
          data: { email: uniqueEmail("mobile-nobody"), password: TEST_PASSWORD },
        });
        expect(unknownEmail.status()).toBe(401);
        expect(await unknownEmail.json()).toEqual(wrongPasswordBody);
      } finally {
        await deleteTestUser(user.id);
      }
    });
  });

  test("valid Bearer JWT -> GET /api/auth/me returns 200 with the current user", async () => {
    await withFreshContext(async (context) => {
      const user = await mobileRegister(context, "bearer-me");
      try {
        const response = await context.get("/api/auth/me", { headers: bearer(user.token) });
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ id: user.id, email: user.email });
      } finally {
        await deleteTestUser(user.id);
      }
    });
  });

  test("missing or invalid Bearer token -> protected endpoint returns a controlled 401", async () => {
    await withFreshContext(async (context) => {
      const missing = await context.get("/api/me/profile");
      expect(missing.status()).toBe(401);
      expect(await missing.json()).toEqual({ error: "Authentication required" });

      for (const authorization of ["Bearer not-a-real-jwt", "Bearer ", "Basic abc123", "Bearer a.b.c"]) {
        const response = await context.get("/api/auth/me", { headers: { Authorization: authorization } });
        expect(response.status(), authorization).toBe(401);
        expect(await response.json(), authorization).toEqual({ error: "Authentication required" });
      }
    });
  });

  test("valid Bearer token -> protected /api/me profile endpoints work end to end", async () => {
    await withFreshContext(async (context) => {
      const user = await mobileRegister(context, "bearer-profile");
      try {
        const empty = await context.get("/api/me/profile", { headers: bearer(user.token) });
        expect(empty.status()).toBe(404);

        const created = await context.post("/api/me/profile", {
          headers: bearer(user.token),
          data: validProfilePayload,
        });
        expect(created.status()).toBe(201);

        const fetched = await context.get("/api/me/profile", { headers: bearer(user.token) });
        expect(fetched.status()).toBe(200);
        expect(await fetched.json()).toMatchObject({ userId: user.id, ...validProfilePayload });
      } finally {
        await deleteTestUser(user.id);
      }
    });
  });

  test("user A's Bearer token cannot access user B's data", async () => {
    await withFreshContext(async (context) => {
      const userA = await mobileRegister(context, "bearer-isolation-a");
      const userB = await mobileRegister(context, "bearer-isolation-b");
      try {
        const createB = await context.post("/api/me/profile", {
          headers: bearer(userB.token),
          data: { ...validProfilePayload, age: 61 },
        });
        expect(createB.status()).toBe(201);

        // User A has no profile of their own - their token must never
        // resolve to user B's row.
        const profileA = await context.get("/api/me/profile", { headers: bearer(userA.token) });
        expect(profileA.status()).toBe(404);

        const meA = await context.get("/api/auth/me", { headers: bearer(userA.token) });
        expect(await meA.json()).toEqual({ id: userA.id, email: userA.email });
      } finally {
        await deleteTestUser(userA.id);
        await deleteTestUser(userB.id);
      }
    });
  });

  test("Web cookie auth still works, and an explicit Bearer header takes precedence over the cookie", async ({
    request,
  }) => {
    // `request` holds a real Web session cookie after this.
    const webUser = await registerTestUser(request, { emailPrefix: "cookie-still-works" });
    const mobileUser = await withFreshContext((context) => mobileRegister(context, "bearer-precedence"));
    try {
      const cookieMe = await request.get("/api/auth/me");
      expect(cookieMe.status()).toBe(200);
      expect(await cookieMe.json()).toEqual({ id: webUser.id, email: webUser.email });

      const cookieProfile = await request.get("/api/me/profile");
      expect(cookieProfile.status()).toBe(404);

      // Same context (cookie still attached) + a Bearer header: the Bearer
      // identity wins...
      const bearerMe = await request.get("/api/auth/me", { headers: bearer(mobileUser.token) });
      expect(await bearerMe.json()).toEqual({ id: mobileUser.id, email: mobileUser.email });

      // ...and an invalid Bearer header is rejected outright rather than
      // silently falling back to the cookie's identity.
      const invalidBearer = await request.get("/api/auth/me", { headers: bearer("not-a-real-jwt") });
      expect(invalidBearer.status()).toBe(401);
    } finally {
      await deleteTestUser(webUser.id);
      await deleteTestUser(mobileUser.id);
    }
  });

  test("a Web-registered user can log in on Mobile and sees the same profile (same account)", async ({ request }) => {
    const webUser = await registerTestUser(request, { emailPrefix: "cross-client" });
    try {
      const webCreate = await request.post("/api/me/profile", { data: validProfilePayload });
      expect(webCreate.status()).toBe(201);

      await withFreshContext(async (context) => {
        const login = await context.post("/api/auth/mobile/login", {
          data: { email: webUser.email, password: webUser.password },
        });
        expect(login.status()).toBe(200);
        const { user, token } = await login.json();
        expect(user).toEqual({ id: webUser.id, email: webUser.email });

        const mobileProfile = await context.get("/api/me/profile", { headers: bearer(token) });
        expect(mobileProfile.status()).toBe(200);
        expect(await mobileProfile.json()).toMatchObject({ userId: webUser.id, ...validProfilePayload });
      });

      // And a Mobile-registered user can log in through the Web endpoint.
      const mobileUser = await withFreshContext((context) => mobileRegister(context, "cross-client-mobile"));
      try {
        await withFreshContext(async (context) => {
          const webLogin = await context.post("/api/auth/login", {
            data: { email: mobileUser.email, password: TEST_PASSWORD },
          });
          expect(webLogin.status()).toBe(200);
          expect(await webLogin.json()).toEqual({ id: mobileUser.id, email: mobileUser.email });
        });
      } finally {
        await deleteTestUser(mobileUser.id);
      }
    } finally {
      await deleteTestUser(webUser.id);
    }
  });
});
