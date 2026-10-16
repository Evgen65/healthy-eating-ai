import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  // Fail a request (and /health/db) after 5s instead of waiting forever when
  // the database is unreachable.
  connectionTimeoutMillis: 5_000,
});

// An idle client emits 'error' on unexpected disconnects (e.g. the DB
// restarting). Without a listener, that event would crash the process.
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
});
