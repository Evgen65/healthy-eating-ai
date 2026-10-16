import type { PlannedNutrition, WeeklyPlanDay } from "@healthy-eating-ai/shared";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { failureMessage } from "../../src/api/messages";
import { getWeeklyPlan } from "../../src/api/weeklyPlanApi";
import { FormMessage } from "../../src/components/FormMessage";
import { NavLinkButton } from "../../src/components/NavLinkButton";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { InfoText, LoadingRow } from "../../src/components/StatusMessage";
import { TargetMissingNotice } from "../../src/components/TargetMissingNotice";
import { WeekSelector } from "../../src/components/WeekSelector";
import { useFocusedData } from "../../src/hooks/useFocusedData";
import { mealTypeLabel } from "../../src/meals/mealForm";
import { useSelectedWeek } from "../../src/plan/SelectedWeekContext";
import { getWeekdayLabel } from "../../src/utils/week";

function formatNutrition(value: PlannedNutrition): string {
  return `${value.calories} kcal · P ${value.proteinG} g · F ${value.fatG} g · C ${value.carbsG} g`;
}

function signed(value: number, unit: string): string {
  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

function formatDifference(value: PlannedNutrition): string {
  return `${signed(value.calories, "kcal")} · P ${signed(value.proteinG, "g")} · F ${signed(value.fatG, "g")} · C ${signed(value.carbsG, "g")}`;
}

function DayCard({ day }: { day: WeeklyPlanDay }) {
  return (
    <View style={styles.dayCard} testID="plan-day">
      <Text style={styles.weekday}>{getWeekdayLabel(day.date)}</Text>
      <Text style={styles.muted}>{day.date}</Text>

      {day.meals.map((meal) => (
        <View key={meal.mealType} style={styles.meal} testID="plan-meal">
          <Text style={styles.mealType}>{mealTypeLabel(meal.mealType)}</Text>
          <Text style={styles.mealTitle}>{meal.title}</Text>
          {meal.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredient}>
              • {ingredient.quantity} {ingredient.unit} {ingredient.name}
            </Text>
          ))}
          <Text style={styles.muted}>{formatNutrition(meal.plannedNutrition)}</Text>
        </View>
      ))}

      <Text style={styles.totalsLabel}>Daily planned totals</Text>
      <Text style={styles.totals}>{formatNutrition(day.plannedTotals)}</Text>
      <Text style={styles.totalsLabel}>Difference from target</Text>
      <Text style={styles.totals}>{formatDifference(day.differenceFromTarget)}</Text>
    </View>
  );
}

/**
 * The deterministic weekly plan from GET /api/me/plan/weekly?startDate=... -
 * the same backend-generated plan the Web Plan page shows for the same
 * startDate. Nothing is computed here. The selected week is shared with the
 * Shopping tab (SelectedWeekContext), so both always refer to the same week.
 */
export default function PlanScreen() {
  const { startDate } = useSelectedWeek();
  // A new `load` per week makes useFocusedData clear the previous week's
  // plan immediately, so a slow response never shows another week's meals.
  const load = useCallback(() => getWeeklyPlan(startDate), [startDate]);
  const { data, refreshing, refresh, retry } = useFocusedData(load);

  function renderContent() {
    if (data === null) {
      return <LoadingRow label="Loading weekly plan..." />;
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

    const { plan } = data;
    return (
      <>
        <Text style={styles.range} testID="plan-range">
          {plan.startDate} — {plan.endDate}
        </Text>
        <Text style={styles.totalsLabel}>Daily nutrition target</Text>
        <Text style={styles.totals}>{formatNutrition(plan.dailyTarget)}</Text>
        <InfoText text={plan.notice} />
        <Text style={styles.muted}>Plan version: {plan.planVersion}</Text>
        <NavLinkButton href="/shopping" label="Shopping list for this week" variant="secondary" />
        {plan.days.length === 0 ? (
          <InfoText text="No weekly plan is available." />
        ) : (
          plan.days.map((day) => <DayCard key={day.date} day={day} />)
        )}
      </>
    );
  }

  return (
    <ScreenContainer title="Plan" refreshing={refreshing} onRefresh={refresh} testID="plan-screen">
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
  dayCard: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  weekday: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  meal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    gap: 2,
  },
  mealType: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#2f6f4f",
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  ingredient: {
    fontSize: 14,
    color: "#333333",
  },
  totalsLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#555555",
  },
  totals: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  muted: {
    fontSize: 13,
    color: "#777777",
  },
});
