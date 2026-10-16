import { test, expect } from "@playwright/test";
import { deleteTestUser } from "../helpers/db";
import { registerTestUser, type RegisteredTestUser } from "../helpers/auth";

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

test.describe("Profile API", () => {
  let user: RegisteredTestUser;

  test.beforeEach(async ({ request }) => {
    user = await registerTestUser(request);
  });

  test.afterEach(async () => {
    await deleteTestUser(user.id);
  });

  test("POST creates a profile and returns it in camelCase", async ({ request }) => {
    const response = await request.post("/api/me/profile", { data: validProfilePayload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({ userId: user.id, ...validProfilePayload });
    expect(body.id).toBeTruthy();
    expect(body.createdAt).toBeTruthy();
    expect(body.updatedAt).toBeTruthy();
  });

  test("GET returns the persisted profile", async ({ request }) => {
    await request.post("/api/me/profile", { data: validProfilePayload });

    const response = await request.get("/api/me/profile");

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ userId: user.id, ...validProfilePayload });
  });

  test("PUT updates the profile and persists the changes", async ({ request }) => {
    const createResponse = await request.post("/api/me/profile", { data: validProfilePayload });
    const created = await createResponse.json();

    const updatedPayload = {
      ...validProfilePayload,
      weightKg: 80,
      activityLevel: "very_active",
      workoutsPerWeek: 5,
      goal: "muscle_gain",
    };

    const putResponse = await request.put("/api/me/profile", { data: updatedPayload });
    expect(putResponse.status()).toBe(200);

    const putBody = await putResponse.json();
    expect(putBody).toMatchObject({ userId: user.id, ...updatedPayload });
    expect(putBody.updatedAt).not.toBe(created.updatedAt);

    const getResponse = await request.get("/api/me/profile");
    expect(await getResponse.json()).toMatchObject({ userId: user.id, ...updatedPayload });
  });

  test("POST returns 409 when a profile already exists", async ({ request }) => {
    await request.post("/api/me/profile", { data: validProfilePayload });

    const response = await request.post("/api/me/profile", { data: validProfilePayload });

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: "Profile already exists" });
  });

  test("POST returns 400 for a non-positive age", async ({ request }) => {
    const response = await request.post("/api/me/profile", {
      data: { ...validProfilePayload, age: -5 },
    });

    expect(response.status()).toBe(400);
  });

  test("POST returns 400 for an invalid enum value", async ({ request }) => {
    const response = await request.post("/api/me/profile", {
      data: { ...validProfilePayload, goal: "extreme_diet" },
    });

    expect(response.status()).toBe(400);
  });

  test("POST returns 400 for an unexpected property", async ({ request }) => {
    const response = await request.post("/api/me/profile", {
      data: { ...validProfilePayload, admin: true },
    });

    expect(response.status()).toBe(400);
  });

  test("GET returns 404 when the user exists but has no profile", async ({ request }) => {
    const response = await request.get("/api/me/profile");

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Profile not found" });
  });

  test("PUT returns 404 when the user exists but has no profile", async ({ request }) => {
    const response = await request.put("/api/me/profile", { data: validProfilePayload });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Profile not found" });
  });
});
