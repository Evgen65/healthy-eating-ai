import { StyleSheet, Text, View } from "react-native";
import { useSelectedWeek } from "../plan/SelectedWeekContext";
import { getCurrentWeekStart, shiftWeek } from "../utils/week";
import { PrimaryButton } from "./PrimaryButton";

/** Previous / Current / Next week controls for Plan and Shopping - both read and change the same shared startDate. */
export function WeekSelector() {
  const { startDate, setStartDate } = useSelectedWeek();
  const currentWeekStart = getCurrentWeekStart();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <PrimaryButton
            label="‹ Previous"
            onPress={() => setStartDate(shiftWeek(startDate, -1))}
            variant="secondary"
            testID="week-previous"
          />
        </View>
        <View style={styles.flex}>
          <PrimaryButton
            label="Next ›"
            onPress={() => setStartDate(shiftWeek(startDate, 1))}
            variant="secondary"
            testID="week-next"
          />
        </View>
      </View>
      <PrimaryButton
        label="Current week"
        onPress={() => setStartDate(currentWeekStart)}
        variant="secondary"
        disabled={startDate === currentWeekStart}
        testID="week-current"
      />
      <Text style={styles.range} testID="week-start">
        Week starting {startDate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  range: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
  },
});
