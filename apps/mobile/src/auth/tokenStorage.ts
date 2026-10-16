import * as SecureStore from "expo-secure-store";

/**
 * The ONLY module that touches the mobile JWT at rest. Backed by Expo
 * SecureStore (Android Keystore-encrypted storage / iOS Keychain) - never
 * AsyncStorage, a plain file, or source code. Nothing else in the app calls
 * SecureStore directly, and nothing here ever logs the token value.
 */
const TOKEN_KEY = "heai_auth_token";

/** `null` when there is no stored token - or when secure storage itself could not be read, which callers treat the same as "not logged in" (without deleting anything). */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Throws if the token could not be persisted - callers must not treat the user as logged in when this fails. */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Best-effort: nothing further the app can do, and the in-memory auth
    // state is cleared by the caller regardless.
  }
}
