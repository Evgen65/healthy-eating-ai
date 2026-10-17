import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * The single place where every Prometheus metric is defined. Label values
 * are always bounded, controlled strings (method, route TEMPLATE, status
 * code, provider, typed error category, ...) - never ids, URLs, messages or
 * anything user-derived. Each call creates its own Registry, so tests get
 * isolated instances and nothing is ever registered twice on a global one.
 */
const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const AI_BUCKETS = [0.1, 0.5, 1, 2.5, 5, 10, 20, 45, 90];
const DB_BUCKETS = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5];

export interface CreateMetricsOptions {
  /** Standard Node.js/process metrics (CPU, memory, event loop, GC). They contain no request or user data. */
  collectDefaults?: boolean;
}

export function createMetrics(options: CreateMetricsOptions = {}) {
  const registry = new Registry();
  if (options.collectDefaults) {
    collectDefaultMetrics({ register: registry });
  }

  return {
    registry,
    httpRequestsTotal: new Counter({
      name: "http_requests_total",
      help: "Completed HTTP requests.",
      labelNames: ["method", "route", "status"] as const,
      registers: [registry],
    }),
    httpRequestDurationSeconds: new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds.",
      labelNames: ["method", "route"] as const,
      buckets: HTTP_BUCKETS,
      registers: [registry],
    }),
    aiAnalysisRequestsTotal: new Counter({
      name: "ai_analysis_requests_total",
      help: "Meal-analysis provider executions by outcome (success or typed failure category).",
      labelNames: ["provider", "outcome"] as const,
      registers: [registry],
    }),
    aiAnalysisDurationSeconds: new Histogram({
      name: "ai_analysis_duration_seconds",
      help: "Meal-analysis duration in seconds, including automatic retries.",
      labelNames: ["provider"] as const,
      buckets: AI_BUCKETS,
      registers: [registry],
    }),
    aiAnalysisRetriesTotal: new Counter({
      name: "ai_analysis_retries_total",
      help: "Automatic meal-analysis retries by the failure category that caused them.",
      labelNames: ["provider", "category"] as const,
      registers: [registry],
    }),
    aiAnalysisResultsTotal: new Counter({
      name: "ai_analysis_results_total",
      help: "Business result of successful provider executions (meal_detected or no_food).",
      labelNames: ["result"] as const,
      registers: [registry],
    }),
    dbHealthChecksTotal: new Counter({
      name: "db_health_checks_total",
      help: "Database health checks (GET /health/db) by outcome.",
      labelNames: ["outcome"] as const,
      registers: [registry],
    }),
    dbHealthCheckDurationSeconds: new Histogram({
      name: "db_health_check_duration_seconds",
      help: "Database health check duration in seconds.",
      buckets: DB_BUCKETS,
      registers: [registry],
    }),
  };
}

export type Metrics = ReturnType<typeof createMetrics>;
