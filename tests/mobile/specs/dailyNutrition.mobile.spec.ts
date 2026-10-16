import { expect } from "@wdio/globals";
import { MEAL_ITEM, PROFILE, utcToday } from "../fixtures/testData";
import { loginThroughUi, newUserWithTarget } from "../helpers/session";
import { createMeal } from "../helpers/testApi";
import { dashboardScreen } from "../screens/DashboardScreen";
import { historyScreen } from "../screens/HistoryScreen";
import { tabBar } from "../screens/TabBar";

// PROFILE's backend target (see fixtures/testData.ts) minus MEAL_ITEM.
const TARGET_CALORIES = 2378;

describe("Mobile daily nutrition (Dashboard + History)", () => {
  it("Dashboard shows today's consumed and remaining values from the backend", async () => {
    const user = await newUserWithTarget(PROFILE);
    await createMeal(user, "breakfast", new Date(), [MEAL_ITEM]);

    await loginThroughUi(user);

    await dashboardScreen.expectSummary("target", "calories", `${TARGET_CALORIES} kcal`);
    await dashboardScreen.expectSummary("consumed", "calories", `${MEAL_ITEM.calories} kcal`);
    await dashboardScreen.expectSummary("consumed", "proteinG", `${MEAL_ITEM.proteinG} g`);
    await dashboardScreen.expectSummary("consumed", "fatG", `${MEAL_ITEM.fatG} g`);
    await dashboardScreen.expectSummary("consumed", "carbsG", `${MEAL_ITEM.carbsG} g`);
    await dashboardScreen.expectSummary("remaining", "calories", `${TARGET_CALORIES - MEAL_ITEM.calories} kcal`);
  });

  it("History shows the day's meal and consumed values", async () => {
    const user = await newUserWithTarget(PROFILE);
    await createMeal(user, "dinner", new Date(), [MEAL_ITEM]);

    await loginThroughUi(user);
    await tabBar.open("history");
    // Explicit UTC date (the backend's day boundary), independent of the emulator's timezone.
    await historyScreen.selectDate(utcToday());

    await historyScreen.expectSummary("consumed", "calories", `${MEAL_ITEM.calories} kcal`);
    await historyScreen.expectSummary("consumed", "proteinG", `${MEAL_ITEM.proteinG} g`);
    await historyScreen.expectSummary("consumed", "fatG", `${MEAL_ITEM.fatG} g`);
    await historyScreen.expectSummary("consumed", "carbsG", `${MEAL_ITEM.carbsG} g`);
    expect(await historyScreen.countMealCards()).toBe(1);
    expect(await historyScreen.firstMealCalories()).toBe(`${MEAL_ITEM.calories} kcal`);
  });
});
