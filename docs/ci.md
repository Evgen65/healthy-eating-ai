# Continuous integration (M22)

Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml) (GitHub Actions). CI only — no deployment, no image publication, no secrets.

## Status

- The workflow file is written and its YAML parses.
- **It has not run on a hosted runner**: this directory is not a git repository and has no remote. Push to GitHub to get the first real run. Until then, no hosted result is claimed.

## Triggers

`pull_request`, `push` to `main` (rename if your primary branch differs), and manual `workflow_dispatch` (the only trigger of the optional Android job). A newer commit on the same ref cancels the obsolete run.

## Jobs and local reproduction

| Job | Timeout | Steps → local command |
|---|---|---|
| `static-and-web` | 20 min | `npm ci`, `npm run typecheck`, `npm run typecheck:mobile`, `npm run test:web`, `npm run build` (with `VITE_API_BASE_URL=https://api.example.test`) |
| `api-and-e2e` | 30 min | PostgreSQL 16 service → `npm run db:migrate` → `npm run db:status` → `npm run test:api` → `npm run test:e2e` |
| `smoke-prod` | 20 min | PostgreSQL 16 service → `npm run build` → `npm run db:migrate` → `npm run smoke:prod` |
| `docker` | 15 min | `docker build`, run the image against a PostgreSQL service, check `/health` and `/health/db`, `docker stop` must exit 0 (SIGTERM). Image is never pushed. |
| `mobile-android` (manual) | 60 min | `mobile:api`, `mobile:metro`, `mobile:appium`, `test:mobile:doctor`, `test:mobile` |

To reproduce locally, run the same npm command against your own scratch PostgreSQL (`DATABASE_URL`, `AI_PROVIDER=mock`). `test:api`/`test:e2e` create and delete their own users; use a disposable database.

## Environment and secrets

- Node 22 (matches `node:22-alpine` in the Dockerfile; the project requires ≥ 20).
- `npm ci` everywhere; the setup-node cache stores only the npm download cache, never `node_modules`.
- PostgreSQL is a service container created per job (`ci_user` is the superuser of the throwaway cluster, so `CREATE EXTENSION pgcrypto` works). Migrations run on the empty database; no dump is loaded. The credentials are CI-only and protect nothing.
- `AI_PROVIDER=mock`; `OPENAI_API_KEY` is never defined. `JWT_SECRET` is a fake CI-only value (the Docker job generates a random one and masks it). No GitHub secrets are used.
- `permissions: contents: read`; no step prints tokens, headers or secrets (the smoke script also checks the API log).

## Failure artifacts

On failure, jobs upload the Playwright HTML reports and `test-results/` (screenshots, traces, videos where generated), retention 7 days. They can contain data of throwaway CI users only; `.env` and databases are never uploaded.

## Android job (optional, not verified)

Manual only. Uses the existing scripts. Emulator: API 30, x86_64, `google_apis`, Pixel 5 (local AVD `Nex5` is API 26/x86; local configuration is unchanged). Expo Go for SDK 57 is downloaded from `api.expo.dev/v2/versions/latest` and installed with `adb`. The job is a best-effort implementation and has **not** been run; the verified Mobile baseline remains the local 8/8 run. It is deliberately not a required check.

## Recommended branch protection (not configured)

Once on GitHub: protect `main`, require a PR and the checks `static-and-web`, `api-and-e2e`, `smoke-prod`, `docker` to pass. Do not require `mobile-android`.

## Not included

CD, registry push, Dependabot, security scanning (`npm audit` may be run manually; do not use `--force` fixes).
