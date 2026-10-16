import { allByTestId, expectText, scrollToTestId, tapTestId, typeInto } from "../helpers/locators";
import type { Nutrient, SummaryColumn } from "./DashboardScreen";

class HistoryScreen {
  async selectDate(date: string): Promise<void> {
    await typeInto("history-date", date);
    await tapTestId("history-go");
    await expectText("history-selected-date", `Showing ${date}`);
  }

  async expectSummary(column: SummaryColumn, nutrient: Nutrient, expected: string): Promise<void> {
    await expectText(`history-summary-${column}-${nutrient}`, expected);
  }

  async countMealCards(): Promise<number> {
    await scrollToTestId("meal-card", 30_000);
    return (await allByTestId("meal-card")).length;
  }

  async firstMealCalories(): Promise<string> {
    return (await scrollToTestId("meal-card-calories")).getText();
  }
}

export const historyScreen = new HistoryScreen();
