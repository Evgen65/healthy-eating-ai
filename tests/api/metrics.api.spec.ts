import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { test, expect } from "@playwright/test";
import { recordAiAnalysisFailure, recordAiAnalysisSuccess, recordAiRetry } from "../../apps/api/src/ai/aiMetrics";
import { AiProviderTimeoutError } from "../../apps/api/src/ai/mealAnalyzerErrors";
import { MockMealAnalyzer } from "../../apps/api/src/ai/mockMealAnalyzer";
import { analyzeWithRetry } from "../../apps/api/src/ai/retryingMealAnalyzer";
import { checkDatabaseHealth } from "../../apps/api/src/db/dbHealth";
import { errorHandler } from "../../apps/api/src/logging/errorHandler";
import { createLogger } from "../../apps/api/src/logging/logger";
import { createRequestLogging } from "../../apps/api/src/logging/requestLogging";
import { createHttpMetrics, createMetricsRouter } from "../../apps/api/src/metrics/httpMetrics";
import { createMetrics, type Metrics } from "../../apps/api/src/metrics/metrics";

/** Sample value of one series, e.g. sample(text, 'http_requests_total{method="GET",route="/items/:id",status="200"}'). */
function sample(text: string, series: string): number | undefined {
  const line = text.split("\n").find((l) => l.startsWith(`${series} `));
  return line === undefined ? undefined : Number(line.slice(series.length + 1));
}

test.describe("GET /metrics and HTTP metrics", () => {
  let server: Server;
  let baseUrl: string;
  let metrics: Metrics;
  let enabled: boolean;

  test.beforeEach(async () => {
    // A brand-new registry per test: no metric state can leak between cases.
    metrics = createMetrics();
    enabled = true;
    const app = express();
    app.use(createRequestLogging(createLogger({ level: "silent" })));
    app.use(createHttpMetrics(metrics));
    app.use(createMetricsRouter(metrics, () => enabled));
    app.get("/items/:id", (_req, res) => res.json({ ok: true }));
    app.use((_req, res) => res.status(404).json({ error: "Not found" }));
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function scrape(): Promise<string> {
    return (await fetch(`${baseUrl}/metrics`)).text();
  }

  test("is a normal 404 and exposes nothing when disabled", async () => {
    await (await fetch(`${baseUrl}/items/1`)).text();
    enabled = false;
    const response = await fetch(`${baseUrl}/metrics`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  test("returns Prometheus text exposition when enabled", async () => {
    const response = await fetch(`${baseUrl}/metrics`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(metrics.registry.contentType);
    expect(response.headers.get("content-type")).toContain("text/plain");
    const text = await response.text();
    expect(text).toContain("# TYPE http_requests_total counter");
    expect(text).toContain("# TYPE http_request_duration_seconds histogram");
  });

  test("a request increments http_requests_total and fills the duration histogram", async () => {
    await (await fetch(`${baseUrl}/items/42`)).text();
    await expect.poll(async () => sample(await scrape(), 'http_requests_total{method="GET",route="/items/:id",status="200"}')).toBe(1);
    const text = await scrape();
    expect(sample(text, 'http_request_duration_seconds_count{method="GET",route="/items/:id"}')).toBe(1);
    expect(sample(text, 'http_request_duration_seconds_sum{method="GET",route="/items/:id"}')).toBeGreaterThanOrEqual(0);
    expect(text).toContain('http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/items/:id"} 1');
  });

  test("routes are templates; ids, query strings and unknown paths never become labels", async () => {
    await (await fetch(`${baseUrl}/items/secret-id-98765?email=person@example.com&token=abc123`)).text();
    await (await fetch(`${baseUrl}/no/such/path/user-4242`)).text();
    await expect.poll(async () => (await scrape()).includes('route="unmatched"')).toBe(true);
    const text = await scrape();
    expect(text).toContain('route="/items/:id"');
    expect(text).toContain('route="unmatched",status="404"');
    for (const leaked of ["secret-id-98765", "person@example.com", "abc123", "user-4242", "no/such/path"]) {
      expect(text).not.toContain(leaked);
    }
  });

  test("request ids, headers, cookies and bodies never appear in the output", async () => {
    const response = await fetch(`${baseUrl}/items/1`, {
      headers: { Authorization: "Bearer eyJ.jwt-secret-value.sig", Cookie: "heai_session=cookie-secret-value" },
    });
    const requestId = response.headers.get("x-request-id")!;
    await response.text();
    await expect.poll(async () => (await scrape()).includes("http_requests_total{")).toBe(true);
    const text = await scrape();
    expect(requestId).toBeTruthy();
    for (const leaked of [requestId, "jwt-secret-value", "cookie-secret-value", "Bearer"]) {
      expect(text).not.toContain(leaked);
    }
    expect(text).not.toContain("requestId");
  });

  test("unknown HTTP methods collapse to a bounded label", async () => {
    await fetch(`${baseUrl}/items/1`, { method: "PROPFIND" }).then((r) => r.text());
    await expect.poll(async () => (await scrape()).includes('method="OTHER"')).toBe(true);
    expect(await scrape()).not.toContain("PROPFIND");
  });
});

test.describe("AI metrics", () => {
  let metrics: Metrics;
  const text = () => metrics.registry.metrics();

  test.beforeEach(() => {
    metrics = createMetrics();
  });

  test("a successful analysis counts a provider success and a meal_detected result", async () => {
    recordAiAnalysisSuccess(metrics, "mock", 1500, 2);
    const out = await text();
    expect(sample(out, 'ai_analysis_requests_total{provider="mock",outcome="success"}')).toBe(1);
    expect(sample(out, 'ai_analysis_results_total{result="meal_detected"}')).toBe(1);
    expect(sample(out, 'ai_analysis_duration_seconds_count{provider="mock"}')).toBe(1);
  });

  test("no food is a business result of a SUCCESSFUL provider call, not a failure", async () => {
    recordAiAnalysisSuccess(metrics, "openai", 800, 0);
    const out = await text();
    expect(sample(out, 'ai_analysis_results_total{result="no_food"}')).toBe(1);
    expect(sample(out, 'ai_analysis_requests_total{provider="openai",outcome="success"}')).toBe(1);
    expect(out).not.toMatch(/ai_analysis_requests_total\{[^}]*outcome="(timeout|unknown|[a-z_]*failed)"/);
  });

  test("typed failures are counted under their existing category", async () => {
    recordAiAnalysisFailure(metrics, "mock", 100, new AiProviderTimeoutError("t"));
    recordAiAnalysisFailure(metrics, "mock", 100, new Error("some arbitrary message with user@example.com"));
    const out = await text();
    expect(sample(out, 'ai_analysis_requests_total{provider="mock",outcome="timeout"}')).toBe(1);
    expect(sample(out, 'ai_analysis_requests_total{provider="mock",outcome="unknown"}')).toBe(1);
    expect(sample(out, 'ai_analysis_results_total{result="no_food"}')).toBeUndefined();
    expect(out).not.toContain("arbitrary message");
    expect(out).not.toContain("user@example.com");
  });

  test("an unexpected provider name collapses to a bounded label", async () => {
    recordAiAnalysisSuccess(metrics, "not-a-provider-123", 10, 1);
    expect(await text()).toContain('provider="other"');
  });

  test("an automatic retry increments ai_analysis_retries_total with the failure category", async () => {
    const outcome = await analyzeWithRetry(
      new MockMealAnalyzer(),
      { buffer: Buffer.from("x"), mimeType: "image/jpeg", originalName: "simulate-transient-then-success.jpg" },
      undefined,
      (error) => recordAiRetry(metrics, "mock", error),
    );
    expect(outcome.attempts).toBe(2);
    const out = await text();
    expect(sample(out, `ai_analysis_retries_total{provider="mock",category="network_error"}`)).toBe(1);
  });

  test("a non-retryable failure records no retry", async () => {
    let retries = 0;
    await analyzeWithRetry(
      new MockMealAnalyzer(),
      { buffer: Buffer.from("x"), mimeType: "image/jpeg", originalName: "simulate-quota-exhausted.jpg" },
      undefined,
      () => retries++,
    ).catch(() => undefined);
    expect(retries).toBe(0);
  });
});

test.describe("Database health metrics", () => {
  test("success and failure are counted by outcome and the duration is observed", async () => {
    const metrics = createMetrics();
    expect(await checkDatabaseHealth(async () => 1, metrics)).toEqual({ ok: true });
    const failure = await checkDatabaseHealth(async () => {
      throw new Error("connect ECONNREFUSED postgresql://user:hunter2@db/app");
    }, metrics);
    expect(failure.ok).toBe(false);

    const out = await metrics.registry.metrics();
    expect(sample(out, 'db_health_checks_total{outcome="ok"}')).toBe(1);
    expect(sample(out, 'db_health_checks_total{outcome="error"}')).toBe(1);
    expect(sample(out, "db_health_check_duration_seconds_count")).toBe(2);
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("ECONNREFUSED");
  });
});

test.describe("Isolation", () => {
  test("separate instances do not share state, and default metrics are opt-in", async () => {
    const a = createMetrics();
    const b = createMetrics({ collectDefaults: true });
    a.httpRequestsTotal.inc({ method: "GET", route: "/x", status: "200" });
    expect(await b.registry.metrics()).not.toContain('route="/x"');
    expect(await a.registry.metrics()).not.toContain("process_cpu");
    expect(await b.registry.metrics()).toContain("process_cpu");
  });
});
