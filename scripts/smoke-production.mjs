// Production-like local smoke test (M21E). Not part of the automated suites.
//
//   npm run build
//   DATABASE_URL=postgresql://... npm run db:migrate     # empty DB -> usable
//   DATABASE_URL=postgresql://... npm run smoke:prod
//
// Starts the COMPILED API (NODE_ENV=production, AI_PROVIDER=mock - no OpenAI
// credits are spent) and the built Web bundle via `vite preview`, then walks
// health -> register -> profile -> target -> dashboard -> meal -> AI (mock)
// and checks the production cookie/CORS behaviour. The root .env is NOT read
// in production mode, so everything the API needs is passed explicitly below.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_PORT = process.env.SMOKE_API_PORT ?? "4100";
const WEB_PORT = process.env.SMOKE_WEB_PORT ?? "4173";
const API = `http://localhost:${API_PORT}`;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set (a migrated PostgreSQL database - never your real data).");
  process.exit(1);
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

async function waitFor(url, label) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

const apiLog = [];
const api = spawn(process.execPath, ["--conditions=healthy-eating-runtime", "apps/api/dist/index.js"], {
  cwd: root,
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: "production",
    PORT: API_PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: randomBytes(32).toString("hex"),
    WEB_ORIGIN,
    AI_PROVIDER: "mock",
  },
});
api.stdout.on("data", (d) => apiLog.push(String(d)));
api.stderr.on("data", (d) => apiLog.push(String(d)));

const web = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "preview", "--port", WEB_PORT, "--strictPort"], {
  cwd: resolve(root, "apps/web"),
  stdio: "ignore",
});

async function json(path, { method = "GET", body, token, cookie, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { res, data: text ? JSON.parse(text) : null };
}

try {
  await waitFor(`${API}/health`, "API");
  await waitFor(WEB_ORIGIN, "Web preview");

  const health = await json("/health");
  check("GET /health", health.res.status === 200 && health.data.status === "ok");
  const db = await json("/health/db");
  check("GET /health/db (database reachable)", db.res.status === 200 && db.data.status === "ok");

  const web1 = await fetch(WEB_ORIGIN);
  check("Web production build served", web1.status === 200 && (await web1.text()).includes('<div id="root">'));

  const preflight = await fetch(`${API}/api/auth/login`, {
    method: "OPTIONS",
    headers: { Origin: WEB_ORIGIN, "Access-Control-Request-Method": "POST" },
  });
  check("CORS allows the configured Web origin with credentials",
    preflight.headers.get("access-control-allow-origin") === WEB_ORIGIN &&
      preflight.headers.get("access-control-allow-credentials") === "true");
  const foreign = await fetch(`${API}/api/auth/login`, {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
  });
  check("CORS does not allow a foreign origin", foreign.headers.get("access-control-allow-origin") !== "https://evil.example" && foreign.headers.get("access-control-allow-origin") !== "*");

  const email = `smoke-${Date.now()}@example.com`;
  const password = "smoke-password-1";

  // Web cookie auth
  const webReg = await json("/api/auth/register", { method: "POST", body: { email, password } });
  const setCookie = webReg.res.headers.get("set-cookie") ?? "";
  check("Web register -> 201", webReg.res.status === 201);
  check("Session cookie is HttpOnly + Secure + SameSite=Lax in production",
    /HttpOnly/i.test(setCookie) && /; Secure/i.test(setCookie) && /SameSite=Lax/i.test(setCookie), setCookie.replace(/=[^;]+/, "=<redacted>"));
  const cookie = setCookie.split(";")[0];
  const me = await json("/api/auth/me", { cookie });
  check("Cookie session accepted by /api/auth/me", me.res.status === 200 && me.data.email === email);

  // Mobile Bearer auth
  const mobileLogin = await json("/api/auth/mobile/login", { method: "POST", body: { email, password } });
  const token = mobileLogin.data?.token;
  check("Mobile login returns Bearer token", mobileLogin.res.status === 200 && typeof token === "string");
  check("Unauthenticated request -> 401", (await json("/api/me/profile")).res.status === 401);

  const profile = await json("/api/me/profile", {
    method: "POST",
    token,
    body: { age: 30, sex: "male", heightCm: 180, weightKg: 80, activityLevel: "moderate", jobType: "desk", workoutsPerWeek: 3, goal: "maintain" },
  });
  check("Create profile", profile.res.status === 201 || profile.res.status === 200, String(profile.res.status));
  const target = await json("/api/me/nutrition-target/calculate", { method: "POST", token });
  check("Calculate nutrition target", target.res.status === 200 || target.res.status === 201, String(target.res.status));

  const meal = await json("/api/me/meals", {
    method: "POST",
    token,
    body: { mealType: "lunch", eatenAt: new Date().toISOString(), items: [{ name: "Rice", quantityG: 150, calories: 200, proteinG: 4, fatG: 1, carbsG: 44 }] },
  });
  check("Create meal", meal.res.status === 201, String(meal.res.status));
  const today = await json("/api/me/nutrition/today", { token });
  check("Dashboard summary reflects the meal", today.res.status === 200 && JSON.stringify(today.data).includes("200"), String(today.res.status));

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])], { type: "image/jpeg" }), "meal.jpg");
  const ai = await fetch(`${API}/api/ai/meal-analysis`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  check("AI meal analysis (mock provider)", ai.status === 200, String(ai.status));

  const logText = apiLog.join("");
  check("API logs contain no token / password / DATABASE_URL", !logText.includes(token) && !logText.includes(password) && !logText.includes(process.env.DATABASE_URL));
} catch (error) {
  failures++;
  console.error("FAIL  smoke aborted:", error instanceof Error ? error.message : error);
  console.error("--- API output ---\n" + apiLog.join(""));
} finally {
  web.kill();
  if (process.platform === "win32") {
    // Windows cannot deliver SIGTERM to a child; graceful shutdown is verified in the Docker smoke instead.
    api.kill();
  } else {
    const exited = new Promise((r) => api.once("exit", (code) => r(code)));
    api.kill("SIGTERM");
    const code = await exited;
    check("Graceful shutdown on SIGTERM exits 0", code === 0, `exit code ${code}`);
  }
}

console.log(failures === 0 ? "\nSMOKE PASS" : `\nSMOKE FAIL (${failures} failing check(s))`);
process.exit(failures === 0 ? 0 : 1);
