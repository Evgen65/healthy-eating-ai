# Mobile automation (Appium, Android Emulator)

Native Android E2E for the Expo app in `apps/mobile`, driven by **Appium 3 +
UiAutomator2** through the **WebdriverIO** test runner (Mocha). It is a
separate layer from the Playwright suites (`tests/web`, `tests/api`,
`tests/e2e`) and has its own config (`wdio.mobile.conf.ts`) and tsconfig.

The app runs inside **Expo Go** (SDK 57), loaded from the local Metro bundler.
No native `android/` project or development build is needed.

## Layout

```
tests/mobile/
  specs/        8 smoke tests (*.mobile.spec.ts)
  screens/      Screen Objects: Login, TabBar, Dashboard, Meals, History, Profile, Planning (Recommendations/Plan/Shopping)
  helpers/      config, environment preflight, app launch, locators, test API, per-test user lifecycle
  fixtures/     deterministic profile/meal data
  doctor.ts     environment check (npm run test:mobile:doctor)
  appium-log-filters.json   masks generated passwords / JWTs in Appium's log
```

## Prerequisites (one-time)

- Node 22.19+ (24 used), `npm install` at the repository root. This installs
  Appium **and** the UiAutomator2 driver as project devDependencies, so Appium
  finds the driver in this repo (no global `appium driver install`).
- Android SDK with `platform-tools` and `emulator`; `ANDROID_HOME` set
  (e.g. `C:\Users\<you>\AppData\Local\Android\Sdk`).
- An Android Virtual Device. The suite was verified on AVD `Nex5`
  (Nexus 5, 1080x1920, Android 8.0 / API 26, x86, Google Play image).
- **Expo Go 57.x** installed on the emulator. Either start Metro and press `a`
  once (Expo CLI installs the matching Expo Go), or install the APK listed for
  SDK 57 by `https://api.expo.dev/v2/versions/latest` with `adb install`.
- PostgreSQL running with the root `.env` (`DATABASE_URL`), as for the other suites.

`JAVA_HOME` was not required for this setup.

## Running

Start these in separate terminals from the repository root:

| Terminal | Command | What it does |
|---|---|---|
| 0 | `emulator -avd Nex5` | Android Emulator (skip if already running) |
| 1 | `npm run mobile:api` | API on :4000 with `AI_PROVIDER=mock` (never real OpenAI) |
| 2 | `npm run mobile:metro` | Metro on :8081 with `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000` |
| 3 | `npm run mobile:appium` | Appium on 127.0.0.1:4723 with log masking |

Then, in a fourth terminal:

```
npm run test:mobile:doctor   # optional: checks adb/emulator, Expo Go, Appium, driver, API, Metro
npm run test:mobile          # runs the suite (same preflight runs first)
```

Run a single spec:

```
npx wdio run wdio.mobile.conf.ts --spec tests/mobile/specs/meals.mobile.spec.ts
```

If more than one emulator/device is attached, set `ANDROID_SERIAL=emulator-5554`.

### Why `10.0.2.2`

Inside the emulator, `localhost` is the emulator itself. `10.0.2.2` is the
host machine, so the app (via Metro's `EXPO_PUBLIC_API_BASE_URL`) and Expo Go
(`exp://10.0.2.2:8081`) use it. `npm run mobile:metro` sets the variable on the
process, which takes precedence over `apps/mobile/.env`, so the LAN address
for physical-device development in that file is left untouched. Use the normal
`npm run mobile:start` for a physical phone.

## How the tests stay independent

- Every test registers its own user(s) through the real API
  (`/api/auth/mobile/register`, `/api/me/profile`, ...), with a unique email and
  a generated password. No shared/manual accounts, no SQL-seeded passwords.
- Each test cold-starts Expo Go (force-stop + deep link) and logs out any
  session left by an earlier test via the real Log out button.
- Created users are deleted after each test (cascade removes profile, target
  and meals). Tests pass in any order.
- One worker, one emulator, sequential.

## Locators

React Native's `testID` becomes the Android `resource-id`, matched with
`UiSelector().resourceId(...)` (see `helpers/locators.ts`). No coordinates,
XPath or visible-text selectors. Tab buttons use `tabBarButtonTestID`
(`nav-dashboard`, `nav-meals`, ...), screen roots are `<tab>-screen`.

## Failure artifacts

On failure a screenshot and the UI hierarchy (generated passwords redacted)
are written to `mobile-test-results/` (git-ignored).

## Secrets

WebdriverIO runs at `logLevel: "warn"` (no command payloads). Appium logs
request bodies, so `appium-log-filters.json` masks the generated test
passwords and anything shaped like a JWT. Tokens live only in memory in the
test process and are never printed.

## Intentionally manual (not automated here)

- Real camera capture and the Android camera app
- Gallery / system photo picker and OS file picker
- Runtime permission dialogs (grant / deny)
- Real OpenAI analysis and photo quality
- Physical-device-specific behavior, network toggling, background/resume

AI analysis contracts (mock provider, no-food, reliability mapping,
persistence) are covered by the existing API and Web E2E suites.
