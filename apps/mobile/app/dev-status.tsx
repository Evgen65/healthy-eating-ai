import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { checkBackendHealth } from "../src/api/health";
import { API_BASE_URL } from "../src/config/env";
import { NavLinkButton } from "../src/components/NavLinkButton";
import { ScreenContainer } from "../src/components/ScreenContainer";

type CheckState = "checking" | "reachable" | "unreachable";

/**
 * Milestone 16 verification screen only - a minimal, unauthenticated
 * connectivity check against the existing GET /health (see
 * apps/api/src/routes/health.ts and src/api/health.ts). Deliberately not
 * wired into the product's tab navigation and clearly labelled as
 * temporary - this is a development diagnostic, not a permanent product
 * feature, and is expected to be removed or hidden behind a dev-only flag
 * once it has served its purpose.
 *
 * Shows only a controlled "reachable"/"unavailable" message plus the
 * configured API_BASE_URL (useful for confirming you set
 * EXPO_PUBLIC_API_BASE_URL correctly for your target - see README.md) -
 * never a raw exception, stack trace, or other internal diagnostic detail.
 */
export default function DevStatusScreen() {
  const [state, setState] = useState<CheckState>("checking");

  const runCheck = useCallback(() => {
    setState("checking");
    void checkBackendHealth().then((result) => {
      setState(result.kind === "reachable" ? "reachable" : "unreachable");
    });
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <ScreenContainer
      title="Development / System Status"
      subtitle="Temporary diagnostic screen for Milestone 16 verification only - not a permanent product feature."
    >
      <View style={styles.row}>
        <Text style={styles.label}>Configured API base URL</Text>
        <Text style={styles.value}>{API_BASE_URL}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Backend status</Text>
        {state === "checking" && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.value}>Checking...</Text>
          </View>
        )}
        {state === "reachable" && <Text style={[styles.value, styles.ok]}>Backend reachable</Text>}
        {state === "unreachable" && <Text style={[styles.value, styles.error]}>Backend is unavailable.</Text>}
      </View>

      <Pressable style={styles.retryButton} onPress={runCheck}>
        <Text style={styles.retryLabel}>Re-check</Text>
      </Pressable>

      <NavLinkButton href="/dashboard" label="Back" variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#777777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 17,
    color: "#1a1a1a",
    marginTop: 2,
  },
  ok: {
    color: "#1e7a3b",
    fontWeight: "700",
  },
  error: {
    color: "#b3261e",
    fontWeight: "700",
  },
  retryButton: {
    marginTop: 8,
    marginBottom: 12,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#eeeeee",
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
});
