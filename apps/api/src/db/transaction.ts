import type { PoolClient } from "pg";
import { pool } from "./pool.js";

/**
 * Runs `work` inside a BEGIN/COMMIT block on a single client, rolling back
 * on any error so multi-statement writes (e.g. a meal plus its items)
 * never leave partial state behind.
 */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
