import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));

// Local development/test convenience only: the monorepo keeps a single .env
// at the repository root (see .env.example), regardless of which workspace
// directory a script happens to run from. Production configuration comes
// exclusively from real environment variables set by the platform (or e.g.
// `node --env-file=...`), so a stray .env on the server can never silently
// fill in missing production settings. dotenv never overrides variables that
// are already set in process.env.
if (process.env.NODE_ENV?.trim() !== "production") {
  config({ path: resolve(currentDir, "../../../../.env"), quiet: true });
}
