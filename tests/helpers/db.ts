import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";

// The monorepo keeps a single .env at the repository root; API tests run
// from there (via the root npm scripts), so no explicit path is needed.
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface TestUser {
  id: string;
  email: string;
}

/**
 * Inserts a throwaway user directly via SQL so profile tests have a real
 * user to work against without depending on manually-seeded data.
 */
export async function createTestUser(): Promise<TestUser> {
  const email = `qa-profile-${Date.now()}-${randomUUID()}@example.com`;
  const result = await pool.query<{ id: string }>("INSERT INTO users (email) VALUES ($1) RETURNING id", [email]);
  return { id: result.rows[0].id, email };
}

/**
 * Deletes the test user. user_profiles.user_id has ON DELETE CASCADE, so
 * any profile created for this user during the test is removed too.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function closeDbPool(): Promise<void> {
  await pool.end();
}

/**
 * Scoped to a single user id so it stays correct under the API suite's
 * parallel execution - unrelated tests creating meals for other users never
 * affect this count.
 */
export async function countMealsForUser(userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM meals WHERE user_id = $1", [
    userId,
  ]);
  return Number(result.rows[0].count);
}

/**
 * Scoped to a single user id (via a join through meals) for the same reason
 * as countMealsForUser - stays correct under the API suite's parallel
 * execution.
 */
export async function countMealItemsForUser(userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM meal_items mi JOIN meals m ON mi.meal_id = m.id WHERE m.user_id = $1",
    [userId],
  );
  return Number(result.rows[0].count);
}

export interface DbMeal {
  id: string;
  mealType: string;
  eatenAt: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export async function findMealsForUser(userId: string): Promise<DbMeal[]> {
  const result = await pool.query<{
    id: string;
    meal_type: string;
    eaten_at: Date;
    calories: number;
    protein_g: string;
    fat_g: string;
    carbs_g: string;
  }>(
    "SELECT id, meal_type, eaten_at, calories, protein_g, fat_g, carbs_g FROM meals WHERE user_id = $1 ORDER BY eaten_at DESC",
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    mealType: row.meal_type,
    eatenAt: row.eaten_at.toISOString(),
    calories: row.calories,
    proteinG: Number(row.protein_g),
    fatG: Number(row.fat_g),
    carbsG: Number(row.carbs_g),
  }));
}

export interface DbMealItem {
  name: string;
  quantityG: number | null;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export async function findMealItemsForMeal(mealId: string): Promise<DbMealItem[]> {
  const result = await pool.query<{
    name: string;
    quantity_g: string | null;
    calories: number;
    protein_g: string;
    fat_g: string;
    carbs_g: string;
  }>("SELECT name, quantity_g, calories, protein_g, fat_g, carbs_g FROM meal_items WHERE meal_id = $1 ORDER BY created_at ASC", [
    mealId,
  ]);
  return result.rows.map((row) => ({
    name: row.name,
    quantityG: row.quantity_g === null ? null : Number(row.quantity_g),
    calories: row.calories,
    proteinG: Number(row.protein_g),
    fatG: Number(row.fat_g),
    carbsG: Number(row.carbs_g),
  }));
}
