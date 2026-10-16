import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SevereServiceError } from "webdriverio";
import { closeDbPool } from "./tests/helpers/db";
import { APPIUM_HOST, APPIUM_PORT } from "./tests/mobile/helpers/config";
import { formatChecks, resolveDeviceSerial, runPreflightChecks } from "./tests/mobile/helpers/environment";
import { deleteCreatedUsers } from "./tests/mobile/helpers/session";

/**
 * Native Android Mobile E2E (Milestone 20.5) - Appium + UiAutomator2 driven
 * through WebdriverIO, completely separate from the Playwright Web/API/E2E
 * suites. Drives our app inside Expo Go on a local Android Emulator.
 *
 * API, Metro and Appium are started separately (see tests/mobile/README.md);
 * onPrepare verifies all of them first and aborts with an environment
 * report instead of letting every test fail with a timeout.
 *
 * One worker, one emulator, sequential specs: reliability over speed.
 */
const ARTIFACTS_DIR = path.join(process.cwd(), "mobile-test-results");

function redact(text: string): string {
  return text.replace(/Mobile-Qa-[0-9a-fA-F-]{36}/g, "**PASSWORD**");
}

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: "./tests/mobile/tsconfig.json",
  hostname: APPIUM_HOST,
  port: APPIUM_PORT,
  path: "/",
  specs: ["./tests/mobile/specs/**/*.mobile.spec.ts"],
  maxInstances: 1,
  capabilities: [
    {
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      // Filled in by onPrepare from adb (ANDROID_SERIAL or the single running emulator).
      "appium:udid": undefined,
      // Expo Go is started per test via a deep link (tests/mobile/helpers/app.ts),
      // not by Appium; its data (incl. Expo Go itself) is never wiped.
      "appium:noReset": true,
      "appium:autoLaunch": false,
      "appium:disableWindowAnimation": true,
      "appium:newCommandTimeout": 300,
      "appium:uiautomator2ServerLaunchTimeout": 120_000,
      "appium:adbExecTimeout": 60_000,
    },
  ],
  // "warn" keeps WebdriverIO from logging command payloads (typed credentials).
  logLevel: "warn",
  bail: 0,
  waitforTimeout: 15_000,
  connectionRetryTimeout: 180_000,
  connectionRetryCount: 1,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 300_000,
  },

  onPrepare: async (_config, capabilities) => {
    const results = await runPreflightChecks();
    console.log(`\nMobile environment preflight:\n${formatChecks(results)}\n`);
    if (results.some((result) => !result.ok)) {
      throw new SevereServiceError("Mobile test environment is not ready - see the preflight report above (npm run test:mobile:doctor).");
    }
    const udid = resolveDeviceSerial();
    for (const capability of capabilities as WebdriverIO.Capabilities[]) {
      capability["appium:udid"] = udid;
    }
  },

  afterTest: async (test, _context, { passed }) => {
    if (!passed) {
      mkdirSync(ARTIFACTS_DIR, { recursive: true });
      const name = `${test.parent} - ${test.title}`.replace(/[^\w.-]+/g, "_").slice(0, 120);
      await browser.saveScreenshot(path.join(ARTIFACTS_DIR, `${name}.png`)).catch(() => undefined);
      const source = await browser.getPageSource().catch(() => null);
      if (source) {
        writeFileSync(path.join(ARTIFACTS_DIR, `${name}.xml`), redact(source));
      }
    }
    await deleteCreatedUsers();
  },

  after: async () => {
    await closeDbPool();
  },
};
