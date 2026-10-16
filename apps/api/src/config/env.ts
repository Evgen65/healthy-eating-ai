import { randomBytes } from "node:crypto";

// Startup validation (validateEnv.ts, called from index.ts before this
// module is ever imported) guarantees a real JWT_SECRET in production. The
// per-process fallback below therefore only ever applies to local dev/test,
// where a freshly generated secret is fine because it only needs to verify
// tokens it issued itself within the same process lifetime (a restart just
// forces a re-login). The production guard is a second line of defence in
// case this module is ever loaded without going through index.ts.
function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV?.trim() === "production") {
    throw new Error("JWT_SECRET is required in production.");
  }
  console.warn("[auth] JWT_SECRET is not set - using a random per-process secret (sessions will not survive a restart).");
  return randomBytes(32).toString("hex");
}

export const env = {
  port: process.env.PORT ? Number(process.env.PORT) : 4000,
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV?.trim() || "development",

  // The Web app's own origin - CORS must echo this exact origin (not a
  // wildcard) for the browser to accept a credentialed (cookie-carrying)
  // cross-origin response. See app.ts.
  webOrigin: process.env.WEB_ORIGIN?.trim() || "http://localhost:5173",

  jwtSecret: resolveJwtSecret(),

  // "mock" is the default so local dev and every automated test suite work
  // without any AI configuration at all - see mealAnalyzerFactory.ts.
  aiProvider: process.env.AI_PROVIDER?.trim() || "mock",
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  // gpt-5.5 is the current vision-capable model demonstrated by the
  // installed `openai` SDK's own README - overridable per-environment
  // without touching provider code (see openAiMealAnalyzer.ts).
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.5",
};
