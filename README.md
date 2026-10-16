# Healthy Eating AI

A learning project: a Web + Mobile nutrition tracking application with AI-powered meal photo analysis.

> **Milestone 18: Mobile Dashboard + Meals + History.** The Web MVP (auth, profile, nutrition target, meals, dashboard, history, recommendations, weekly plan, shopping list, AI meal analysis via Mock/OpenAI) is complete and stabilized. Mobile (Expo + React Native + TypeScript) has real Register/Login/Logout against the same accounts as Web (JWT sent as `Authorization: Bearer`, stored in Expo SecureStore), protected navigation, a real Profile screen, and real Dashboard / Meals (list + manual add) / History on the same backend data as Web; Recommendations, Plan and Shopping are still mobile skeletons. See [AGENTS.md](./AGENTS.md) for the engineering rules and [apps/mobile/README.md](./apps/mobile/README.md) for mobile-specific setup.

## Project structure

```
healthy-eating-ai/
├── apps/
│   ├── web/     # React + TypeScript app (Vite)
│   ├── api/     # Node.js + Express + TypeScript API
│   └── mobile/  # Expo + React Native + TypeScript app (see apps/mobile/README.md)
├── packages/
│   └── shared/  # TypeScript types/constants shared across web, mobile, backend
├── docs/        # Project documentation
├── README.md
├── AGENTS.md
├── .env.example
└── package.json # npm workspaces root
```

## Prerequisites

- Node.js 20+ (tested with Node 24)
- npm 10+ (tested with npm 11)
- For mobile: the [Expo Go](https://expo.dev/go) app (physical device) and/or an already-installed Android emulator. No Xcode is required for anything documented here — see [apps/mobile/README.md](./apps/mobile/README.md).

## Installation

From the repository root:

```bash
npm install
```

This installs dependencies for all workspaces (`apps/web`, `apps/api`, `apps/mobile`, `packages/shared`) in one step.

## Running the app

### Web only

```bash
npm run dev:web
```

Starts the Vite dev server at http://localhost:5173

### API only

```bash
npm run dev:api
```

Starts the Express API at http://localhost:4000

### Web and API together

```bash
npm run dev
```

Runs both dev servers concurrently in one terminal.

### Mobile

```bash
npm run dev:mobile
# equivalently:
npm run mobile:start
```

Starts the Expo CLI for `apps/mobile` - no environment variables need to be set by hand first (the mobile workspace's own scripts handle that; see [apps/mobile/README.md](./apps/mobile/README.md#why-devstartetc-are-wrapped-with-cross-env-node_path) if curious why). See [apps/mobile/README.md](./apps/mobile/README.md) for the full walkthrough, including why `localhost` needs a different value depending on whether you're running in Expo Web, the Android emulator, or on a physical phone.

### Type checking

```bash
npm run typecheck
```

Runs `tsc --noEmit` across the Web, API and shared workspaces. Mobile is checked separately:

```bash
npm run typecheck:mobile
```

kept out of the main `typecheck` aggregate because `apps/mobile` extends Expo's own base `tsconfig` (different `moduleResolution`/`jsx`/React version than Web) rather than this repo's shared one — see [apps/mobile/README.md](./apps/mobile/README.md#typescript) for the full rationale.

## Local URLs

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000 |
| API health check | http://localhost:4000/health |

## Calling GET /health

```bash
curl http://localhost:4000/health
```

Expected response (HTTP 200):

```json
{
  "status": "ok",
  "service": "healthy-eating-api"
}
```

## Environment variables

Copy `.env.example` to `.env` at the repository root and adjust as needed. It is shared by the API (via `--envPath`) and by the Web app (via Vite's `envDir`), so both read from the one file.

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | API | `development` (default), `test` or `production` (also used for staging) |
| `PORT` | API | Port the Express server listens on |
| `DATABASE_URL` | API | PostgreSQL connection string. Never exposed to the Web app. |
| `VITE_API_BASE_URL` | Web | Base URL the Web app calls the API at |
| `JWT_SECRET` | API | Signs/verifies the session JWT (Web cookie and Mobile Bearer token alike). Set a real, stable value outside local dev. |
| `WEB_ORIGIN` | API | The Web app's origin, echoed back by CORS so its credentialed session cookie is accepted. |
| `AI_PROVIDER` | API | `mock` (default, offline, what every automated test runs against) or `openai`. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | API | Only used when `AI_PROVIDER=openai`. Server-side secret — never exposed to the Web app. |

**Deployment / production:** see [docs/deployment.md](./docs/deployment.md) — required variables per environment, startup validation (production fails fast on invalid config and ignores `.env`), migrations, Docker, health checks, HTTPS assumption and known limitations.

Mobile reads its API base URL from a **separate** `apps/mobile/.env` (Expo does not support redirecting env loading to the repository root the way Vite's `envDir` does) — see [apps/mobile/README.md](./apps/mobile/README.md#api-configuration) for `EXPO_PUBLIC_API_BASE_URL` and why its value depends on where the app is running (desktop/Expo Web vs. Android emulator vs. physical phone).
