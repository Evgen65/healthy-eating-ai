import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LoadingRowProps {
  label: string;
}

/** Inline "Loading ..." row - shown instead of an empty state while a request is still in flight. */
export function LoadingRow({ label }: LoadingRowProps) {
  return (
    <View style={styles.row}>
      <ActivityIndicator />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

/** Neutral, non-error informational text (empty states, prerequisites). */
export function InfoText({ text, testID }: { text: string; testID?: string }) {
  return (
    <Text style={styles.text} testID={testID}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    color: "#555555",
  },
});
