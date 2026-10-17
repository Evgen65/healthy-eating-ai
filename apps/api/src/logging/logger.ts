import { pino, stdTimeFunctions, type DestinationStream, type Logger } from "pino";

export type { Logger };

const SERVICE_NAME = "healthy-eating-api";
const LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

/**
 * Fields that must never reach a log line, wherever they appear (top level,
 * one level deep, or inside `headers` / `req.headers`). This is the safety
 * net: call sites are also expected not to pass these values in the first
 * place.
 */
export const REDACT_PATHS = [
  "authorization",
  "cookie",
  "password",
  "token",
  "jwt",
  "apiKey",
  "databaseUrl",
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "JWT_SECRET",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.authorization",
  "*.cookie",
  "*.password",
  "*.token",
  "*.jwt",
  "*.apiKey",
  "*.databaseUrl",
  "*.DATABASE_URL",
  "*.OPENAI_API_KEY",
  "*.JWT_SECRET",
];

const SECRET_ENV_NAMES = ["DATABASE_URL", "OPENAI_API_KEY", "JWT_SECRET"];
const MIN_SECRET_LENGTH = 8;

/** Literal values of the configured secrets (read lazily, so values set after startup are covered too). */
function currentSecretValues(): string[] {
  const values: string[] = [];
  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value && value.length >= MIN_SECRET_LENGTH) {
      values.push(value);
      // The same value as it appears inside a JSON string literal.
      const escaped = JSON.stringify(value).slice(1, -1);
      if (escaped !== value) {
        values.push(escaped);
      }
    }
  }
  return values;
}

/** Last line of defence: replaces any configured secret that slipped into a serialized log line (e.g. inside an error message). */
export function scrubSecrets(line: string): string {
  let result = line;
  for (const secret of currentSecretValues()) {
    result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

function withScrubbing(target: { write(chunk: string): unknown }): DestinationStream {
  return { write: (line: string) => void target.write(scrubSecrets(line)) };
}

/** Serializes an error into safe, bounded fields - never the raw object (which may carry request/query internals). */
export function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { type: "NonError", message: "non-error value thrown" };
  }
  const code = (error as { code?: unknown }).code;
  return {
    type: error.constructor.name,
    message: error.message,
    ...(typeof code === "string" ? { code } : {}),
    stack: error.stack,
  };
}

function resolveLevel(raw: string | undefined): string {
  const level = raw?.trim().toLowerCase();
  return level && LEVELS.has(level) ? level : "info";
}

export interface CreateLoggerOptions {
  /** Defaults to stdout. Secrets are scrubbed from whatever destination is used. */
  destination?: { write(chunk: string): unknown };
  level?: string;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return pino(
    {
      level: resolveLevel(options.level ?? process.env.LOG_LEVEL),
      base: { service: SERVICE_NAME },
      timestamp: stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      serializers: { err: serializeError },
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    withScrubbing(options.destination ?? process.stdout),
  );
}

/** The process-wide root logger. Structured JSON, one event per line, on stdout. */
export const logger = createLogger();
