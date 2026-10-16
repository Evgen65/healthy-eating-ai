import { expect } from "@wdio/globals";
import { UI_PROFILE } from "../fixtures/testData";
import { loginThroughUi, newUser } from "../helpers/session";
import { profileScreen } from "../screens/ProfileScreen";
import { tabBar } from "../screens/TabBar";

describe("Mobile profile", () => {
  it("saves a new profile and shows the persisted values after leaving and returning", async () => {
    const user = await newUser();
    await loginThroughUi(user);

    await tabBar.open("profile");
    await profileScreen.fill(UI_PROFILE);
    await profileScreen.save();
    await profileScreen.expectSaved();

    // Profile is refetched from the backend on every focus.
    await tabBar.open("dashboard");
    await tabBar.open("profile");
    await profileScreen.expectFormLoaded();

    expect(await profileScreen.readTextField("age")).toBe(UI_PROFILE.age);
    expect(await profileScreen.readTextField("heightCm")).toBe(UI_PROFILE.heightCm);
    expect(await profileScreen.readTextField("weightKg")).toBe(UI_PROFILE.weightKg);
    expect(await profileScreen.readTextField("workoutsPerWeek")).toBe(UI_PROFILE.workoutsPerWeek);
    expect(await profileScreen.isChoiceSelected("sex", UI_PROFILE.sex)).toBe(true);
    expect(await profileScreen.isChoiceSelected("activityLevel", UI_PROFILE.activityLevel)).toBe(true);
    expect(await profileScreen.isChoiceSelected("jobType", UI_PROFILE.jobType)).toBe(true);
    expect(await profileScreen.isChoiceSelected("goal", UI_PROFILE.goal)).toBe(true);
  });
});
