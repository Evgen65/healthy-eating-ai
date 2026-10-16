# Healthy Eating AI — Mobile (Milestone 19: Camera / Photo → AI Meal Analysis)

Expo + React Native + TypeScript mobile app. Milestone 16 established the
structure, navigation and API configuration; Milestone 17 adds real
Register/Login/Logout (same accounts as Web), session persistence,
protected navigation and a real Profile screen. Milestone 18 wires
Dashboard, Meals (list + manual Add Meal) and History to the same backend
data the Web app uses. Milestone 19 adds AI photo meal analysis on Meals
(gallery or camera → Analyze → review/correct → Confirm). Milestone 20 wires
Recommendations, Plan and Shopping to the existing backend, and Milestone
20.5 adds native Android automation (see [Automated tests](#automated-tests-appium)).
See [Scope / what's NOT here yet](#scope--whats-not-here-yet).

## Stack

- [Expo](https://expo.dev) (managed workflow — no native Android/iOS
  project checked in, no Xcode required)
- React Native
- TypeScript
- [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
  (gallery + system camera for AI meal photos; works in Expo Go)
- [Expo Router](https://docs.expo.dev/router/introduction/) (file-based
  routing, built on React Navigation)

Run `cat package.json` for the exact installed versions — see the root
milestone report for the versions captured at the time this was set up.

## Directory structure

```
apps/mobile/
├── app/                       Expo Router routes - one file per screen
│   ├── _layout.tsx             Root Stack + AuthProvider + route guards (Stack.Protected)
│   ├── index.tsx                Entry: loading while the session restores, then redirects
│   ├── login.tsx                 Login form (unauthenticated only)
│   ├── register.tsx               Register form (unauthenticated only)
│   ├── dev-status.tsx              Backend connectivity check (authenticated only)
│   └── (tabs)/                      The 7 product sections (authenticated only)
│       ├── _layout.tsx               Tab navigator
│       ├── dashboard.tsx              Today's target/consumed/remaining, target calculation, Log out
│       ├── meals.tsx                   Meal list + manual Add Meal + AI photo analysis
│       ├── history.tsx                  Daily summary + meals for a selected date
│       ├── profile.tsx                   Real Profile load/save
│       └── recommendations.tsx  plan.tsx  shopping.tsx  (skeletons)
├── src/
│   ├── config/env.ts            Centralized API_BASE_URL (see below)
│   ├── api/httpClient.ts         The single HTTP client (Bearer header, errors, 401 handling)
│   ├── api/profileApi.ts          /api/me/profile client
│   ├── api/nutritionApi.ts         /api/me/nutrition/today + nutrition-target/calculate
│   ├── api/mealApi.ts               /api/me/meals (list, get one, create)
│   ├── api/mealAnalysisApi.ts        POST /api/ai/meal-analysis (multipart upload, error mapping)
│   ├── api/historyApi.ts             /api/me/history/daily
│   ├── api/messages.ts                Controlled user-facing error texts
│   ├── api/health.ts               GET /health client
│   ├── auth/tokenStorage.ts         The only SecureStore access (get/set/removeToken)
│   ├── auth/authApi.ts               Mobile login/register + GET /api/auth/me
│   ├── auth/AuthContext.tsx           Auth state, login/register/logout/restoreSession
│   ├── auth/credentialsForm.ts         Login/Register client-side checks
│   ├── profile/profileForm.ts           Profile form state + validation
│   ├── meals/mealForm.ts                 Add Meal / AI review form state, validation, live totals (same rules as Web)
│   ├── meals/mealPhoto.ts                Gallery/camera selection via expo-image-picker, permissions, type/size checks
│   ├── hooks/useFocusedData.ts            Load on focus / pull-to-refresh / retry, latest-response-wins
│   ├── utils/date.ts, utils/number.ts      Date (see "Dates" below) and numeric-input helpers
│   └── components/                        ScreenContainer, NavLinkButton, TextField, ChoiceField, PrimaryButton,
│                                          FormMessage, StatusMessage, NutritionSummaryTable, MealCard
├── app.json                    Expo app config
├── metro.config.js              Resolves packages/shared's ".js"-extension imports to their .ts source (see below)
├── .env.example                 Copy to .env and adjust per target
└── package.json
```

## Getting started

From the **repository root** (this app is an npm workspace, so `npm
install` at the root already installed everything it needs):

```bash
npm run dev:mobile
# or, equivalently:
npm run mobile:start
```

Both run `expo start` inside `apps/mobile`. This opens the Expo CLI, which
lets you launch the app in:

- **Expo Web** — press `w`, opens in your desktop browser.
- **Android emulator** — press `a` (requires an already-running Android
  emulator; no Xcode/Android Studio setup is documented here beyond that).
- **Expo Go on a physical device** — scan the printed QR code with the Expo
  Go app.

(`npm run android` / `npm run ios` / `npm run web` inside `apps/mobile`
itself also work individually, matching Expo's own conventions.)

You do **not** need to set any environment variable by hand before running
these - see [Why `dev`/`start`/etc. are wrapped with `cross-env`](#why-devstartetc-are-wrapped-with-cross-env-node_path)
below if you're curious why the scripts look the way they do.

### Why `dev`/`start`/etc. are wrapped with `cross-env NODE_PATH`

`apps/mobile`'s own scripts (`start`, `dev`, `android`, `ios`, `web`) run as
`cross-env NODE_PATH=./node_modules expo start [...]`, not a bare
`expo start`. This isn't decorative - without it, bundling fails with:

```
Error: Cannot find module 'expo/package.json'
Require stack:
- .../node_modules/@expo/metro-config/build/transform-worker/utils/moduleMapper.js
...
```

**Root cause:** in this npm workspace, `expo` itself stayed nested under
`apps/mobile/node_modules/expo` (never hoisted to the repo root), while
`@expo/metro-config` (one of `expo`'s own dependencies) *did* get hoisted
to the root `node_modules`. When that root-resolved `@expo/metro-config`
internally does `require.resolve("expo/package.json")`, Node's normal
module resolution only walks *upward* from the requiring file's own
location - and the root `node_modules` is not an ancestor of
`apps/mobile/node_modules`, so it can never find `expo` there no matter
how far up it walks.

**Fix:** `NODE_PATH` is Node's documented escape hatch for exactly this -
an extra list of directories consulted whenever the normal upward walk
fails, regardless of an ancestor relationship. Pointing it at
`apps/mobile/node_modules` lets that same `require.resolve("expo/package.json")`
succeed. `cross-env` sets it the same way on Windows/PowerShell, cmd.exe
and POSIX shells, so no manual `$env:NODE_PATH = ...` step is needed -
`npm run dev:mobile` (or any of this app's own scripts) works the same in
a fresh shell every time. The path is written as the relative
`./node_modules` deliberately: npm always runs a workspace's own script
with that workspace's directory as the working directory (whether invoked
as `npm run dev --workspace=apps/mobile` from the repo root, or directly
from inside `apps/mobile`), so it resolves to the same
`apps/mobile/node_modules` either way without hardcoding an
environment-specific absolute path.

This is a workaround for how this specific dependency tree got hoisted,
not a permanent architectural fixture - if a future clean
`npm install` ever hoists `expo` itself to the root too, this stops being
necessary (harmless either way; `NODE_PATH` just becomes a redundant extra
search location).

## Authentication (Milestone 17)

Mobile uses the **same accounts, password hashing and JWT** as the Web app
— a user registered on either client can log in on the other, and sees the
same Profile. Only the token *transport* differs:

| | Web | Mobile |
|---|---|---|
| Register / login | `POST /api/auth/register`, `/api/auth/login` | `POST /api/auth/mobile/register`, `/api/auth/mobile/login` |
| Token delivered as | httpOnly `heai_session` cookie (never readable by JS) | `{ "user": {...}, "token": "<JWT>" }` response body, no cookie |
| Token stored in | the browser's cookie jar | Expo SecureStore (`src/auth/tokenStorage.ts`) — never AsyncStorage |
| Token sent as | cookie | `Authorization: Bearer <JWT>` (added only by `src/api/httpClient.ts`) |
| Logout | `POST /api/auth/logout` clears the cookie | the stored token is deleted locally |

The backend's `requireAuth` accepts either transport and verifies both
with the same code; business routes still only read `req.user.id`.

**Session lifecycle:** on startup the app reads the stored token; with no
token it goes to Login, with a token it calls `GET /api/auth/me`. `200`
restores the user; `401` deletes the token and goes to Login; a network
failure or 5xx **keeps** the token and shows "Unable to reach the server"
with a Retry button (an outage says nothing about whether the token is
still valid). A `401` from any later authenticated request likewise
deletes the token and returns to Login. There are no refresh tokens: the
JWT expires after 7 days, after which the user logs in again.

**Route protection** uses Expo Router's `<Stack.Protected>` (available in
the installed expo-router 57 / SDK 57) in `app/_layout.tsx`: `(tabs)` and
`dev-status` only exist while authenticated, `login`/`register` only while
unauthenticated, and neither while the session is still being restored.
These guards are UX only — the backend authorizes every request.

> **HTTPS:** local development talks to the API over plain HTTP on the LAN
> (e.g. `http://<your-lan-ip>:4000`). That is acceptable **only** for local
> development. Any real deployment **must** serve the API over HTTPS —
> passwords and Bearer tokens travel in these requests.

## Data screens (Milestone 18)

Dashboard, Meals and History call the same `/api/me/...` endpoints as the
Web app through the central `httpClient` (Bearer auth), so both clients
always show the same data for the same account. Every number (target,
consumed, remaining, meal totals) is calculated by the backend - Mobile
never recomputes it.

**Freshness without a cache library:** each screen loads via
`useFocusedData`, which refetches every time the tab becomes active
(tabs stay mounted) and on pull-to-refresh. A meal added on Meals - or on
Web - therefore shows up on Dashboard/History as soon as that tab is
opened again. No polling, sockets or background sync.

**Dates:** exactly the Web app's semantics. A meal's date/time is entered
in local time (pre-filled with "now") and sent as a UTC instant. History
defaults to the device's local date and sends the selected `YYYY-MM-DD`
verbatim; the backend aggregates that **UTC** calendar day (the known
project-wide limitation - e.g. a meal at 01:00 local time in UTC+3 is
counted on the previous UTC day, on Web and Mobile alike). Previous/next
day is plain calendar arithmetic, so the device timezone can never shift
the selected date. No date-picker dependency was added.

## AI photo analysis (Milestone 19)

The Meals tab's **AI photo analysis** section is the mobile counterpart of
Web's AI Photo Analysis and uses the same backend - no mobile-specific AI
or persistence endpoint:

1. **Choose photo** (system photo picker) or **Take photo** (system camera
   UI) via `expo-image-picker` - no custom camera screen, no
   `expo-camera`, runs in Expo Go. The image is used as returned
   (quality 1, no cropping/compression). JPEG/PNG/WEBP up to 10 MB are
   accepted (same limits as the backend); anything else gets a controlled
   message before upload.
2. **Analyze photo** uploads it - only then - as multipart field `image`
   to the authenticated `POST /api/ai/meal-analysis` through `httpClient`
   (Bearer token, 401 → existing logout/redirect). The multipart
   `Content-Type`/boundary is left to React Native. The request timeout is
   raised to 120 s because the backend may legitimately take up to
   2 × 45 s.
3. The estimate is shown as editable items (name, quantity, calories,
   macros; remove/add item; Reset to AI estimate). Totals update live via
   the shared `calculateMealTotals`.
4. **Confirm meal** (with meal type + date/time) sends an ordinary
   `POST /api/me/meals` with the same validation/payload as manual Add
   Meal. Analysis alone never saves anything.

Analyze and Confirm each have a synchronous ref guard (a fast double tap is
one request). Errors map to the same messages as Web (no food, busy,
unavailable, took too long, connection error) and keep the photo selected
for a retry. A new photo clears the previous estimate; a response that
arrives for a photo that has since been replaced is discarded.

**Permissions:** the photo picker needs none on current Android/iOS, so
none is requested up front; the photo-library permission is asked for only
if the picker cannot open. Camera permission is requested on **Take
photo**. If access is denied the user gets a plain message (plus an
**Open Settings** button once the OS will no longer prompt); tapping the
button again after granting retries.

**Real AI in manual QA:** the backend must run with `AI_PROVIDER=openai`.
Mobile never falls back to Mock - if OpenAI is unavailable, a controlled
error is shown.

## Navigation

`app/index.tsx` is the entry point: a loading indicator while the session
is restored, then a redirect to Dashboard or Login. The `(tabs)` group —
Dashboard, Meals, History, Recommendations, Plan, Shopping, Profile — is
one-for-one with `apps/web/src/components/layout/Sidebar.tsx`'s nav items.
Log out lives on Dashboard, next to the signed-in email.

## API configuration

All API calls go through one constant: `API_BASE_URL`, exported from
[`src/config/env.ts`](./src/config/env.ts). No screen or component ever
hardcodes a URL.

It reads `process.env.EXPO_PUBLIC_API_BASE_URL`, which Expo inlines at
bundle time from **`apps/mobile/.env`** (copy `.env.example` to `.env` and
uncomment the line for your target — see the comments in both files for
the full reasoning). This is a separate `.env` from the one at the
repository root that the API/Web apps share, because Expo's env loading is
hardcoded to look inside the Expo project's own directory — it does not
support Vite's `envDir`-style redirect to a different folder.

### `localhost` means something different depending on where the app runs

This trips up almost everyone the first time, so it's worth stating
explicitly:

| Where the app runs | What to set `EXPO_PUBLIC_API_BASE_URL` to | Why |
|---|---|---|
| Desktop / Expo Web (`npm run web`) | `http://localhost:4000` (the default) | Runs in a real desktop browser on the same machine as the API — behaves exactly like the Web app. |
| iOS Simulator | `http://localhost:4000` | The simulator shares the host Mac's network directly. |
| Android emulator | `http://10.0.2.2:4000` | The emulator is its own VM with its own loopback — `localhost` there means the emulator itself. Android maps the special address `10.0.2.2` to the host machine's `localhost`. |
| Physical phone (Expo Go or a dev build) | `http://<your-machine's-LAN-IP>:4000` | The phone is a separate device on the network — neither `localhost` nor `10.0.2.2` can ever reach your development machine from it. Find your LAN IP with `ipconfig` (Windows) and make sure the phone is on the same Wi-Fi. Windows Firewall may need to allow inbound connections on port 4000. |

This is **not** auto-detected — M16 deliberately keeps it manual (set the
right value in `.env` for whatever you're currently running against)
rather than guessing at connectivity.

## Backend connectivity check

`app/dev-status.tsx` is a temporary "Development / System Status" screen
(linked from the landing screen, not part of the product tab bar) that
calls the API's existing, unauthenticated `GET /health`
(`src/api/health.ts` → `apps/api/src/routes/health.ts`) and shows either
"Backend reachable" or "Backend is unavailable." plus the currently
configured `API_BASE_URL` (handy for confirming you set `.env` correctly).
It never shows a raw exception, stack trace, or other internal diagnostic
- every failure path (network error, timeout, non-200, malformed body)
collapses to the same controlled "unavailable" state.

This is explicitly a Milestone 16 verification aid, not a permanent
product feature — it isn't in the tab bar; since Milestone 17 it is only
reachable after login, via a link on Dashboard.

## Shared code

Platform-neutral types/constants from `packages/shared` (e.g. `APP_NAME`,
`Meal`, `MealType`, `UserProfile`, …) are reused as-is — see `app/index.tsx`
importing `APP_NAME`. Nothing React/Web-specific from `apps/web` is pulled
in. As each screen gets real API integration in a later milestone, prefer
reusing the existing shared request/response types before introducing new
mobile-only ones.

## TypeScript

Mobile has its **own** typecheck command, deliberately kept out of the
root `npm run typecheck` aggregate:

```bash
npm run typecheck:mobile
```

(equivalently, from this directory: `npm run tsc:check`)

**Why separate:** this project extends `expo/tsconfig.base`, not the
monorepo's shared `tsconfig.base.json` — Expo requires its own
`moduleResolution`/`jsx`/`lib` settings tailored to React Native, and pins
its own React version (`19.2.3` at the time of writing) independently of
`apps/web`'s (`18.3.1`). Folding it into the same `tsc --workspaces` sweep
as Web/API would couple an unrelated web-only or api-only change's
`npm run typecheck` to the mobile toolchain (and vice versa) for no benefit
— each workspace's `tsc` run is already an independent process. Keeping it
as its own explicit command means it's still fully validated, just not
load-bearing for the existing root command.

## Automated tests (Appium)

Native Android E2E for this app (Appium + UiAutomator2 via WebdriverIO,
Expo Go on an Android Emulator) lives in `tests/mobile/` at the repository
root - see [tests/mobile/README.md](../../tests/mobile/README.md). For the
emulator, start Metro with `npm run mobile:metro` (root), which points the
app at `http://10.0.2.2:4000` without touching this directory's `.env`.

UI elements used by those tests carry a `testID` (Android resource-id),
e.g. `login-email`, `nav-meals`, `meal-save`. Keep them stable when
changing screens.

## Scope / what's NOT here yet

Everything below is explicitly deferred to a later mobile milestone:

- meal edit/delete
- password reset, email verification, OAuth, MFA, refresh tokens,
  server-side token revocation
- Expo Web (`npm run web`) auth: SecureStore is native-only and the API's
  CORS only allows the Web app's origin - mobile auth targets Android/iOS
- notifications, offline mode, push notifications, biometric login, deep
  links
- app-store publishing, native Android/iOS code, CI/CD, iOS automation

Multi-image / Guided AI Meal Analysis remains a separate future backlog
item (Web or Mobile) and is untouched here.
