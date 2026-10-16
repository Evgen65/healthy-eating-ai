import { StyleSheet, Text } from "react-native";

interface FormMessageProps {
  type: "success" | "error";
  text: string;
  testID?: string;
}

/** A controlled, user-facing status line under a form - never a raw API error body. */
export function FormMessage({ type, text, testID }: FormMessageProps) {
  return (
    <Text
      style={[styles.message, type === "error" ? styles.error : styles.success]}
      accessibilityRole={type === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#b3261e",
  },
  success: {
    color: "#1e7a3b",
  },
});
