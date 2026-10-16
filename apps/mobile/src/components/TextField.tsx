import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
}

/** Labelled text input with an optional inline validation message - shared by the Login, Register and Profile forms. */
export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor="#999999"
        accessibilityLabel={label}
        {...inputProps}
      />
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
  input: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  inputError: {
    borderColor: "#b3261e",
  },
  error: {
    fontSize: 13,
    color: "#b3261e",
  },
});
