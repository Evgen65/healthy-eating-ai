import { expect } from "@wdio/globals";
import { allByTestId, byTestId, expectText, scrollToTestId, tapTestId, textOf } from "../helpers/locators";

/**
 * Recommendations, Plan and Shopping only render backend data, so these
 * screen objects verify integration (data arrived, for the right week) -
 * the algorithms themselves are covered by the API suite.
 */
class RecommendationsScreen {
  async expectTarget(calories: string): Promise<void> {
    await expectText("recommendations-summary-target-calories", calories, 30_000);
  }

  async countVisibleRecommendations(): Promise<number> {
    await scrollToTestId("recommendation-item");
    return (await allByTestId("recommendation-item")).length;
  }
}

class WeekScreen {
  constructor(private readonly rangeTestId: string) {}

  /** The selected week's YYYY-MM-DD start, from the shared week selector. */
  async selectedWeekStart(): Promise<string> {
    return (await textOf("week-start")).replace("Week starting ", "");
  }

  /** Waits for the backend response for that week (the range line starts with "<start> — <end>"). */
  async expectWeekLoaded(startDate: string, endDate: string): Promise<void> {
    const expected = `${startDate} — ${endDate}`;
    const range = await scrollToTestId(this.rangeTestId, 30_000);
    await range.waitUntil(async () => (await range.getText()).startsWith(expected), {
      timeout: 30_000,
      timeoutMsg: `${this.rangeTestId} did not show ${expected}`,
    });
  }

  async previousWeek(): Promise<void> {
    await tapTestId("week-previous");
  }

  async nextWeek(): Promise<void> {
    await tapTestId("week-next");
  }

  async currentWeek(): Promise<void> {
    await tapTestId("week-current");
  }
}

class PlanScreen extends WeekScreen {
  constructor() {
    super("plan-range");
  }

  /** At least one day card with a planned meal (scrolls past the header to the first meal). */
  async expectMealsShown(): Promise<void> {
    await scrollToTestId("plan-meal");
    await expect(byTestId("plan-day")).toBeExisting();
  }
}

class ShoppingScreen extends WeekScreen {
  constructor() {
    super("shopping-range");
  }

  async expectItemsShown(): Promise<void> {
    await scrollToTestId("shopping-item");
  }
}

export const recommendationsScreen = new RecommendationsScreen();
export const planScreen = new PlanScreen();
export const shoppingScreen = new ShoppingScreen();
