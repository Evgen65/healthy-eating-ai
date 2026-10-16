import type { Meal, MealItem } from "@healthy-eating-ai/shared";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { getMeal } from "../api/mealApi";
import { failureMessage } from "../api/messages";
import { mealTypeLabel } from "../meals/mealForm";
import { formatLocalDateTime } from "../utils/date";

interface MealCardProps {
  meal: Meal;
}

type ItemsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; items: MealItem[] }
  | { kind: "failed"; message: string };

/**
 * One persisted meal with its backend-stored totals. The list endpoints
 * (GET /api/me/meals, /history/daily) return meals without items, so the
 * items are fetched on demand from the existing GET /api/me/meals/:mealId
 * when the card is tapped - no N+1 requests just to render a list.
 */
export function MealCard({ meal }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ItemsState>({ kind: "idle" });
  const loadInFlight = useRef(false);

  async function loadItems() {
    if (loadInFlight.current) {
      return;
    }
    loadInFlight.current = true;
    setItems({ kind: "loading" });
    const result = await getMeal(meal.id);
    loadInFlight.current = false;
    setItems(
      result.kind === "success"
        ? { kind: "loaded", items: result.meal.items }
        : { kind: "failed", message: failureMessage(result.kind) },
    );
  }

  function handlePress() {
    const next = !expanded;
    setExpanded(next);
    if (next && (items.kind === "idle" || items.kind === "failed")) {
      void loadItems();
    }
  }

  return (
    <Pressable
      style={styles.card}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      testID="meal-card"
    >
      <View style={styles.headerRow}>
        <Text style={styles.type}>{mealTypeLabel(meal.mealType)}</Text>
        <Text style={styles.calories} testID="meal-card-calories">{meal.calories} kcal</Text>
      </View>
      <Text style={styles.time}>{formatLocalDateTime(meal.eatenAt)}</Text>
      <Text style={styles.macros} testID="meal-card-macros">
        Protein {meal.proteinG} g · Fat {meal.fatG} g · Carbs {meal.carbsG} g
      </Text>

      {expanded && (
        <View style={styles.items}>
          {items.kind === "loading" && <ActivityIndicator size="small" />}
          {items.kind === "failed" && <Text style={styles.error}>{items.message}</Text>}
          {items.kind === "loaded" &&
            items.items.map((item) => (
              <Text key={item.id} style={styles.item} testID="meal-card-item">
                {`• ${item.name}${item.quantityG !== null ? ` (${item.quantityG} g)` : ""} — ${item.calories} kcal, P ${item.proteinG} / F ${item.fatG} / C ${item.carbsG} g`}
              </Text>
            ))}
        </View>
      )}
      {!expanded && <Text style={styles.hint}>Tap to show items</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  type: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  calories: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2f6f4f",
  },
  time: {
    fontSize: 13,
    color: "#777777",
  },
  macros: {
    fontSize: 14,
    color: "#333333",
  },
  items: {
    marginTop: 6,
    gap: 4,
  },
  item: {
    fontSize: 14,
    color: "#333333",
  },
  hint: {
    fontSize: 12,
    color: "#999999",
  },
  error: {
    fontSize: 13,
    color: "#b3261e",
  },
});
