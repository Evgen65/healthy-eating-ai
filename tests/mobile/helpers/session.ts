import { deleteTestUser } from "../../helpers/db";
import { launchLoggedOut } from "./app";
import { registerMobileUser, registerUserWithTarget, type MobileTestUser, type ProfileInput } from "./testApi";
import { dashboardScreen } from "../screens/DashboardScreen";
import { loginScreen } from "../screens/LoginScreen";

/**
 * Per-test user lifecycle. Every test creates its own disposable user(s);
 * they are deleted after the test (afterEach in wdio.mobile.conf.ts) via
 * the same tests/helpers/db.ts cleanup the API suite uses, so reruns never
 * accumulate accounts and no test depends on another one's data.
 */
const createdUsers: MobileTestUser[] = [];

export async function newUser(): Promise<MobileTestUser> {
  const user = await registerMobileUser();
  createdUsers.push(user);
  return user;
}

export async function newUserWithTarget(profile: ProfileInput): Promise<MobileTestUser> {
  const user = await registerUserWithTarget(profile);
  createdUsers.push(user);
  return user;
}

export async function deleteCreatedUsers(): Promise<void> {
  while (createdUsers.length > 0) {
    const user = createdUsers.pop()!;
    await deleteTestUser(user.id).catch(() => undefined);
  }
}

/** Fresh app, no previous session, then a real UI login - ends on Dashboard. */
export async function loginThroughUi(user: MobileTestUser): Promise<void> {
  await launchLoggedOut();
  await loginScreen.login(user.email, user.password);
  await dashboardScreen.expectLoaded();
}
