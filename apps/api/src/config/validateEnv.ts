// Pure startup validation of the API's environment. Takes the environment as
// a parameter (rather than reading process.env itself) so it is trivially
// unit-testable, and never touches the network or the database.
//
// Messages name the offending VARIABLE only - they never include its value,
// so a misconfigured secret cannot leak into logs through this path.

export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

const NODE_ENVS = ["development", "test", "production"];
const AI_PROVIDERS = ["mock", "openai"];
const MIN_JWT_SECRET_LENGTH = 32;
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    // A CORS origin is scheme://host[:port] only - no path, query or trailing slash.
    if (isHttp && url.origin === value) {
      return url;
    }
  } catch {
    // fall through
  }
  return null;
}

export function validateEnv(source: NodeJS.ProcessEnv): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const read = (name: string): string => source[name]?.trim() ?? "";

  const nodeEnv = read("NODE_ENV") || "development";
  if (!NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${NODE_ENVS.join(", ")} (staging deployments use "production").`);
  }
  const isProduction = nodeEnv === "production";

  const port = read("PORT");
  if (port && !(/^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }

  const aiProvider = read("AI_PROVIDER") || "mock";
  if (!AI_PROVIDERS.includes(aiProvider)) {
    errors.push(`AI_PROVIDER must be one of: ${AI_PROVIDERS.join(", ")}.`);
  } else if (aiProvider === "openai" && !read("OPENAI_API_KEY")) {
    errors.push('OPENAI_API_KEY is required when AI_PROVIDER is "openai".');
  } else if (aiProvider === "mock" && isProduction) {
    warnings.push('AI_PROVIDER is "mock" in production mode - meal photo analysis returns canned results (fine for smoke tests only).');
  }

  const metricsEnabled = read("METRICS_ENABLED").toLowerCase();
  if (metricsEnabled && !["true", "false", "1", "0"].includes(metricsEnabled)) {
    errors.push("METRICS_ENABLED must be true or false.");
  } else if (isProduction && (metricsEnabled === "true" || metricsEnabled === "1")) {
    warnings.push("METRICS_ENABLED is on: GET /metrics is unauthenticated - restrict it at the network level (reverse proxy / firewall).");
  }

  const webOrigin = read("WEB_ORIGIN");
  if (isProduction && !webOrigin) {
    errors.push("WEB_ORIGIN is required in production (the single Web origin CORS will allow).");
  } else if (webOrigin) {
    const url = parseOrigin(webOrigin);
    if (!url) {
      errors.push("WEB_ORIGIN must be a single origin such as https://app.example.com (scheme + host [+ port], no path, no trailing slash, no wildcard).");
    } else if (isProduction && url.protocol !== "https:") {
      if (LOCAL_HOSTNAMES.includes(url.hostname)) {
        warnings.push("WEB_ORIGIN is plain http on localhost - acceptable only for a local production-like smoke run.");
      } else {
        errors.push("WEB_ORIGIN must use https in production.");
      }
    }
  }

  if (isProduction) {
    const databaseUrl = read("DATABASE_URL");
    if (!databaseUrl) {
      errors.push("DATABASE_URL is required in production.");
    } else {
      let validScheme = false;
      try {
        const protocol = new URL(databaseUrl).protocol;
        validScheme = protocol === "postgres:" || protocol === "postgresql:";
      } catch {
        // validScheme stays false
      }
      if (!validScheme) {
        errors.push("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
      }
    }

    const jwtSecret = read("JWT_SECRET");
    if (!jwtSecret) {
      errors.push("JWT_SECRET is required in production.");
    } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production.`);
    }
  }

  return { errors, warnings };
}
