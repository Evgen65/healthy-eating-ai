import { Pressable, StyleSheet, Text, View } from "react-native";

interface ChoiceFieldProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: string;
  onChange: (value: T) => void;
  error?: string;
  /** Each option gets `${testID}-${value}` as its automation locator. */
  testID?: string;
}

/**
 * A small set of tappable choices - the mobile stand-in for the Web
 * Profile form's <select>s, without pulling in a picker dependency for a
 * handful of fixed options.
 */
export function ChoiceField<T extends string>({ label, options, value, onChange, error, testID }: ChoiceFieldProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={testID ? `${testID}-${option.value}` : undefined}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: "#2f6f4f",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  optionSelected: {
    backgroundColor: "#2f6f4f",
  },
  optionLabel: {
    fontSize: 14,
    color: "#2f6f4f",
  },
  optionLabelSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },
  error: {
    fontSize: 13,
    color: "#b3261e",
  },
});
