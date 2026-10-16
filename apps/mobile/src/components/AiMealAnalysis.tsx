import { useRef, useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import type { MealAnalysisResult } from "@healthy-eating-ai/shared";
import { analyzeMealPhoto } from "../api/mealAnalysisApi";
import { createMeal } from "../api/mealApi";
import { failureMessage } from "../api/messages";
import {
  calculateFormTotals,
  createEmptyItem,
  createMealFormFromAnalysis,
  NO_MEAL_FORM_ERRORS,
  validateMealForm,
  type MealFormErrors,
  type MealFormState,
} from "../meals/mealForm";
import { pickMealPhotoFromGallery, takeMealPhoto, type MealPhoto, type MealPhotoResult } from "../meals/mealPhoto";
import { FormMessage } from "./FormMessage";
import { MealItemEditor, MealMetaFields, type MealItemField } from "./MealFormFields";
import { PrimaryButton } from "./PrimaryButton";
import { InfoText, LoadingRow } from "./StatusMessage";

interface AiMealAnalysisProps {
  /** Called after Confirm persisted the meal, so the screen refetches its list. */
  onMealSaved: () => void;
}

type Message = { type: "success" | "error"; text: string; canOpenSettings?: boolean };

/**
 * Photo -> AI estimate -> user correction -> Confirm, mirroring Web's AI
 * Photo Analysis section (apps/web/src/pages/MealsPage.tsx):
 *
 * - Nothing is uploaded until Analyze; analysis never saves anything.
 * - Only Confirm persists, via the ordinary POST /api/me/meals with the same
 *   payload/validation as manual Add Meal.
 * - Choosing, analyzing and confirming each have their own state, and
 *   Analyze/Confirm each have a synchronous ref guard against double taps.
 * - The AI response is kept immutable (`analysis`); edits only touch the
 *   `draft`, so "Reset to AI estimate" can always rebuild it.
 */
export function AiMealAnalysis({ onMealSaved }: AiMealAnalysisProps) {
  const [photo, setPhoto] = useState<MealPhoto | null>(null);
  const [choosing, setChoosing] = useState<"gallery" | "camera" | null>(null);
  const [photoMessage, setPhotoMessage] = useState<Message | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [draft, setDraft] = useState<MealFormState | null>(null);
  const [errors, setErrors] = useState<MealFormErrors>(NO_MEAL_FORM_ERRORS);
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<Message | null>(null);

  // Synchronous guards - state updates lag a render, so two fast taps would
  // otherwise both get through (one tap = one picker / AI call / POST).
  const chooseInFlight = useRef(false);
  const analyzeInFlight = useRef(false);
  const confirmInFlight = useRef(false);
  // Bumped whenever the selected photo changes; an analysis response is only
  // applied if it still belongs to the photo it was started for.
  const photoVersion = useRef(0);
  const nextItemKey = useRef(1);
  const newItemKey = () => nextItemKey.current++;

  const busy = choosing !== null || analyzing || confirming;

  function clearAnalysis() {
    setAnalysis(null);
    setAnalysisError(null);
    setDraft(null);
    setErrors(NO_MEAL_FORM_ERRORS);
  }

  function replacePhoto(next: MealPhoto | null) {
    photoVersion.current += 1;
    setPhoto(next);
    // A new (or no) photo immediately invalidates the previous estimate - it
    // must never appear to describe a different image.
    clearAnalysis();
  }

  async function handleChoose(source: "gallery" | "camera") {
    if (chooseInFlight.current || analyzeInFlight.current || confirmInFlight.current) {
      return;
    }
    chooseInFlight.current = true;
    setChoosing(source);
    setPhotoMessage(null);
    setConfirmMessage(null);

    const result: MealPhotoResult = source === "gallery" ? await pickMealPhotoFromGallery() : await takeMealPhoto();

    chooseInFlight.current = false;
    setChoosing(null);

    switch (result.kind) {
      case "selected":
        replacePhoto(result.photo);
        break;
      case "cancelled":
        // Keep whatever photo (and estimate) was there before.
        break;
      case "permission_denied":
        setPhotoMessage({ type: "error", text: result.message, canOpenSettings: result.canOpenSettings });
        break;
      case "invalid":
      case "error":
        setPhotoMessage({ type: "error", text: result.message });
        break;
    }
  }

  async function handleAnalyze() {
    if (analyzeInFlight.current || confirmInFlight.current || chooseInFlight.current || !photo) {
      return;
    }
    analyzeInFlight.current = true;
    const version = photoVersion.current;
    setAnalyzing(true);
    clearAnalysis();
    setConfirmMessage(null);

    const result = await analyzeMealPhoto(photo);

    analyzeInFlight.current = false;
    setAnalyzing(false);
    if (version !== photoVersion.current) {
      return;
    }

    if (result.kind === "success") {
      setAnalysis(result.result);
      setDraft(createMealFormFromAnalysis(result.result.items, newItemKey));
    } else {
      // The photo stays selected - Analyze can simply be tapped again.
      setAnalysisError(result.message);
    }
  }

  function updateDraft(update: (previous: MealFormState) => MealFormState) {
    setDraft((previous) => (previous ? update(previous) : previous));
  }

  function updateItem(key: number, field: MealItemField, value: string) {
    updateDraft((previous) => ({
      ...previous,
      items: previous.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  }

  function handleResetToEstimate() {
    if (!analysis || !draft) {
      return;
    }
    // Keeps the user's meal type/date/time - only the items are restored.
    setDraft({ ...draft, items: createMealFormFromAnalysis(analysis.items, newItemKey).items });
    setErrors(NO_MEAL_FORM_ERRORS);
  }

  async function handleConfirm() {
    if (confirmInFlight.current || analyzeInFlight.current || !draft) {
      return;
    }

    const { errors: validationErrors, input } = validateMealForm(draft, { quantityRequired: true });
    setErrors(validationErrors);
    setConfirmMessage(null);
    if (!input) {
      setConfirmMessage({
        type: "error",
        text: draft.items.length === 0 ? "Add at least one food item." : "Please fix the highlighted fields.",
      });
      return;
    }

    confirmInFlight.current = true;
    setConfirming(true);
    const result = await createMeal(input);
    confirmInFlight.current = false;
    setConfirming(false);

    if (result.kind === "success") {
      // The confirmed draft is now an ordinary persisted meal - back to a
      // clean initial state.
      replacePhoto(null);
      setConfirmMessage({ type: "success", text: "Meal saved successfully." });
      onMealSaved();
    } else if (result.kind === "invalid") {
      setConfirmMessage({ type: "error", text: "Some meal values are invalid. Please check the form." });
    } else {
      setConfirmMessage({ type: "error", text: failureMessage(result.kind) });
    }
  }

  function renderReview(form: MealFormState) {
    const totals = calculateFormTotals(form.items);
    return (
      <View style={styles.section}>
        <Text style={styles.subTitle}>AI meal estimate</Text>
        <InfoText text="AI-generated estimate - review and correct before saving." />

        {form.items.length === 0 ? <InfoText text="Add at least one food item." /> : null}
        {form.items.map((item, index) => (
          <MealItemEditor
            key={item.key}
            item={item}
            index={index}
            errors={errors}
            quantityLabel="Quantity (g)"
            onChange={updateItem}
            onRemove={(key) =>
              updateDraft((previous) => ({ ...previous, items: previous.items.filter((other) => other.key !== key) }))
            }
          />
        ))}
        <PrimaryButton
          label="Add item"
          variant="secondary"
          disabled={confirming}
          onPress={() => updateDraft((previous) => ({ ...previous, items: [...previous.items, createEmptyItem(newItemKey())] }))}
        />
        <PrimaryButton label="Reset to AI estimate" variant="secondary" disabled={confirming} onPress={handleResetToEstimate} />

        <View style={styles.totals}>
          <Text style={styles.totalsTitle}>Total: {totals.calories} kcal</Text>
          <Text style={styles.totalsText}>
            Protein {totals.proteinG} g · Fat {totals.fatG} g · Carbs {totals.carbsG} g
          </Text>
        </View>

        <MealMetaFields
          form={form}
          errors={errors}
          onChange={(field, value) => updateDraft((previous) => ({ ...previous, [field]: value }))}
        />

        <PrimaryButton
          label={confirming ? "Saving meal..." : "Confirm meal"}
          onPress={() => void handleConfirm()}
          busy={confirming}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AI photo analysis</Text>

      <View style={styles.row}>
        <View style={styles.half}>
          <PrimaryButton
            label={choosing === "gallery" ? "Opening..." : "Choose photo"}
            variant="secondary"
            busy={choosing === "gallery"}
            disabled={busy}
            onPress={() => void handleChoose("gallery")}
          />
        </View>
        <View style={styles.half}>
          <PrimaryButton
            label={choosing === "camera" ? "Opening..." : "Take photo"}
            variant="secondary"
            busy={choosing === "camera"}
            disabled={busy}
            onPress={() => void handleChoose("camera")}
          />
        </View>
      </View>

      {photoMessage ? <FormMessage type={photoMessage.type} text={photoMessage.text} /> : null}
      {photoMessage?.canOpenSettings ? (
        <PrimaryButton label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
      ) : null}

      {photo ? (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={styles.preview}
            resizeMode="contain"
            accessibilityLabel="Selected meal photo"
          />
          <PrimaryButton
            label={analyzing ? "Analyzing..." : "Analyze photo"}
            onPress={() => void handleAnalyze()}
            busy={analyzing}
            disabled={confirming || choosing !== null}
          />
          {analyzing ? <LoadingRow label="Analyzing your photo - this can take up to a minute." /> : null}
          {!busy ? <PrimaryButton label="Remove photo" variant="secondary" onPress={() => replacePhoto(null)} /> : null}
        </>
      ) : (
        <InfoText text="Choose or take a photo of your meal, then tap Analyze. Nothing is uploaded before that." />
      )}

      {analysisError ? <FormMessage type="error" text={analysisError} /> : null}
      {draft ? renderReview(draft) : null}
      {confirmMessage ? <FormMessage type={confirmMessage.type} text={confirmMessage.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  subTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: "#f2f2f2",
  },
  totals: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f1f7f3",
  },
  totalsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  totalsText: {
    fontSize: 14,
    color: "#333333",
  },
});
