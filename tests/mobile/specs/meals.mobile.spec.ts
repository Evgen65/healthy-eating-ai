import { expect } from "@wdio/globals";
import { MEAL_ITEM, PROFILE } from "../fixtures/testData";
import { loginThroughUi, newUserWithTarget } from "../helpers/session";
import { countMeals } from "../helpers/testApi";
import { mealsScreen } from "../screens/MealsScreen";
import { tabBar } from "../screens/TabBar";

describe("Mobile manual meal creation", () => {
  it("creates exactly one meal with backend-calculated totals", async () => {
    const user = await newUserWithTarget(PROFILE);
    await loginThroughUi(user);

    await tabBar.open("meals");
    await mealsScreen.expectEmptyList();

    await mealsScreen.addMeal("lunch", MEAL_ITEM);
    await mealsScreen.expectSavedMessage();

    expect(await mealsScreen.countMealCards()).toBe(1);
    expect(await mealsScreen.firstMealCalories()).toBe(`${MEAL_ITEM.calories} kcal`);
    // The backend holds exactly one meal too - one tap, one POST.
    expect(await countMeals(user)).toBe(1);

    const items = await mealsScreen.expandFirstMealItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toContain(MEAL_ITEM.name);
  });
});
