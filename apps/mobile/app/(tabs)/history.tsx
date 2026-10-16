import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getDailyHistory } from "../../src/api/historyApi";
import { failureMessage } from "../../src/api/messages";
import { FormMessage } from "../../src/components/FormMessage";
import { MealCard } from "../../src/components/MealCard";
import { NavLinkButton } from "../../src/components/NavLinkButton";
import { NutritionSummaryTable } from "../../src/components/NutritionSummaryTable";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { InfoText, LoadingRow } from "../../src/components/StatusMessage";
import { TextField } from "../../src/components/TextField";
import { useFocusedData } from "../../src/hooks/useFocusedData";
import { addDays, formatLocalDate, isValidDateString } from "../../src/utils/date";

/**
 * One day's target / consumed / remaining and meals from
 * GET /api/me/history/daily?date=YYYY-MM-DD - all values come from the
 * backend. Date handling matches the Web History page (see src/utils/
 * date.ts): the default is the device's local date, the selected
 * YYYY-MM-DD is sent verbatim, and the backend aggregates that UTC day.
 * No picker dependency: previous/next/today buttons plus a typed date.
 */
export default function HistoryScreen() {
  const [date, setDate] = useState(() => formatLocalDate(new Date()));
  const [dateInput, setDateInput] = useState(date);
  const [dateError, setDateError] = useState<string | null>(null);

  // A new `load` per date makes useFocusedData clear the previous day's data
  // immediately, so a slow response never shows another date's values.
  const load = useCallback(() => getDailyHistory(date), [date]);
  const { data, refreshing, refresh, retry } = useFocusedData(load);

  function selectDate(next: string) {
    setDate(next);
    setDateInput(next);
    setDateError(null);
  }

  function applyTypedDate() {
    const value = dateInput.trim();
    if (!isValidDateString(value)) {
      setDateError("Enter a real date as YYYY-MM-DD.");
      return;
    }
    selectDate(value);
  }

  function renderContent() {
    if (data === null) {
      return <LoadingRow label="Loading history..." />;
    }
    if (data.kind === "target_not_found") {
      return (
        <>
          <InfoText text="Nutrition target is not available. Calculate your nutrition target first." />
          <NavLinkButton href="/dashboard" label="Go to Dashboard" />
        </>
      );
    }
    if (data.kind === "invalid_date") {
      return <FormMessage type="error" text="The selected date is invalid." />;
    }
    if (data.kind !== "found") {
      return (
        <>
          <FormMessage type="error" text={failureMessage(data.kind)} />
          <PrimaryButton label="Retry" onPress={retry} />
        </>
      );
    }

    const { history } = data;
    return (
      <>
        <Text style={styles.sectionTitle}>Daily summary</Text>
        <NutritionSummaryTable summary={history} testID="history-summary" />
        <Text style={styles.sectionTitle}>Meals</Text>
        {history.meals.length === 0 ? (
          <InfoText text="No meals recorded for this date." />
        ) : (
          history.meals.map((meal) => <MealCard key={meal.id} meal={meal} />)
        )}
      </>
    );
  }

  return (
    <ScreenContainer title="History" refreshing={refreshing} onRefresh={refresh} testID="history-screen">
      <View style={styles.row}>
        <View style={styles.flex}>
          <PrimaryButton label="‹ Previous" onPress={() => selectDate(addDays(date, -1))} variant="secondary" />
        </View>
        <View style={styles.flex}>
          <PrimaryButton label="Next ›" onPress={() => selectDate(addDays(date, 1))} variant="secondary" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Date (YYYY-MM-DD)"
            value={dateInput}
            onChangeText={setDateInput}
            onSubmitEditing={applyTypedDate}
            error={dateError ?? undefined}
            autoCorrect={false}
            returnKeyType="go"
            testID="history-date"
          />
        </View>
        <View style={styles.goButton}>
          <PrimaryButton label="Go" onPress={applyTypedDate} testID="history-go" />
        </View>
      </View>
      <PrimaryButton label="Today" onPress={() => selectDate(formatLocalDate(new Date()))} variant="secondary" />

      <Text style={styles.selectedDate} testID="history-selected-date">
        Showing {date}
      </Text>
      {renderContent()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  goButton: {
    width: 72,
  },
  selectedDate: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
});
