import type { PoolClient } from "pg";
import type { Meal, MealItem, MealType, MealWithItems } from "@healthy-eating-ai/shared";
import { pool } from "../db/pool.js";
import { withTransaction } from "../db/transaction.js";
import type { MealInput } from "../schemas/mealSchema.js";
import type { MealTotals } from "../calculators/mealTotalsCalculator.js";

interface MealRow {
  id: string;
  user_id: string;
  meal_type: string;
  eaten_at: Date;
  calories: number;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
  created_at: Date;
  updated_at: Date;
}

interface MealItemRow {
  id: string;
  meal_id: string;
  name: string;
  quantity_g: string | null;
  calories: number;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
  created_at: Date;
}

function mapRowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    userId: row.user_id,
    mealType: row.meal_type as MealType,
    eatenAt: row.eaten_at.toISOString(),
    calories: row.calories,
    proteinG: Number(row.protein_g),
    fatG: Number(row.fat_g),
    carbsG: Number(row.carbs_g),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRowToMealItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    name: row.name,
    quantityG: row.quantity_g === null ? null : Number(row.quantity_g),
    calories: row.calories,
    proteinG: Number(row.protein_g),
    fatG: Number(row.fat_g),
    carbsG: Number(row.carbs_g),
  };
}

export async function findMealsByUserId(userId: string): Promise<Meal[]> {
  const result = await pool.query<MealRow>("SELECT * FROM meals WHERE user_id = $1 ORDER BY eaten_at DESC", [
    userId,
  ]);
  return result.rows.map(mapRowToMeal);
}

/**
 * Meals for one user within [start, end), oldest first - lets the History
 * API render a day chronologically (breakfast before dinner) rather than
 * by insertion order. Served by the existing meals(user_id, eaten_at DESC)
 * index (Postgres can scan it backwards for ASC order), so no new index
 * is needed.
 */
export async function findMealsByUserIdBetween(userId: string, start: Date, end: Date): Promise<Meal[]> {
  const result = await pool.query<MealRow>(
    "SELECT * FROM meals WHERE user_id = $1 AND eaten_at >= $2 AND eaten_at < $3 ORDER BY eaten_at ASC",
    [userId, start, end],
  );
  return result.rows.map(mapRowToMeal);
}

async function findMealItemsByMealId(mealId: string): Promise<MealItem[]> {
  const result = await pool.query<MealItemRow>(
    "SELECT * FROM meal_items WHERE meal_id = $1 ORDER BY created_at ASC",
    [mealId],
  );
  return result.rows.map(mapRowToMealItem);
}

/**
 * Scoped to (id, user_id) together so a meal belonging to another user
 * comes back as "not found" rather than leaking its existence.
 */
export async function findMealById(userId: string, mealId: string): Promise<MealWithItems | null> {
  const mealResult = await pool.query<MealRow>("SELECT * FROM meals WHERE id = $1 AND user_id = $2", [
    mealId,
    userId,
  ]);
  const mealRow = mealResult.rows[0];
  if (!mealRow) {
    return null;
  }

  const items = await findMealItemsByMealId(mealId);
  return { ...mapRowToMeal(mealRow), items };
}

async function insertMealItems(client: PoolClient, mealId: string, items: MealInput["items"]): Promise<MealItem[]> {
  const inserted: MealItem[] = [];
  for (const item of items) {
    const result = await client.query<MealItemRow>(
      `INSERT INTO meal_items (meal_id, name, quantity_g, calories, protein_g, fat_g, carbs_g)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [mealId, item.name, item.quantityG ?? null, item.calories, item.proteinG, item.fatG, item.carbsG],
    );
    inserted.push(mapRowToMealItem(result.rows[0]));
  }
  return inserted;
}

export async function insertMealWithItems(
  userId: string,
  input: MealInput,
  totals: MealTotals,
): Promise<MealWithItems> {
  return withTransaction(async (client) => {
    const mealResult = await client.query<MealRow>(
      `INSERT INTO meals (user_id, meal_type, eaten_at, calories, protein_g, fat_g, carbs_g)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, input.mealType, input.eatenAt, totals.calories, totals.proteinG, totals.fatG, totals.carbsG],
    );
    const mealRow = mealResult.rows[0];
    const items = await insertMealItems(client, mealRow.id, input.items);
    return { ...mapRowToMeal(mealRow), items };
  });
}

/**
 * Replaces the meal's editable fields and its full item set inside one
 * transaction: old items are deleted and the new set is inserted, so a
 * PUT never leaves a mix of old and new items behind.
 */
export async function updateMealWithItems(
  userId: string,
  mealId: string,
  input: MealInput,
  totals: MealTotals,
): Promise<MealWithItems | null> {
  return withTransaction(async (client) => {
    const mealResult = await client.query<MealRow>(
      `UPDATE meals
       SET meal_type = $3,
           eaten_at = $4,
           calories = $5,
           protein_g = $6,
           fat_g = $7,
           carbs_g = $8,
           updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [mealId, userId, input.mealType, input.eatenAt, totals.calories, totals.proteinG, totals.fatG, totals.carbsG],
    );
    const mealRow = mealResult.rows[0];
    if (!mealRow) {
      return null;
    }

    await client.query("DELETE FROM meal_items WHERE meal_id = $1", [mealId]);
    const items = await insertMealItems(client, mealId, input.items);
    return { ...mapRowToMeal(mealRow), items };
  });
}

/**
 * Scoped to (id, user_id) so deleting another user's meal id is a no-op
 * rather than a leak. meal_items are removed via ON DELETE CASCADE.
 */
export async function deleteMealById(userId: string, mealId: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM meals WHERE id = $1 AND user_id = $2", [mealId, userId]);
  return (result.rowCount ?? 0) > 0;
}
