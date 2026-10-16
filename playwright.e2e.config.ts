import { defineConfig, devices } from "@playwright/test";

const WEB_BASE_URL = "http://localhost:5173";
const API_BASE_URL = "http://localhost:4000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report-e2e" }]],
  globalTeardown: "./tests/helpers/globalTeardown.ts",
  use: {
    baseURL: WEB_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev:api",
      url: `${API_BASE_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Forced regardless of the root .env's AI_PROVIDER - dotenv (loadEnv.ts)
      // never overrides a variable already present in process.env, so this
      // wins over .env and the E2E suite never makes a live OpenAI call.
      env: { AI_PROVIDER: "mock" },
    },
    {
      // Always started fresh (never reused) so this process is guaranteed
      // to run in a clean state rather than whatever a developer's
      // already-running `npm run dev` was started with. Each E2E test now
      // authenticates as its own freshly registered user (see
      // tests/helpers/auth.ts) instead of relying on a shared fixture
      // identity injected via env.
      command: "npm run dev:web",
      url: WEB_BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
