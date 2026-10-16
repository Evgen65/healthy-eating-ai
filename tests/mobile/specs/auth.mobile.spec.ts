import { expect } from "@wdio/globals";
import { launchApp } from "../helpers/app";
import { byTestId } from "../helpers/locators";
import { loginThroughUi, newUser } from "../helpers/session";
import { dashboardScreen } from "../screens/DashboardScreen";
import { loginScreen } from "../screens/LoginScreen";
import { tabBar } from "../screens/TabBar";

describe("Mobile authentication", () => {
  it("logs an existing user in and reaches the Dashboard", async () => {
    const user = await newUser();

    await loginThroughUi(user);

    await tabBar.expectOn("dashboard");
    await expect(byTestId("login-screen")).not.toBeDisplayed();
  });

  it("logs out to the Login screen and keeps protected screens unreachable", async () => {
    const user = await newUser();
    await loginThroughUi(user);

    await dashboardScreen.logout();
    await loginScreen.expectLoaded();
    await expect(byTestId("nav-dashboard")).not.toBeDisplayed();

    // A deep link straight to a protected route, after a cold start, must still land on Login.
    expect(await launchApp("dashboard")).toBe("login");
    await expect(byTestId("dashboard-screen")).not.toBeDisplayed();
    expect(await tabBar.isVisible()).toBe(false);
  });
});
