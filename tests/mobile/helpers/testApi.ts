import { randomUUID } from "node:crypto";
import type { AuthUser, MealType, UserProfile } from "../../../packages/shared/src/index";
import { HOST_API_URL } from "./config";

/**
 * Test-data setup through the REAL backend endpoints the Mobile app itself
 * uses (/api/auth/mobile/register, /api/me/profile, ...) - never SQL-seeded
 * passwords. Every user is brand new (unique email + generated password),
 * so tests never depend on manually created accounts or on each other.
 *
 * The token is only held in memory for API-side setup; nothing here ever
 * logs it or the password. The password prefix is masked in Appium's log
 * by tests/mobile/appium-log-filters.json.
 */
export interface MobileTestUser {
  id: string;
  email: string;
  password: string;
  token: string;
}

export type ProfileInput = Omit<UserProfile, "id" | "userId" | "createdAt" | "updatedAt">;

export interface MealItemSeed {
  name: string;
  quantityG?: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

async function apiCall(path: string, method: "GET" | "POST" | "PUT", body?: unknown, token?: string): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${HOST_API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

function expectStatus(action: string, actual: number, expected: number): void {
  if (actual !== expected) {
    // Only the action and status - never request bodies (credentials) or tokens.
    throw new Error(`Test setup failed: ${action} returned HTTP ${actual}, expected ${expected}.`);
  }
}

export async function registerMobileUser(prefix = "mobile-qa"): Promise<MobileTestUser> {
  const email = `${prefix}-${Date.now()}-${randomUUID()}@example.com`;
  const password = `Mobile-Qa-${randomUUID()}`;
  const { status, json } = await apiCall("/api/auth/mobile/register", "POST", { email, password });
  expectStatus("POST /api/auth/mobile/register", status, 201);
  const { user, token } = json as { user: AuthUser; token: string };
  return { id: user.id, email, password, token };
}

export async function createProfile(user: MobileTestUser, profile: ProfileInput): Promise<void> {
  const { status } = await apiCall("/api/me/profile", "POST", profile, user.token);
  expectStatus("POST /api/me/profile", status, 201);
}

export async function calculateNutritionTarget(user: MobileTestUser): Promise<void> {
  const { status } = await apiCall("/api/me/nutrition-target/calculate", "POST", undefined, user.token);
  expectStatus("POST /api/me/nutrition-target/calculate", status, 200);
}

export async function createMeal(user: MobileTestUser, mealType: MealType, eatenAt: Date, items: MealItemSeed[]): Promise<void> {
  const { status } = await apiCall("/api/me/meals", "POST", { mealType, eatenAt: eatenAt.toISOString(), items }, user.token);
  expectStatus("POST /api/me/meals", status, 201);
}

export async function countMeals(user: MobileTestUser): Promise<number> {
  const { status, json } = await apiCall("/api/me/meals", "GET", undefined, user.token);
  expectStatus("GET /api/me/meals", status, 200);
  return (json as unknown[]).length;
}

/** A user with profile + calculated nutrition target - the prerequisite for Dashboard, History, Recommendations, Plan and Shopping. */
export async function registerUserWithTarget(profile: ProfileInput, prefix?: string): Promise<MobileTestUser> {
  const user = await registerMobileUser(prefix);
  await createProfile(user, profile);
  await calculateNutritionTarget(user);
  return user;
}
