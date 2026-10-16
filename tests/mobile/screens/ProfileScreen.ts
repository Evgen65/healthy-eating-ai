import { byTestId, scrollToTestId, tapTestId, typeInto } from "../helpers/locators";

export interface ProfileFormValues {
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  jobType: string;
  workoutsPerWeek: string;
  goal: string;
}

const TEXT_FIELDS = {
  age: "profile-age",
  heightCm: "profile-height",
  weightKg: "profile-weight",
  workoutsPerWeek: "profile-workouts",
} as const;

const CHOICE_FIELDS = {
  sex: "profile-sex",
  activityLevel: "profile-activity",
  jobType: "profile-job",
  goal: "profile-goal",
} as const;

class ProfileScreen {
  /** Waits until the profile request finished and the form (not the loading row) is shown. */
  async expectFormLoaded(): Promise<void> {
    await byTestId("profile-age").waitForDisplayed({ timeout: 30_000, timeoutMsg: "Profile form not shown" });
  }

  async fill(values: ProfileFormValues): Promise<void> {
    await this.expectFormLoaded();
    for (const [field, testId] of Object.entries(TEXT_FIELDS)) {
      await typeInto(testId, values[field as keyof typeof TEXT_FIELDS]);
    }
    for (const [field, testId] of Object.entries(CHOICE_FIELDS)) {
      await tapTestId(`${testId}-${values[field as keyof typeof CHOICE_FIELDS]}`);
    }
  }

  async save(): Promise<void> {
    await tapTestId("profile-save");
  }

  async expectSaved(): Promise<void> {
    const message = await scrollToTestId("profile-message");
    await message.waitUntil(async () => (await message.getText()) === "Profile saved successfully.", {
      timeout: 20_000,
      timeoutMsg: "Profile save confirmation not shown",
    });
  }

  async readTextField(field: keyof typeof TEXT_FIELDS): Promise<string> {
    return (await scrollToTestId(TEXT_FIELDS[field])).getText();
  }

  async isChoiceSelected(field: keyof typeof CHOICE_FIELDS, value: string): Promise<boolean> {
    const option = await scrollToTestId(`${CHOICE_FIELDS[field]}-${value}`);
    return (await option.getAttribute("selected")) === "true";
  }
}

export const profileScreen = new ProfileScreen();
