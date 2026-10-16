import type { MealType } from "../../../packages/shared/src/index";
import type { MealItemSeed } from "../helpers/testApi";
import { allByTestId, byTestId, scrollToTestId, tapTestId, typeInto } from "../helpers/locators";

class MealsScreen {
  async expectEmptyList(): Promise<void> {
    await scrollToTestId("meals-empty", 30_000);
  }

  /** Manual Add Meal with a single item; date/time keep the form's default (device "now"). */
  async addMeal(mealType: MealType, item: MealItemSeed): Promise<void> {
    await tapTestId("meals-add");
    await tapTestId(`meal-type-${mealType}`);
    await typeInto("meal-item-0-name", item.name);
    if (item.quantityG !== undefined) {
      await typeInto("meal-item-0-quantityG", String(item.quantityG));
    }
    await typeInto("meal-item-0-calories", String(item.calories));
    await typeInto("meal-item-0-proteinG", String(item.proteinG));
    await typeInto("meal-item-0-fatG", String(item.fatG));
    await typeInto("meal-item-0-carbsG", String(item.carbsG));
    await tapTestId("meal-save");
  }

  async expectSavedMessage(): Promise<void> {
    const message = await scrollToTestId("meals-message", 20_000);
    await message.waitUntil(async () => (await message.getText()) === "Meal saved successfully.", {
      timeout: 20_000,
      timeoutMsg: "Meal save confirmation not shown",
    });
  }

  /** Scrolls down to the meal list and returns the number of meal cards rendered there. */
  async countMealCards(): Promise<number> {
    await scrollToTestId("meal-card", 30_000);
    return (await allByTestId("meal-card")).length;
  }

  async firstMealCalories(): Promise<string> {
    return (await scrollToTestId("meal-card-calories")).getText();
  }

  /** Expands the first card (items are fetched on demand) and returns its item lines. */
  async expandFirstMealItems(): Promise<string[]> {
    await tapTestId("meal-card");
    await byTestId("meal-card-item").waitForDisplayed({ timeout: 20_000, timeoutMsg: "Meal items not loaded" });
    const items = await allByTestId("meal-card-item");
    const texts: string[] = [];
    for (const item of items) {
      texts.push(await item.getText());
    }
    return texts;
  }
}

export const mealsScreen = new MealsScreen();
