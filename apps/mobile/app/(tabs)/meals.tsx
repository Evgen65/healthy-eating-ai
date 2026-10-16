import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createMeal, getMeals } from "../../src/api/mealApi";
import { failureMessage } from "../../src/api/messages";
import { AiMealAnalysis } from "../../src/components/AiMealAnalysis";
import { FormMessage } from "../../src/components/FormMessage";
import { MealCard } from "../../src/components/MealCard";
import { MealItemEditor, MealMetaFields, type MealItemField } from "../../src/components/MealFormFields";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { InfoText, LoadingRow } from "../../src/components/StatusMessage";
import { useFocusedData } from "../../src/hooks/useFocusedData";
import {
  createEmptyItem,
  createEmptyMealForm,
  NO_MEAL_FORM_ERRORS,
  validateMealForm,
  type MealFormErrors,
  type MealFormState,
} from "../../src/meals/mealForm";

/**
 * The current user's meals (GET /api/me/meals) plus manual Add Meal and AI
 * photo analysis - both saving through POST /api/me/meals, the same
 * contract the Web Meals page uses. Totals shown are always the backend's
 * stored values: after a save the list is refetched from the server rather
 * than patched locally.
 */
export default function MealsScreen() {
  const { data, refreshing, refresh, retry, reload } = useFocusedData(getMeals);

  const nextItemKey = useRef(1);
  const newForm = () => createEmptyMealForm(nextItemKey.current++);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MealFormState>(newForm);
  const [errors, setErrors] = useState<MealFormErrors>(NO_MEAL_FORM_ERRORS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Synchronous double-submit guard: two fast taps land before `saving`
  // re-renders the button as disabled - the ref stops the second one, so
  // one tap is always exactly one POST /api/me/meals (see M15's Web fix).
  const submitInFlight = useRef(false);

  function openForm() {
    // Fresh "now" date/time every time the form is opened.
    setForm(newForm());
    setErrors(NO_MEAL_FORM_ERRORS);
    setMessage(null);
    setFormOpen(true);
  }

  function updateItem(key: number, field: MealItemField, value: string) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  }

  function addItem() {
    setForm((previous) => ({ ...previous, items: [...previous.items, createEmptyItem(nextItemKey.current++)] }));
  }

  function removeItem(key: number) {
    setForm((previous) => ({ ...previous, items: previous.items.filter((item) => item.key !== key) }));
  }

  async function handleSave() {
    if (submitInFlight.current) {
      return;
    }

    const { errors: validationErrors, input } = validateMealForm(form);
    setErrors(validationErrors);
    setMessage(null);
    if (!input) {
      setMessage({ type: "error", text: "Please fix the highlighted fields." });
      return;
    }

    submitInFlight.current = true;
    setSaving(true);
    const result = await createMeal(input);
    submitInFlight.current = false;
    setSaving(false);

    if (result.kind === "success") {
      setFormOpen(false);
      setForm(newForm());
      setErrors(NO_MEAL_FORM_ERRORS);
      setMessage({ type: "success", text: "Meal saved successfully." });
      reload();
    } else if (result.kind === "invalid") {
      setMessage({ type: "error", text: "Some meal values are invalid. Please check the form." });
    } else {
      setMessage({ type: "error", text: failureMessage(result.kind) });
    }
  }

  function renderList() {
    if (data === null) {
      return <LoadingRow label="Loading meals..." />;
    }
    if (data.kind !== "success") {
      return (
        <>
          <FormMessage type="error" text={failureMessage(data.kind)} />
          <PrimaryButton label="Retry" onPress={retry} />
        </>
      );
    }
    if (data.meals.length === 0) {
      return <InfoText text="No meals recorded yet." testID="meals-empty" />;
    }
    return data.meals.map((meal) => <MealCard key={meal.id} meal={meal} />);
  }

  return (
    <ScreenContainer title="Meals" refreshing={refreshing} onRefresh={refresh} testID="meals-screen">
      {formOpen ? (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Add meal</Text>
          <MealMetaFields
            form={form}
            errors={errors}
            onChange={(field, value) => setForm((previous) => ({ ...previous, [field]: value }))}
          />

          {form.items.map((item, index) => (
            <MealItemEditor
              key={item.key}
              item={item}
              index={index}
              errors={errors}
              quantityLabel="Quantity (g, optional)"
              onChange={updateItem}
              onRemove={form.items.length > 1 ? removeItem : undefined}
            />
          ))}
          <PrimaryButton label="Add another item" onPress={addItem} variant="secondary" testID="meal-add-item" />

          <PrimaryButton
            label={saving ? "Saving..." : "Save meal"}
            onPress={() => void handleSave()}
            busy={saving}
            testID="meal-save"
          />
          {!saving && <PrimaryButton label="Cancel" onPress={() => setFormOpen(false)} variant="secondary" />}
        </View>
      ) : (
        <PrimaryButton label="Add meal" onPress={openForm} testID="meals-add" />
      )}

      {message ? <FormMessage type={message.type} text={message.text} testID="meals-message" /> : null}

      <AiMealAnalysis onMealSaved={reload} />

      <Text style={styles.sectionTitle}>Your meals</Text>
      {renderList()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
});
