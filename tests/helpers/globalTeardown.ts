import { closeDbPool } from "./db";

// Without this, the pg Pool keeps idle connections open and the Playwright
// test process hangs after reporting results instead of exiting.
export default async function globalTeardown(): Promise<void> {
  await closeDbPool();
}
