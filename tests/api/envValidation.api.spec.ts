import { test, expect } from "@playwright/test";
import { validateEnv } from "../../apps/api/src/config/validateEnv";

const validProduction = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pw@db.example.com:5432/app",
  JWT_SECRET: "x".repeat(40),
  WEB_ORIGIN: "https://app.example.com",
  AI_PROVIDER: "openai",
  OPENAI_API_KEY: "test-key-not-real",
};

test.describe("API startup environment validation", () => {
  test("accepts an empty development environment", () => {
    expect(validateEnv({}).errors).toEqual([]);
  });

  test("accepts a complete production environment", () => {
    expect(validateEnv(validProduction).errors).toEqual([]);
  });

  for (const missing of ["DATABASE_URL", "JWT_SECRET", "WEB_ORIGIN", "OPENAI_API_KEY"]) {
    test(`production without ${missing} fails`, () => {
      const env = { ...validProduction, [missing]: "" };
      expect(validateEnv(env).errors.join(" ")).toContain(missing);
    });
  }

  test("rejects an unknown AI provider (no silent fallback)", () => {
    expect(validateEnv({ AI_PROVIDER: "gpt" }).errors.join(" ")).toContain("AI_PROVIDER");
  });

  test("rejects wildcard, pathful and non-https production origins", () => {
    for (const origin of ["*", "https://app.example.com/", "https://app.example.com/x", "http://app.example.com"]) {
      expect(validateEnv({ ...validProduction, WEB_ORIGIN: origin }).errors.join(" ")).toContain("WEB_ORIGIN");
    }
  });

  test("rejects a short production JWT secret and invalid PORT", () => {
    expect(validateEnv({ ...validProduction, JWT_SECRET: "short" }).errors.join(" ")).toContain("JWT_SECRET");
    expect(validateEnv({ PORT: "99999" }).errors.join(" ")).toContain("PORT");
  });

  test("METRICS_ENABLED must be a boolean and warns when exposed in production", () => {
    expect(validateEnv({ METRICS_ENABLED: "maybe" }).errors.join(" ")).toContain("METRICS_ENABLED");
    expect(validateEnv({ ...validProduction, METRICS_ENABLED: "true" }).warnings.join(" ")).toContain("METRICS_ENABLED");
    expect(validateEnv({ ...validProduction, METRICS_ENABLED: "false" }).warnings.join(" ")).not.toContain("METRICS_ENABLED");
  });

  test("error messages never contain secret values", () => {
    const secrets = { ...validProduction, JWT_SECRET: "tiny-secret-value", DATABASE_URL: "mysql://u:hunter2@h/db" };
    const text = validateEnv(secrets).errors.join(" ");
    expect(text).not.toContain("tiny-secret-value");
    expect(text).not.toContain("hunter2");
  });
});
