/**
 * Every address the native Mobile suite uses, in one place. Two different
 * "points of view" exist and must not be mixed up:
 *
 * - Host side (this Node test process, Appium, preflight checks) reaches the
 *   API, Metro and Appium on 127.0.0.1.
 * - Inside the Android Emulator, 127.0.0.1 is the emulator itself; the host
 *   machine is the special address 10.0.2.2. Expo Go therefore opens
 *   exp://10.0.2.2:8081, and Metro must have been started with
 *   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000 (`npm run mobile:metro`).
 *
 * All values can be overridden through environment variables, but the
 * defaults match the standard local setup documented in tests/mobile/README.md.
 */
export const HOST_API_URL = process.env.MOBILE_TEST_API_URL ?? "http://127.0.0.1:4000";
export const HOST_METRO_URL = process.env.MOBILE_TEST_METRO_URL ?? "http://127.0.0.1:8081";
export const APPIUM_HOST = process.env.APPIUM_HOST ?? "127.0.0.1";
export const APPIUM_PORT = Number(process.env.APPIUM_PORT ?? 4723);

/** The Expo Go URL as seen from inside the emulator. */
export const EXPO_APP_URL = process.env.MOBILE_TEST_EXPO_URL ?? "exp://10.0.2.2:8081";

/** Expo Go's Android package - the app that hosts our JS bundle (no native prebuild needed). */
export const EXPO_GO_PACKAGE = "host.exp.exponent";
/** The Expo Go major version must match the project's Expo SDK. */
export const EXPECTED_EXPO_GO_MAJOR = 57;

/** Optional: pin a specific adb serial (e.g. "emulator-5554") when more than one device is attached. */
export const ANDROID_SERIAL = process.env.ANDROID_SERIAL;
