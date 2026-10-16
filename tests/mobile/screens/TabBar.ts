import { byTestId } from "../helpers/locators";

export type Tab = "dashboard" | "meals" | "history" | "recommendations" | "plan" | "shopping" | "profile";

/** The authenticated bottom tab bar (tabBarButtonTestID "nav-<tab>"); each tab's screen root is "<tab>-screen". */
class TabBar {
  async open(tab: Tab): Promise<void> {
    await byTestId(`nav-${tab}`).click();
    await this.expectOn(tab);
  }

  async expectOn(tab: Tab): Promise<void> {
    await byTestId(`${tab}-screen`).waitForDisplayed({ timeout: 30_000, timeoutMsg: `"${tab}" screen not shown` });
  }

  async isVisible(): Promise<boolean> {
    return byTestId("nav-dashboard").isDisplayed();
  }
}

export const tabBar = new TabBar();
