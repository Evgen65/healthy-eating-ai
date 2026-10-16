import { pool } from "../db/pool.js";

export async function userExists(userId: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM users WHERE id = $1", [userId]);
  return (result.rowCount ?? 0) > 0;
}
