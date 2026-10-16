import { byTestId, hideKeyboard, typeInto } from "../helpers/locators";

class LoginScreen {
  async expectLoaded(): Promise<void> {
    await byTestId("login-screen").waitForDisplayed({ timeout: 30_000, timeoutMsg: "Login screen not shown" });
  }

  async login(email: string, password: string): Promise<void> {
    await this.expectLoaded();
    await typeInto("login-email", email);
    await typeInto("login-password", password);
    await hideKeyboard();
    await byTestId("login-submit").click();
  }
}

export const loginScreen = new LoginScreen();
