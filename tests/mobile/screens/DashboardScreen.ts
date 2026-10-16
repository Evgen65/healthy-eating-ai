import { byTestId, expectText, tapTestId } from "../helpers/locators";

export type Nutrient = "calories" | "proteinG" | "fatG" | "carbsG";
export type SummaryColumn = "target" | "consumed" | "remaining";

class DashboardScreen {
  async expectLoaded(): Promise<void> {
    await byTestId("dashboard-screen").waitForDisplayed({ timeout: 30_000, timeoutMsg: "Dashboard not shown" });
  }

  /** e.g. expectSummary("consumed", "calories", "410 kcal") - waits for the backend value to arrive. */
  async expectSummary(column: SummaryColumn, nutrient: Nutrient, expected: string): Promise<void> {
    await expectText(`dashboard-summary-${column}-${nutrient}`, expected);
  }

  async logout(): Promise<void> {
    await this.expectLoaded();
    await tapTestId("logout-button");
  }
}

export const dashboardScreen = new DashboardScreen();
