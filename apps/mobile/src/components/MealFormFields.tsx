import { Pressable, StyleSheet, Text, View } from "react-native";
import { MEAL_TYPE_OPTIONS, type MealFormErrors, type MealFormState, type MealItemFormState } from "../meals/mealForm";
import { ChoiceField } from "./ChoiceField";
import { FormMessage } from "./FormMessage";
import { TextField } from "./TextField";

export type MealItemField = Exclude<keyof MealItemFormState, "key">;

interface MealMetaFieldsProps {
  form: MealFormState;
  errors: MealFormErrors;
  onChange: (field: "mealType" | "date" | "time", value: string) => void;
}

/** Meal type + local date/time - shared by manual Add Meal and the AI review's Confirm step. */
export function MealMetaFields({ form, errors, onChange }: MealMetaFieldsProps) {
  return (
    <>
      <ChoiceField
        label="Meal type"
        options={MEAL_TYPE_OPTIONS}
        value={form.mealType}
        onChange={(value) => onChange("mealType", value)}
        error={errors.mealType}
        testID="meal-type"
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="Date (YYYY-MM-DD)"
            value={form.date}
            onChangeText={(value) => onChange("date", value)}
            autoCorrect={false}
            testID="meal-date"
          />
        </View>
        <View style={styles.half}>
          <TextField
            label="Time (HH:MM)"
            value={form.time}
            onChangeText={(value) => onChange("time", value)}
            autoCorrect={false}
            testID="meal-time"
          />
        </View>
      </View>
      {errors.eatenAt ? <FormMessage type="error" text={errors.eatenAt} /> : null}
    </>
  );
}

interface MealItemEditorProps {
  item: MealItemFormState;
  index: number;
  errors: MealFormErrors;
  quantityLabel: string;
  onChange: (key: number, field: MealItemField, value: string) => void;
  /** Omitted when the item cannot be removed (e.g. the only item of a manual meal). */
  onRemove?: (key: number) => void;
}

/** One editable food item (name, quantity, calories, macros) - shared by manual Add Meal and the AI review. */
export function MealItemEditor({ item, index, errors, quantityLabel, onChange, onRemove }: MealItemEditorProps) {
  const itemErrors = errors.items[item.key] ?? {};
  const field = (name: MealItemField, label: string, keyboard: "default" | "number-pad" | "decimal-pad") => (
    <View style={styles.half}>
      <TextField
        label={label}
        value={item[name]}
        onChangeText={(value) => onChange(item.key, name, value)}
        error={itemErrors[name]}
        keyboardType={keyboard}
        testID={`meal-item-${index}-${name}`}
      />
    </View>
  );

  return (
    <View style={styles.itemBox}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>Item {index + 1}</Text>
        {onRemove && (
          <Pressable onPress={() => onRemove(item.key)} accessibilityRole="button">
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        )}
      </View>
      <TextField
        label="Name"
        value={item.name}
        onChangeText={(value) => onChange(item.key, "name", value)}
        error={itemErrors.name}
        testID={`meal-item-${index}-name`}
      />
      <View style={styles.row}>
        {field("quantityG", quantityLabel, "decimal-pad")}
        {field("calories", "Calories (kcal)", "number-pad")}
      </View>
      <View style={styles.row}>
        {field("proteinG", "Protein (g)", "decimal-pad")}
        {field("fatG", "Fat (g)", "decimal-pad")}
      </View>
      <View style={styles.row}>
        {field("carbsG", "Carbs (g)", "decimal-pad")}
        <View style={styles.half} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  itemBox: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333333",
  },
  remove: {
    fontSize: 14,
    color: "#b3261e",
  },
});
