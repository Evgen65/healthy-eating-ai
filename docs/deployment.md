# Deployment guide (M21)

Scope: getting Healthy Eating AI running in a production-like environment. No CD, orchestration or infrastructure-as-code is included.

## Environments

One mechanism — `NODE_ENV` plus real environment variables — no extra environment system.

| Environment | `NODE_ENV` | Configuration source | AI |
|---|---|---|---|
| development | unset / `development` | root `.env` (git-ignored, from `.env.example`) | `mock` (or `openai` locally) |
| test | `test` (Playwright) | root `.env` + suite overrides | always `AI_PROVIDER=mock` (forced in `playwright.*.config.ts`) |
| staging | `production` | platform environment variables | `mock` or `openai` |
| production | `production` | platform environment variables | `openai` |

In `production` mode the API **does not read any `.env` file** and **refuses to start** (exit 1, clear message naming the variable, never its value) if configuration is invalid. Staging is just production mode with staging values.

## Environment variables

**API**

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | prod: `production` | `development` \| `test` \| `production` |
| `PORT` | no (4000) | 1–65535. Binds all interfaces. |
| `DATABASE_URL` | prod | `postgresql://…`; add `?sslmode=require` for managed DBs |
| `JWT_SECRET` | prod | ≥ 32 chars. No default in production. |
| `WEB_ORIGIN` | prod | single `https://` origin, no path/wildcard (CORS + credentials) |
| `AI_PROVIDER` | no (`mock`) | `mock` \| `openai`; anything else fails startup. Never falls back silently. |
| `OPENAI_API_KEY` | if `openai` | server-side only |
| `OPENAI_MODEL` | no | default in `apps/api/src/config/env.ts` |

**Web** (build-time, public only): `VITE_API_BASE_URL` — required for a production build (`https://` unless localhost). Only `VITE_*` values enter the bundle.

**Mobile** (`apps/mobile/.env`): `EXPO_PUBLIC_API_BASE_URL` — `localhost` / `10.0.2.2` / LAN IP in development; a release bundle refuses a non-`https://` URL. Never put secrets here. Store builds/signing are out of scope for M21.

## Build

```bash
npm ci
VITE_API_BASE_URL=https://api.example.com npm run build   # shared + API (dist) + Web (apps/web/dist)
```

Node ≥ 20 (tested on 24); PostgreSQL 13+ (migrations use `pgcrypto`, which needs permission to `CREATE EXTENSION` — allowed on typical managed services).

## Database migrations

A new empty database becomes usable solely by running migrations (no manual SQL):

```bash
DATABASE_URL=postgresql://… npm run db:migrate   # apply
DATABASE_URL=postgresql://… npm run db:status    # dry run: lists pending migrations
```

Run migrations as a deployment step **before** starting the new API version. Migrations are ordered by timestamp; do not edit applied ones — add a new migration.

## Run the API (without Docker)

```bash
NODE_ENV=production PORT=4000 DATABASE_URL=… JWT_SECRET=… WEB_ORIGIN=https://app.example.com \
AI_PROVIDER=openai OPENAI_API_KEY=… npm run start:api
```

(`start` runs `node --conditions=healthy-eating-runtime dist/index.js`; the condition makes the workspace package `@healthy-eating-ai/shared` resolve to its compiled `dist` instead of its TypeScript source.)

## Run the API with Docker

```bash
docker build -t healthy-eating-api .
docker run --rm -e DATABASE_URL=… healthy-eating-api npm run migrate:up --workspace=apps/api
docker run -d -p 4000:4000 -e NODE_ENV=production -e DATABASE_URL=… -e JWT_SECRET=… \
  -e WEB_ORIGIN=https://app.example.com -e AI_PROVIDER=openai -e OPENAI_API_KEY=… healthy-eating-api
```

The image contains compiled code and production dependencies only — no secrets, no `.env`, no dev server. PostgreSQL stays external. Docker is optional; the npm workflow above remains valid.

## Web

`apps/web/dist` is a static bundle: host it on any static host/CDN with **SPA fallback to `index.html`**. `VITE_API_BASE_URL` is fixed at build time, so build once per environment. Local check: `npm run preview:web`.

## HTTPS

Production assumes HTTPS, terminated by the hosting platform / reverse proxy — Express does not serve TLS. The session cookie is `Secure` in production. Trust-proxy is intentionally **not** enabled (nothing in the API depends on `req.ip`/`req.protocol`); enable it only if that changes. Mobile release builds refuse non-HTTPS API URLs.

## Authentication notes

- Web: httpOnly cookie, `SameSite=Lax`, `Secure` in production. CORS echoes the single `WEB_ORIGIN` with credentials. Because of `SameSite=Lax`, Web and API must share a registrable domain (e.g. `app.example.com` + `api.example.com`) or be served from one origin.
- Mobile: `Authorization: Bearer <JWT>` (SecureStore); not subject to CORS.

## Health checks

- `GET /health` — process alive; no DB, no OpenAI. Use for liveness.
- `GET /health/db` — API can reach PostgreSQL (5 s connection timeout; 503 otherwise). Use for readiness/diagnostics.

OpenAI outages never affect either endpoint; they surface only as controlled errors from `/api/ai/meal-analysis`.

## Shutdown

`SIGTERM`/`SIGINT`: stop accepting connections, finish in-flight requests, close the DB pool, exit 0 (forced exit after 10 s). Each step is logged as a `shutdown_*` event.

## Logging

**Format.** One JSON object per line on stdout (Pino), in every environment. Common fields: `level` (`fatal`/`error`/`warn`/`info`/`debug`), `time` (ISO 8601), `service`, `event` (stable snake_case name) and, inside a request, `requestId`. Set `LOG_LEVEL` (default `info`; `silent` disables output). There is no pretty-printer; pipe through `jq` locally if you want readable output.

**Levels.** `info` successful requests and lifecycle; `warn` 4xx responses, AI retries, config warnings; `error` 5xx, unhandled errors, AI failures, DB failures; `debug` successful `/health*` probe requests and per-call OpenAI detail.

**Request ID.** Every request gets a server-generated UUID (any client-supplied `X-Request-Id` is ignored), returned in the `X-Request-Id` response header (also CORS-exposed to the Web app) and attached to every log line written for that request. It is a correlation label only - never authentication or authorization data.

**Events.** `http_request_completed` (`method`, `path` = matched route pattern such as `/api/me/meals/:id`, or `unmatched`; `status`, `durationMs`), `unhandled_error`, `invalid_request_body`, `http_request_aborted`, `ai_analysis_started` / `ai_analysis_retry` / `ai_analysis_succeeded` / `ai_analysis_failed` (`provider`, `category`, `attempt(s)`, `durationMs`, provider status/code), `db_health_check_failed`, `db_pool_error`, `server_started`, `config_warning`, `config_invalid`, `shutdown_*`. SQL queries are not logged.

```json
{"level":"info","time":"2026-01-01T12:00:00.000Z","service":"healthy-eating-api","requestId":"0b0e…","event":"http_request_completed","method":"POST","path":"/api/me/meals","status":201,"durationMs":42.17}
```

**Never logged.** Request/response bodies, full headers, `Authorization`, cookies, passwords, JWTs, image data/base64, raw OpenAI responses, query parameters, `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`. Enforced by not passing them, by Pino redaction of those field names, and by a final scrub of the configured secret values from every output line.

**Correlation.** When a user reports a problem, take the `X-Request-Id` from the response (or the failing client call) and filter logs on that `requestId`: you get the completion line, any `unhandled_error` or `ai_analysis_*` events, in one query (`grep <id>` / `jq` / your log platform). Provider-side ids appear as `providerRequestId`.

## Production-like smoke (no OpenAI credits)

```bash
npm run build
DATABASE_URL=postgresql://…/scratch_db npm run db:migrate
DATABASE_URL=postgresql://…/scratch_db npm run smoke:prod
```

Starts the compiled API (`NODE_ENV=production`, `AI_PROVIDER=mock`) and `vite preview`, then checks health, structured logs / `X-Request-Id`, CORS, register/login (cookie + Bearer), profile, target, meal, dashboard and mock AI. Use a scratch database — it creates a user.

## Known limitations

- JWT logout does not revoke already-issued tokens (valid until expiry, 7 days).
- Migration status is `node-pg-migrate up --dry-run` (pending list); there is no richer status command.
- Windows cannot deliver `SIGTERM` to a child process, so graceful shutdown is verified on Linux (Docker).
- No CD, monitoring, rate limiting or store builds yet. CI: see [ci.md](./ci.md).
