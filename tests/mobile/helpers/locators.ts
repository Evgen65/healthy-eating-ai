import { $, $$, driver } from "@wdio/globals";

/**
 * Locator strategy: React Native exposes `testID` on Android as the view's
 * resource-id, verbatim (no "host.exp.exponent:id/" prefix, because the
 * views belong to our JS bundle running inside Expo Go). UiSelector
 * .resourceId() matches it exactly - no coordinates, XPath or visible text.
 */
function selector(testId: string): string {
  return `new UiSelector().resourceId("${testId}")`;
}

export function byTestId(testId: string) {
  return $(`android=${selector(testId)}`);
}

export function allByTestId(testId: string) {
  return $$(`android=${selector(testId)}`);
}

/**
 * Scrolls the current screen's ScrollView until the element is on screen
 * (UiScrollable first rewinds to the top, then scrolls forward), and
 * returns it. Screens are plain vertical ScrollViews, so this is enough to
 * reach anything below the fold.
 */
export async function scrollToTestId(testId: string, timeout = 20_000) {
  await $(`android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(${selector(testId)})`).waitForExist({
    timeout,
    timeoutMsg: `"${testId}" not found while scrolling`,
  });
  const element = byTestId(testId);
  await element.waitForDisplayed({ timeout });
  return element;
}

export async function tapTestId(testId: string): Promise<void> {
  const element = await scrollToTestId(testId);
  await element.click();
}

/** Types into a TextInput found by testID, replacing its current value. The soft keyboard is closed again so it never covers the next control. */
export async function typeInto(testId: string, value: string): Promise<void> {
  const element = await scrollToTestId(testId);
  await element.clearValue();
  await element.setValue(value);
  await hideKeyboard();
}

export async function hideKeyboard(): Promise<void> {
  if (await driver.isKeyboardShown()) {
    await driver.hideKeyboard();
  }
}

export async function textOf(testId: string): Promise<string> {
  const element = await scrollToTestId(testId);
  return element.getText();
}

/** Waits until the element's text equals `expected` - for values that arrive asynchronously from the backend. */
export async function expectText(testId: string, expected: string, timeout = 20_000): Promise<void> {
  const element = await scrollToTestId(testId, timeout);
  await element.waitUntil(async () => (await element.getText()) === expected, {
    timeout,
    timeoutMsg: `"${testId}" text was "${await element.getText().catch(() => "?")}", expected "${expected}"`,
  });
}
