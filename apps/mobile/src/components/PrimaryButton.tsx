import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** Shows a spinner and disables the button. Visual only - screens still guard double-submit with a ref (see login.tsx). */
  busy?: boolean;
  variant?: "primary" | "secondary";
  /** Not available right now (e.g. nothing to act on yet) - dimmed, no spinner. */
  disabled?: boolean;
  /** Stable automation locator (Android resource-id) - see tests/mobile. */
  testID?: string;
}

export function PrimaryButton({ label, onPress, busy = false, variant = "primary", disabled = false, testID }: PrimaryButtonProps) {
  const secondary = variant === "secondary";
  const inactive = busy || disabled;
  return (
    <Pressable
      style={[styles.button, secondary && styles.buttonSecondary, inactive && styles.buttonBusy]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
    >
      {busy ? <ActivityIndicator color={secondary ? "#2f6f4f" : "#ffffff"} /> : null}
      <Text style={[styles.label, secondary && styles.labelSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2f6f4f",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2f6f4f",
  },
  buttonBusy: {
    opacity: 0.7,
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  labelSecondary: {
    color: "#2f6f4f",
  },
});
