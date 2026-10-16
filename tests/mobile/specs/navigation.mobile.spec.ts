import { loginThroughUi, newUser } from "../helpers/session";
import { tabBar, type Tab } from "../screens/TabBar";

const TABS: Tab[] = ["meals", "history", "recommendations", "plan", "shopping", "profile", "dashboard"];

describe("Mobile protected navigation", () => {
  it("reaches every product section from the tab bar", async () => {
    const user = await newUser();
    await loginThroughUi(user);

    for (const tab of TABS) {
      await tabBar.open(tab);
    }
  });
});
