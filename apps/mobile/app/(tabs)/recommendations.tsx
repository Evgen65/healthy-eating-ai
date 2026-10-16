import { StyleSheet, Text, View } from "react-native";
import { failureMessage } from "../../src/api/messages";
import { getTodayRecommendations } from "../../src/api/recommendationsApi";
import { FormMessage } from "../../src/components/FormMessage";
import { NutritionSummaryTable } from "../../src/components/NutritionSummaryTable";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { InfoText, LoadingRow } from "../../src/components/StatusMessage";
import { TargetMissingNotice } from "../../src/components/TargetMissingNotice";
import { useFocusedData } from "../../src/hooks/useFocusedData";

/**
 * Today's recommendations from GET /api/me/recommendations/today - the same
 * backend-generated list (code/level/message) and daily summary the Web
 * Recommendations page shows. Refetched every time the tab is opened, so a
 * meal just added on Meals (or on Web) is reflected, and on pull-to-refresh.
 */
export default function RecommendationsScreen() {
  const { data, refreshing, refresh, retry } = useFocusedData(getTodayRecommendations);

  function renderContent() {
    if (data === null) {
      return <LoadingRow label="Loading recommendations..." />;
    }
    if (data.kind === "target_not_found") {
      return <TargetMissingNotice />;
    }
    if (data.kind !== "found") {
      return (
        <>
          <FormMessage type="error" text={failureMessage(data.kind)} />
          <PrimaryButton label="Retry" onPress={retry} />
        </>
      );
    }

    const { recommendations } = data;
    return (
      <>
        <InfoText text={`Your nutrition recommendations for ${recommendations.date} (UTC day).`} />
        <Text style={styles.sectionTitle}>Daily summary</Text>
        <NutritionSummaryTable summary={recommendations.summary} testID="recommendations-summary" />
        <Text style={styles.sectionTitle}>Today's recommendations</Text>
        {recommendations.recommendations.length === 0 ? (
          <InfoText text="No recommendations available for today." testID="recommendations-empty" />
        ) : (
          recommendations.recommendations.map((recommendation, index) => {
            const warning = recommendation.level === "warning";
            return (
              <View
                key={`${recommendation.code}-${index}`}
                style={[styles.item, warning && styles.itemWarning]}
                testID="recommendation-item"
              >
                <Text style={[styles.level, warning && styles.levelWarning]}>{warning ? "Warning" : "Info"}</Text>
                <Text style={styles.message}>{recommendation.message}</Text>
              </View>
            );
          })
        )}
      </>
    );
  }

  return (
    <ScreenContainer title="Recommendations" refreshing={refreshing} onRefresh={refresh} testID="recommendations-screen">
      {renderContent()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  item: {
    borderWidth: 1,
    borderColor: "#cfe3d7",
    borderLeftWidth: 4,
    borderLeftColor: "#2f6f4f",
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  itemWarning: {
    borderColor: "#f0d9b5",
    borderLeftColor: "#b26a00",
  },
  level: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#2f6f4f",
  },
  levelWarning: {
    color: "#b26a00",
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: "#1a1a1a",
  },
});
