import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { failureMessage } from "../../src/api/messages";
import { calculateNutritionTarget, getTodayNutrition } from "../../src/api/nutritionApi";
import { useAuth } from "../../src/auth/AuthContext";
import { FormMessage } from "../../src/components/FormMessage";
import { NavLinkButton } from "../../src/components/NavLinkButton";
import { NutritionSummaryTable } from "../../src/components/NutritionSummaryTable";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { InfoText, LoadingRow } from "../../src/components/StatusMessage";
import { useFocusedData } from "../../src/hooks/useFocusedData";

/**
 * Today's target / consumed / remaining from GET /api/me/nutrition/today -
 * the same backend values the Web Dashboard shows. Refetched every time
 * the tab is opened (so a meal just added on Meals, or on Web, is
 * reflected) and on pull-to-refresh.
 *
 * Same prerequisite flow as Web: no target yet -> "Calculate Nutrition
 * Target" (POST /api/me/nutrition-target/calculate, computed server-side
 * from the stored profile); if there is no profile either, the backend
 * says so and the user is sent to Profile first.
 */
export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { data, refreshing, refresh, retry, reload } = useFocusedData(getTodayNutrition);
  const [calculating, setCalculating] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Synchronous double-tap guard - one tap, one calculate request.
  const calculateInFlight = useRef(false);

  // The user may have just saved their profile on the Profile tab - start
  // from "try calculating" again instead of a stale "profile missing".
  useFocusEffect(
    useCallback(() => {
      setProfileMissing(false);
      setActionError(null);
    }, []),
  );

  async function handleCalculate() {
    if (calculateInFlight.current) {
      return;
    }
    calculateInFlight.current = true;
    setCalculating(true);
    setActionError(null);
    const result = await calculateNutritionTarget();
    calculateInFlight.current = false;
    setCalculating(false);

    if (result.kind === "success") {
      setProfileMissing(false);
      // Target changed - remaining must be re-derived by the backend, not patched locally.
      reload();
    } else if (result.kind === "profile_not_found") {
      setProfileMissing(true);
    } else if (result.kind === "failed") {
      setActionError("Unable to calculate nutrition target. Please check your profile.");
    } else {
      setActionError(failureMessage(result.kind));
    }
  }

  function renderContent() {
    if (data === null) {
      return <LoadingRow label="Loading nutrition summary..." />;
    }

    if (data.kind === "network_error" || data.kind === "error") {
      return (
        <>
          <FormMessage type="error" text={failureMessage(data.kind)} />
          <PrimaryButton label="Retry" onPress={retry} />
        </>
      );
    }

    if (data.kind === "target_not_found") {
      if (profileMissing) {
        return (
          <>
            <InfoText text="Complete your profile first." />
            <NavLinkButton href="/profile" label="Go to Profile" />
          </>
        );
      }
      return (
        <>
          <InfoText text="Your nutrition target has not been calculated yet." />
          <PrimaryButton
            label={calculating ? "Calculating..." : "Calculate Nutrition Target"}
            onPress={() => void handleCalculate()}
            busy={calculating}
          />
          {actionError ? <FormMessage type="error" text={actionError} /> : null}
        </>
      );
    }

    return (
      <>
        <InfoText text={`Your nutrition overview for ${data.summary.date} (UTC day).`} />
        <NutritionSummaryTable summary={data.summary} testID="dashboard-summary" />
        <PrimaryButton
          label={calculating ? "Calculating..." : "Recalculate target"}
          onPress={() => void handleCalculate()}
          busy={calculating}
          variant="secondary"
        />
        {actionError ? <FormMessage type="error" text={actionError} /> : null}
      </>
    );
  }

  return (
    <ScreenContainer title="Dashboard" refreshing={refreshing} onRefresh={refresh} testID="dashboard-screen">
      {renderContent()}

      <View style={styles.account}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <PrimaryButton label="Log out" onPress={() => void logout()} variant="secondary" testID="logout-button" />
      <NavLinkButton href="/dev-status" label="Development / System Status" variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  account: {
    marginTop: 12,
    gap: 2,
  },
  label: {
    fontSize: 13,
    color: "#777777",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  email: {
    fontSize: 17,
    color: "#1a1a1a",
  },
});
