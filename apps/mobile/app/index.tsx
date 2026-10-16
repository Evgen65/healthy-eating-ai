import { APP_NAME } from "@healthy-eating-ai/shared";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NETWORK_ERROR_MESSAGE } from "../src/api/messages";
import { useAuth } from "../src/auth/AuthContext";
import { FormMessage } from "../src/components/FormMessage";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";

/**
 * App entry point and the fallback every guard change lands on (see
 * app/_layout.tsx). Never shows Login or protected content itself - it only
 * waits for the auth state to settle, then redirects.
 */
export default function EntryScreen() {
  const { status, restoreSession } = useAuth();

  if (status === "authenticated") {
    return <Redirect href="/dashboard" />;
  }
  if (status === "unauthenticated") {
    return <Redirect href="/login" />;
  }

  if (status === "unavailable") {
    // A token is stored but could not be verified because the server is
    // unreachable - it is kept (it may still be valid), and the user can
    // retry once the connection is back.
    return (
      <ScreenContainer title={APP_NAME}>
        <FormMessage type="error" text={NETWORK_ERROR_MESSAGE} />
        <PrimaryButton label="Retry" onPress={() => void restoreSession()} />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
});
