import { driver } from "@wdio/globals";
import { EXPO_APP_URL, EXPO_GO_PACKAGE } from "./config";
import { byTestId } from "./locators";
import { dashboardScreen } from "../screens/DashboardScreen";
import { loginScreen } from "../screens/LoginScreen";

const APP_READY_TIMEOUT = 120_000;

/**
 * Cold-starts our app inside Expo Go: Expo Go is force-stopped (so no tab,
 * form or selected-week state survives from a previous test), then the
 * project URL is opened as a deep link, exactly like scanning the QR code.
 * `path` opens a specific route, e.g. "dashboard" -> exp://.../--/dashboard.
 *
 * Resolves once the auth state has settled on either Login or Dashboard.
 */
export async function launchApp(path?: string): Promise<"login" | "dashboard"> {
  await driver.terminateApp(EXPO_GO_PACKAGE);
  const url = path ? `${EXPO_APP_URL}/--/${path}` : EXPO_APP_URL;
  await driver.execute("mobile: deepLink", { url, package: EXPO_GO_PACKAGE });

  let reached: "login" | "dashboard" | null = null;
  await driver.waitUntil(
    async () => {
      if (await byTestId("login-screen").isDisplayed()) {
        reached = "login";
      } else if (await byTestId("dashboard-screen").isDisplayed()) {
        reached = "dashboard";
      }
      return reached !== null;
    },
    {
      timeout: APP_READY_TIMEOUT,
      interval: 1_000,
      timeoutMsg: `App did not reach Login or Dashboard within ${APP_READY_TIMEOUT / 1000}s - is Metro running (npm run mobile:metro) and reachable from the emulator?`,
    },
  );
  return reached!;
}

/**
 * Isolation baseline for every test: a freshly started app with NO stored
 * session. A token left in SecureStore by an earlier test is removed via
 * the real Log out button, never by poking at storage.
 */
export async function launchLoggedOut(): Promise<void> {
  if ((await launchApp()) === "dashboard") {
    await dashboardScreen.logout();
  }
  await loginScreen.expectLoaded();
}
