import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  ANDROID_SERIAL,
  APPIUM_HOST,
  APPIUM_PORT,
  EXPECTED_EXPO_GO_MAJOR,
  EXPO_GO_PACKAGE,
  HOST_API_URL,
  HOST_METRO_URL,
} from "./config";

/**
 * Preflight checks for the native Mobile suite, shared by
 * `npm run test:mobile:doctor` and the WebdriverIO onPrepare hook. Each
 * check reports a clear, actionable reason, so a missing emulator/server is
 * reported as an ENVIRONMENT problem before any test runs - never disguised
 * as a failing test.
 */
export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function adbPath(): string {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const candidate = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "adb";
}

function adb(args: string[]): string {
  return execFileSync(adbPath(), args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
}

/** Online adb devices, e.g. ["emulator-5554"]. */
function listDevices(): string[] {
  return adb(["devices"])
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === "device")
    .map(([serial]) => serial);
}

/** The adb serial the suite will drive: ANDROID_SERIAL if set, otherwise the only attached emulator. */
export function resolveDeviceSerial(): string {
  const devices = listDevices();
  if (ANDROID_SERIAL) {
    if (!devices.includes(ANDROID_SERIAL)) {
      throw new Error(`ANDROID_SERIAL=${ANDROID_SERIAL} is not an online adb device (online: ${devices.join(", ") || "none"}).`);
    }
    return ANDROID_SERIAL;
  }
  const emulators = devices.filter((serial) => serial.startsWith("emulator-"));
  if (emulators.length === 0) {
    throw new Error(
      `No running Android Emulator found by adb (online devices: ${devices.join(", ") || "none"}). ` +
        "Start one, e.g. `emulator -avd Nex5`.",
    );
  }
  if (emulators.length > 1) {
    throw new Error(`More than one emulator is running (${emulators.join(", ")}). Set ANDROID_SERIAL to pick one.`);
  }
  return emulators[0];
}

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  return { status: response.status, body: await response.text() };
}

async function check(name: string, run: () => Promise<string> | string): Promise<CheckResult> {
  try {
    return { name, ok: true, detail: await run() };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function runPreflightChecks(): Promise<CheckResult[]> {
  let serial: string | undefined;

  return [
    await check("adb + Android Emulator", () => {
      serial = resolveDeviceSerial();
      const sdk = adb(["-s", serial, "shell", "getprop", "ro.build.version.release"]).trim();
      return `${serial} (Android ${sdk})`;
    }),
    await check(`Expo Go (${EXPO_GO_PACKAGE}) on the emulator`, () => {
      if (!serial) {
        throw new Error("skipped - no emulator");
      }
      const dump = adb(["-s", serial, "shell", "dumpsys", "package", EXPO_GO_PACKAGE]);
      const version = /versionName=(\S+)/.exec(dump)?.[1];
      if (!version) {
        throw new Error("Expo Go is not installed. Run `npm run mobile:metro` and press `a` once, or install the SDK 57 Expo Go APK with adb.");
      }
      if (Number(version.split(".")[0]) !== EXPECTED_EXPO_GO_MAJOR) {
        throw new Error(`Expo Go ${version} installed, but this project needs Expo Go ${EXPECTED_EXPO_GO_MAJOR}.x (Expo SDK ${EXPECTED_EXPO_GO_MAJOR}).`);
      }
      return version;
    }),
    await check("Appium server", async () => {
      const { status, body } = await fetchText(`http://${APPIUM_HOST}:${APPIUM_PORT}/status`);
      const parsed = JSON.parse(body) as { value?: { ready?: boolean; build?: { version?: string } } };
      if (status !== 200 || !parsed.value?.ready) {
        throw new Error(`not ready (HTTP ${status})`);
      }
      return `ready, Appium ${parsed.value.build?.version} at ${APPIUM_HOST}:${APPIUM_PORT}`;
    }).then((result) => (result.ok ? result : { ...result, detail: `${result.detail} - start it with \`npm run mobile:appium\`` })),
    await check("UiAutomator2 driver", () => {
      // Installed as a project devDependency - Appium discovers it from this repo (no global ~/.appium needed).
      const manifest = path.join(process.cwd(), "node_modules", "appium-uiautomator2-driver", "package.json");
      if (!existsSync(manifest)) {
        throw new Error("not installed - run `npm install` at the repository root");
      }
      const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { version: string };
      return `appium-uiautomator2-driver ${pkg.version} (project-local)`;
    }),
    await check("API (host side)", async () => {
      const { status, body } = await fetchText(`${HOST_API_URL}/health`);
      if (status !== 200) {
        throw new Error(`HTTP ${status}`);
      }
      return `${HOST_API_URL}/health -> ${body}`;
    }).then((result) => (result.ok ? result : { ...result, detail: `${result.detail} - start it with \`npm run mobile:api\`` })),
    await check("Metro bundler (host side)", async () => {
      const { body } = await fetchText(`${HOST_METRO_URL}/status`);
      if (!body.includes("packager-status:running")) {
        throw new Error(`unexpected status "${body}"`);
      }
      return `${HOST_METRO_URL} running`;
    }).then((result) => (result.ok ? result : { ...result, detail: `${result.detail} - start it with \`npm run mobile:metro\`` })),
  ];
}

export function formatChecks(results: CheckResult[]): string {
  return results.map((result) => `  ${result.ok ? "OK  " : "FAIL"}  ${result.name}: ${result.detail}`).join("\n");
}
