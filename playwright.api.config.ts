import { defineConfig } from "@playwright/test";

const API_BASE_URL = "http://localhost:4000";

export default defineConfig({
  testDir: "./tests/api",
  fullyParallel: true,
  reporter: [["html", { outputFolder: "playwright-report-api" }]],
  globalTeardown: "./tests/helpers/globalTeardown.ts",
  use: {
    baseURL: API_BASE_URL,
  },
  webServer: {
    command: "npm run dev:api",
    url: `${API_BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Forced regardless of the root .env's AI_PROVIDER - dotenv (loadEnv.ts)
    // never overrides a variable already present in process.env, so this
    // wins over .env and the API suite never makes a live OpenAI call.
    env: { AI_PROVIDER: "mock" },
  },
});
