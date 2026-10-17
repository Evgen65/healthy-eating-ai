import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { test, expect } from "@playwright/test";
import { aiErrorCategory, logAiAnalysisFailed } from "../../apps/api/src/ai/aiAnalysisLogging";
import { AiProviderTimeoutError } from "../../apps/api/src/ai/mealAnalyzerErrors";
import { MockMealAnalyzer } from "../../apps/api/src/ai/mockMealAnalyzer";
import { analyzeWithRetry } from "../../apps/api/src/ai/retryingMealAnalyzer";
import { errorHandler } from "../../apps/api/src/logging/errorHandler";
import { createLogger } from "../../apps/api/src/logging/logger";
import { runWithLogger } from "../../apps/api/src/logging/requestContext";
import { createRequestLogging } from "../../apps/api/src/logging/requestLogging";

type LogLine = Record<string, unknown>;

function captureLogger(level = "debug") {
  const lines: string[] = [];
  const logger = createLogger({ level, destination: { write: (line: string) => void lines.push(line) } });
  return { logger, lines, parsed: (): LogLine[] => lines.map((l) => JSON.parse(l) as LogLine) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IMAGE_INPUT = { buffer: Buffer.from("not-a-real-image"), mimeType: "image/jpeg" };

test.describe("Request correlation against the running API", () => {
  test("responses carry an X-Request-Id, including errors and 404s", async ({ request }) => {
    for (const path of ["/health", "/api/me/profile", "/no-such-route"]) {
      const response = await request.get(path);
      expect(response.headers()["x-request-id"], path).toMatch(UUID);
    }
  });

  test("independent requests receive different request IDs", async ({ request }) => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      ids.add((await request.get("/health")).headers()["x-request-id"]);
    }
    expect(ids.size).toBe(5);
  });

  test("a client-supplied X-Request-Id is not trusted", async ({ request }) => {
    const response = await request.get("/health", { headers: { "X-Request-Id": "attacker-chosen" } });
    expect(response.headers()["x-request-id"]).toMatch(UUID);
  });
});

test.describe("Structured HTTP logging", () => {
  let server: Server;
  let baseUrl: string;
  let capture: ReturnType<typeof captureLogger>;

  test.beforeEach(async () => {
    capture = captureLogger();
    const app = express();
    app.use(createRequestLogging(capture.logger));
    app.use(express.json());
    app.get("/items/:id", (_req, res) => res.json({ ok: true }));
    app.post("/login", (_req, res) => res.status(401).json({ error: "nope" }));
    app.get("/boom", () => {
      throw new Error("kaboom internal detail");
    });
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("completion log has requestId, method, normalized path, status and duration", async () => {
    const response = await fetch(`${baseUrl}/items/12345?token=abc`);
    const requestId = response.headers.get("x-request-id");
    await response.text();

    const completed = await expectEvent(capture, "http_request_completed");
    expect(completed.requestId).toBe(requestId);
    expect(completed).toMatchObject({ level: "info", method: "GET", path: "/items/:id", status: 200 });
    expect(typeof completed.durationMs).toBe("number");
    expect(completed.durationMs as number).toBeGreaterThanOrEqual(0);
  });

  test("controlled error responses keep the requestId and the 500 body stays generic", async () => {
    const response = await fetch(`${baseUrl}/boom`);
    const requestId = response.headers.get("x-request-id");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });

    const completed = await expectEvent(capture, "http_request_completed");
    expect(completed).toMatchObject({ requestId, status: 500, level: "error", path: "/boom" });
    const unhandled = capture.parsed().find((l) => l.event === "unhandled_error");
    expect(unhandled?.requestId).toBe(requestId);
    expect(JSON.stringify(unhandled?.err)).toContain("kaboom internal detail");
  });

  test("4xx responses are logged as warnings with the requestId", async () => {
    const response = await fetch(`${baseUrl}/login`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    const completed = await expectEvent(capture, "http_request_completed");
    expect(completed).toMatchObject({ requestId: response.headers.get("x-request-id"), status: 401, level: "warn" });
  });

  test("unmatched paths are not logged verbatim", async () => {
    await (await fetch(`${baseUrl}/secret-path/with-an-id-123`)).text();
    const completed = await expectEvent(capture, "http_request_completed");
    expect(completed.path).toBe("unmatched");
    expect(capture.lines.join("")).not.toContain("with-an-id-123");
  });

  test("headers, cookies, passwords and bodies never appear in logs", async () => {
    const bearer = "eyJhbGciOiJIUzI1NiJ9.super-secret-jwt-payload.signature";
    const cookieToken = "heai-session-cookie-token-value";
    const password = "My-Very-Secret-Passw0rd!";
    await (
      await fetch(`${baseUrl}/boom`, {
        method: "GET",
        headers: { Authorization: `Bearer ${bearer}`, Cookie: `heai_session=${cookieToken}` },
      })
    ).text();
    await (
      await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@example.com", password }),
      })
    ).text();

    const output = capture.lines.join("");
    expect(output.length).toBeGreaterThan(0);
    for (const secret of [bearer, cookieToken, password, "a@example.com"]) {
      expect(output).not.toContain(secret);
    }
  });
});

test.describe("Redaction", () => {
  test("logger-level redaction hides credential fields", () => {
    const { logger, lines } = captureLogger();
    logger.info({
      event: "probe",
      authorization: "Bearer abc.def.ghi",
      password: "hunter2-password",
      token: "jwt-token-value",
      headers: { authorization: "Bearer xyz", cookie: "heai_session=cookie-value", accept: "*/*" },
      req: { headers: { cookie: "heai_session=another-cookie-value" } },
      nested: { password: "nested-password-value", OPENAI_API_KEY: "sk-nested-key-value" },
    });
    const output = lines.join("");
    for (const secret of ["abc.def.ghi", "hunter2-password", "jwt-token-value", "Bearer xyz", "cookie-value", "nested-password-value", "sk-nested-key-value"]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("[REDACTED]");
  });

  test("configured secrets are scrubbed even when embedded in free text or errors", () => {
    const saved = { db: process.env.DATABASE_URL, key: process.env.OPENAI_API_KEY };
    process.env.DATABASE_URL = "postgresql://appuser:s3cretDbPassw0rd@db.internal:5432/app";
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-openai-key-123456";
    try {
      const { logger, lines } = captureLogger();
      logger.error({ event: "probe", err: new Error(`connect failed for ${process.env.DATABASE_URL}`) }, `key ${process.env.OPENAI_API_KEY}`);
      const output = lines.join("");
      expect(output).not.toContain("s3cretDbPassw0rd");
      expect(output).not.toContain("postgresql://appuser");
      expect(output).not.toContain("sk-test-not-a-real-openai-key-123456");
      expect(output).toContain("[REDACTED]");
    } finally {
      if (saved.db === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved.db;
      if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = saved.key;
    }
  });
});

test.describe("AI operational logging", () => {
  test("a retryable failure logs ai_analysis_retry with the existing classification, then ai_analysis_failed", async () => {
    const { logger, parsed, lines } = captureLogger();
    const log = logger.child({ requestId: "req-ai-1" });

    const error = await runWithLogger(log, () =>
      analyzeWithRetry(new MockMealAnalyzer(), { ...IMAGE_INPUT, originalName: "simulate-timeout.jpg" }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiProviderTimeoutError);
    logAiAnalysisFailed(log, error, { provider: "mock", durationMs: 7 });

    const events = parsed();
    const retry = events.find((l) => l.event === "ai_analysis_retry");
    expect(retry).toMatchObject({ requestId: "req-ai-1", category: "timeout", attempt: 1 });
    const failed = events.find((l) => l.event === "ai_analysis_failed");
    expect(failed).toMatchObject({ requestId: "req-ai-1", provider: "mock", category: "timeout", retryable: true, attempts: 2 });
    expect(lines.join("")).not.toContain("not-a-real-image");
  });

  test("a non-retryable failure is classified without a retry event", async () => {
    const { logger, parsed } = captureLogger();
    const error = await runWithLogger(logger, () =>
      analyzeWithRetry(new MockMealAnalyzer(), { ...IMAGE_INPUT, originalName: "simulate-quota-exhausted.jpg" }),
    ).catch((e: unknown) => e);
    expect(aiErrorCategory(error)).toBe("quota_exhausted");
    expect(parsed().some((l) => l.event === "ai_analysis_retry")).toBe(false);
  });

  test("a transient failure that recovers logs one retry", async () => {
    const { logger, parsed } = captureLogger();
    const outcome = await runWithLogger(logger, () =>
      analyzeWithRetry(new MockMealAnalyzer(), { ...IMAGE_INPUT, originalName: "simulate-transient-then-success.jpg" }),
    );
    expect(outcome.attempts).toBe(2);
    const retries = parsed().filter((l) => l.event === "ai_analysis_retry");
    expect(retries).toHaveLength(1);
    expect(retries[0].category).toBe("network_error");
  });
});

async function expectEvent(capture: ReturnType<typeof captureLogger>, event: string): Promise<LogLine> {
  // The completion log is written on the response's "finish" event, which
  // can land a tick after the client has read the response.
  await expect.poll(() => capture.parsed().some((l) => l.event === event)).toBe(true);
  return capture.parsed().find((l) => l.event === event)!;
}
