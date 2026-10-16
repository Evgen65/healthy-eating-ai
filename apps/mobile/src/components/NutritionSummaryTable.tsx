import type { NutritionSummary } from "@healthy-eating-ai/shared";
import { StyleSheet, Text, View } from "react-native";

interface NutritionSummaryTableProps {
  /** Backend-calculated values (GET /api/me/nutrition/today or /history/daily) - displayed as-is, never recomputed here. */
  summary: Pick<NutritionSummary, "target" | "consumed" | "remaining">;
  /** Each value cell gets `${testID}-${column}-${nutrient}` (e.g. "dashboard-summary-consumed-calories"). */
  testID?: string;
}

const ROWS: { key: "calories" | "proteinG" | "fatG" | "carbsG"; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
];

/** Target / Consumed / Remaining for each nutrient - shared by Dashboard and History (the mobile counterpart of Web's NutritionSummaryCard). */
export function NutritionSummaryTable({ summary, testID }: NutritionSummaryTableProps) {
  return (
    <View style={styles.table} testID={testID}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.labelCell, styles.headerText]} />
        <Text style={[styles.cell, styles.headerText]}>Target</Text>
        <Text style={[styles.cell, styles.headerText]}>Consumed</Text>
        <Text style={[styles.cell, styles.headerText]}>Remaining</Text>
      </View>
      {ROWS.map((row) => {
        const cellId = (column: string) => (testID ? `${testID}-${column}-${row.key}` : undefined);
        return (
          <View key={row.key} style={styles.row}>
            <Text style={[styles.cell, styles.labelCell]}>{row.label}</Text>
            <Text style={styles.cell} testID={cellId("target")}>{`${summary.target[row.key]} ${row.unit}`}</Text>
            <Text style={styles.cell} testID={cellId("consumed")}>{`${summary.consumed[row.key]} ${row.unit}`}</Text>
            <Text style={[styles.cell, summary.remaining[row.key] < 0 && styles.negative]} testID={cellId("remaining")}>
              {`${summary.remaining[row.key]} ${row.unit}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  headerRow: {
    borderTopWidth: 0,
    backgroundColor: "#f5f7f6",
  },
  cell: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
    textAlign: "right",
  },
  labelCell: {
    textAlign: "left",
    fontWeight: "600",
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555555",
  },
  negative: {
    color: "#b3261e",
  },
});
