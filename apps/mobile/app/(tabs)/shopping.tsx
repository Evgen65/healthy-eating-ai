import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { failureMessage } from "../../src/api/messages";
import { getWeeklyShoppingList } from "../../src/api/shoppingListApi";
import { FormMessage } from "../../src/components/FormMessage";
import { NavLinkButton } from "../../src/components/NavLinkButton";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { InfoText, LoadingRow } from "../../src/components/StatusMessage";
import { TargetMissingNotice } from "../../src/components/TargetMissingNotice";
import { WeekSelector } from "../../src/components/WeekSelector";
import { useFocusedData } from "../../src/hooks/useFocusedData";
import { useSelectedWeek } from "../../src/plan/SelectedWeekContext";

/**
 * The weekly shopping list from GET /api/me/shopping-list/weekly?startDate=...
 * - aggregated (exact name + unit) and ordered by the backend from the same
 * week's plan; rendered here in the order received, never re-aggregated.
 * Shares the selected week with the Plan tab (SelectedWeekContext).
 */
export default function ShoppingScreen() {
  const { startDate } = useSelectedWeek();
  // A new `load` per week clears the previous week's items immediately (see useFocusedData).
  const load = useCallback(() => getWeeklyShoppingList(startDate), [startDate]);
  const { data, refreshing, refresh, retry } = useFocusedData(load);

  function renderContent() {
    if (data === null) {
      return <LoadingRow label="Loading shopping list..." />;
    }
    if (data.kind === "target_not_found") {
      return <TargetMissingNotice />;
    }
    if (data.kind === "invalid_date") {
      return <FormMessage type="error" text="The selected week start date is invalid." />;
    }
    if (data.kind !== "found") {
      return (
        <>
          <FormMessage type="error" text={failureMessage(data.kind)} />
          <PrimaryButton label="Retry" onPress={retry} />
        </>
      );
    }

    const { shoppingList } = data;
    return (
      <>
        <Text style={styles.range} testID="shopping-range">
          {shoppingList.startDate} — {shoppingList.endDate} · {shoppingList.totalItems} items
        </Text>
        <InfoText text={shoppingList.notice} />
        <NavLinkButton href="/plan" label="View weekly plan" variant="secondary" />
        {shoppingList.items.length === 0 ? (
          <InfoText text="No shopping items are available for this week." testID="shopping-empty" />
        ) : (
          <View style={styles.list}>
            {shoppingList.items.map((item) => (
              <View key={`${item.name}__${item.unit}`} style={styles.item} testID="shopping-item">
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.quantity}>
                  {item.quantity} {item.unit}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.muted}>
          Shopping list version: {shoppingList.shoppingListVersion} · Source plan version:{" "}
          {shoppingList.sourcePlanVersion}
        </Text>
      </>
    );
  }

  return (
    <ScreenContainer title="Shopping" refreshing={refreshing} onRefresh={refresh} testID="shopping-screen">
      <WeekSelector />
      {renderContent()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  range: {
    fontSize: 15,
    color: "#555555",
  },
  list: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
  },
  quantity: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  muted: {
    fontSize: 13,
    color: "#777777",
  },
});
