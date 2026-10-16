import { expect } from "@wdio/globals";
import { PROFILE } from "../fixtures/testData";
import { loginThroughUi, newUserWithTarget } from "../helpers/session";
import { planScreen, recommendationsScreen, shoppingScreen } from "../screens/PlanningScreens";
import { tabBar } from "../screens/TabBar";

/** Pure YYYY-MM-DD calendar arithmetic (UTC), same as the app's addDays - no timezone involved. */
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

describe("Mobile Recommendations / Plan / Shopping", () => {
  it("loads backend data and keeps Plan and Shopping on the same week", async () => {
    const user = await newUserWithTarget(PROFILE);
    await loginThroughUi(user);

    await tabBar.open("recommendations");
    await recommendationsScreen.expectTarget("2378 kcal");
    expect(await recommendationsScreen.countVisibleRecommendations()).toBeGreaterThan(0);

    await tabBar.open("plan");
    const currentWeek = await planScreen.selectedWeekStart();
    expect(new Date(`${currentWeek}T00:00:00.000Z`).getUTCDay()).toBe(1); // a Monday
    await planScreen.expectWeekLoaded(currentWeek, addDays(currentWeek, 6));
    await planScreen.expectMealsShown();

    await planScreen.previousWeek();
    const previousWeek = addDays(currentWeek, -7);
    await planScreen.expectWeekLoaded(previousWeek, addDays(previousWeek, 6));

    // Shopping opens on the week selected in Plan.
    await tabBar.open("shopping");
    expect(await shoppingScreen.selectedWeekStart()).toBe(previousWeek);
    await shoppingScreen.expectWeekLoaded(previousWeek, addDays(previousWeek, 6));
    await shoppingScreen.expectItemsShown();

    await shoppingScreen.nextWeek();
    await shoppingScreen.expectWeekLoaded(currentWeek, addDays(currentWeek, 6));
    await shoppingScreen.nextWeek();
    await shoppingScreen.currentWeek();
    await shoppingScreen.expectWeekLoaded(currentWeek, addDays(currentWeek, 6));
  });
});
