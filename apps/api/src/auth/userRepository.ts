import type { AuthUser } from "@healthy-eating-ai/shared";
import { pool } from "../db/pool.js";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string | null;
}

/** Lowercases and trims - the sole normalization applied before every lookup/insert, so "User@Example.com" and "user@example.com " are always the same account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicUser(user: StoredUser): AuthUser {
  return { id: user.id, email: user.email };
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const result = await pool.query<{ id: string; email: string; password_hash: string | null }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [normalizeEmail(email)],
  );
  const row = result.rows[0];
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const result = await pool.query<{ id: string; email: string; password_hash: string | null }>(
    "SELECT id, email, password_hash FROM users WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}

/** Throws on a duplicate email (unique constraint) - the caller (authService.ts) is expected to check for an existing user first and never rely on this throwing for normal control flow. */
export async function insertUser(email: string, passwordHash: string): Promise<StoredUser> {
  const result = await pool.query<{ id: string; email: string; password_hash: string | null }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, password_hash",
    [normalizeEmail(email), passwordHash],
  );
  const row = result.rows[0];
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}
