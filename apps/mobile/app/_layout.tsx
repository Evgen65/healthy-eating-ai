import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";

/**
 * Root layout. Route structure:
 *
 *   app/
 *     index.tsx        entry point - loading/unavailable state while the
 *                      session is restored, then redirects to Dashboard or Login
 *     login.tsx         only while unauthenticated
 *     register.tsx       only while unauthenticated
 *     dev-status.tsx      only while authenticated (backend connectivity check)
 *     (tabs)/             only while authenticated - the 7 product sections
 *
 * Protection uses Expo Router's <Stack.Protected> (available in the
 * installed expo-router 57 / SDK 57). A screen whose guard is false is
 * removed from the navigator entirely, so it cannot be reached by any link
 * or deep link; when a guard flips (login, logout, a 401 anywhere), the
 * stack falls back to `index`, which redirects to the right place. While
 * the session is still "restoring" (or the server is "unavailable") BOTH
 * groups are closed, so neither Login nor protected content can flash
 * before the auth state is actually known.
 *
 * These guards are UX only - the backend's requireAuth is still the
 * authority on every request.
 */
function RootNavigator() {
  const { status } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={status === "authenticated"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dev-status" />
      </Stack.Protected>

      <Stack.Protected guard={status === "unauthenticated"}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
