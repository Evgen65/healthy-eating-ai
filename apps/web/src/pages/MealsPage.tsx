import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  calculateMealTotals,
  type Meal,
  type MealAnalysisItem,
  type MealAnalysisResult,
  type MealTotals,
  type MealType,
} from "@healthy-eating-ai/shared";
import { createMeal, getMeals, type MealCreateInput, type MealItemCreateInput } from "../api/mealApi";
import { analyzeMealPhoto } from "../api/mealAnalysisApi";
import "./MealsPage.css";

type LoadState = "loading" | "load-error" | "ready";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function validateMealPhoto(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "Unsupported image type.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Image is too large. Maximum size is 10 MB.";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

const MEAL_TYPE_OPTIONS: Array<[MealType, string]> = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
];

const MEAL_TYPE_LABELS: Record<MealType, string> = Object.fromEntries(MEAL_TYPE_OPTIONS) as Record<MealType, string>;

interface FoodItemFormState {
  key: number;
  name: string;
  quantityG: string;
  calories: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}

interface MealFormState {
  mealType: string;
  eatenAt: string;
  items: FoodItemFormState[];
}

interface ItemValidationErrors {
  name?: string;
  quantityG?: string;
  calories?: string;
  proteinG?: string;
  fatG?: string;
  carbsG?: string;
}

interface FormValidationErrors {
  mealType?: string;
  eatenAt?: string;
  items: Record<number, ItemValidationErrors>;
}

const EMPTY_ITEM_ERRORS: FormValidationErrors = { items: {} };

// The user-corrected draft is deliberately a separate editable copy of the
// AI response, not the response object itself - the AI result stays
// immutable reference data, and edits only ever touch this draft.
type CorrectedItemFormState = FoodItemFormState;

function validateCorrectedItem(item: CorrectedItemFormState): ItemValidationErrors {
  const itemErrors: ItemValidationErrors = {};

  if (!item.name.trim()) {
    itemErrors.name = "Enter a name.";
  }

  const quantityG = Number(item.quantityG);
  if (!item.quantityG.trim() || !Number.isFinite(quantityG) || quantityG <= 0) {
    itemErrors.quantityG = "Enter a number greater than 0.";
  }

  const calories = Number(item.calories);
  if (!item.calories.trim() || !Number.isInteger(calories) || calories < 0) {
    itemErrors.calories = "Enter a whole number of 0 or more.";
  }

  const proteinG = Number(item.proteinG);
  if (!item.proteinG.trim() || !Number.isFinite(proteinG) || proteinG < 0) {
    itemErrors.proteinG = "Enter a number of 0 or more.";
  }

  const fatG = Number(item.fatG);
  if (!item.fatG.trim() || !Number.isFinite(fatG) || fatG < 0) {
    itemErrors.fatG = "Enter a number of 0 or more.";
  }

  const carbsG = Number(item.carbsG);
  if (!item.carbsG.trim() || !Number.isFinite(carbsG) || carbsG < 0) {
    itemErrors.carbsG = "Enter a number of 0 or more.";
  }

  return itemErrors;
}

interface AiConfirmationErrors {
  mealType?: string;
  eatenAt?: string;
  items: Record<number, ItemValidationErrors>;
}

function isAiMealTypeValid(mealType: string): boolean {
  return MEAL_TYPE_OPTIONS.some(([value]) => value === mealType);
}

function isAiEatenAtValid(eatenAt: string): boolean {
  return eatenAt.trim() !== "" && !Number.isNaN(new Date(eatenAt).getTime());
}

function validateAiConfirmation(
  mealType: string,
  eatenAt: string,
  items: CorrectedItemFormState[],
): { errors: AiConfirmationErrors; input?: MealCreateInput } {
  const errors: AiConfirmationErrors = { items: {} };

  if (!isAiMealTypeValid(mealType)) {
    errors.mealType = "Select a meal type.";
  }

  let eatenAtIso: string | undefined;
  if (!isAiEatenAtValid(eatenAt)) {
    errors.eatenAt = "Enter a valid date and time.";
  } else {
    eatenAtIso = new Date(eatenAt).toISOString();
  }

  const mealItems: MealItemCreateInput[] = [];
  for (const item of items) {
    const itemErrors = validateCorrectedItem(item);
    if (Object.keys(itemErrors).length > 0) {
      errors.items[item.key] = itemErrors;
    } else {
      mealItems.push({
        name: item.name.trim(),
        quantityG: Number(item.quantityG),
        calories: Number(item.calories),
        proteinG: Number(item.proteinG),
        fatG: Number(item.fatG),
        carbsG: Number(item.carbsG),
      });
    }
  }

  if (errors.mealType || errors.eatenAt || !eatenAtIso || items.length === 0 || Object.keys(errors.items).length > 0) {
    return { errors };
  }

  return {
    errors,
    input: {
      mealType: mealType as MealType,
      eatenAt: eatenAtIso,
      items: mealItems,
    },
  };
}

function formatEatenAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sortMealsByEatenAtDesc(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => new Date(b.eatenAt).getTime() - new Date(a.eatenAt).getTime());
}

function validateMealForm(form: MealFormState): { errors: FormValidationErrors; input?: MealCreateInput } {
  const errors: FormValidationErrors = { items: {} };

  if (!MEAL_TYPE_OPTIONS.some(([value]) => value === form.mealType)) {
    errors.mealType = "Select a meal type.";
  }

  let eatenAtIso: string | undefined;
  if (!form.eatenAt.trim()) {
    errors.eatenAt = "Enter the date and time.";
  } else {
    const parsed = new Date(form.eatenAt);
    if (Number.isNaN(parsed.getTime())) {
      errors.eatenAt = "Enter a valid date and time.";
    } else {
      eatenAtIso = parsed.toISOString();
    }
  }

  const items: MealItemCreateInput[] = [];
  for (const item of form.items) {
    const itemErrors: ItemValidationErrors = {};

    const name = item.name.trim();
    if (!name) {
      itemErrors.name = "Enter a name.";
    }

    let quantityG: number | undefined;
    if (item.quantityG.trim()) {
      const value = Number(item.quantityG);
      if (!Number.isFinite(value) || value <= 0) {
        itemErrors.quantityG = "Enter a number greater than 0.";
      } else {
        quantityG = value;
      }
    }

    const calories = Number(item.calories);
    if (!item.calories.trim() || !Number.isInteger(calories) || calories < 0) {
      itemErrors.calories = "Enter a whole number of 0 or more.";
    }

    const proteinG = Number(item.proteinG);
    if (!item.proteinG.trim() || !Number.isFinite(proteinG) || proteinG < 0) {
      itemErrors.proteinG = "Enter a number of 0 or more.";
    }

    const fatG = Number(item.fatG);
    if (!item.fatG.trim() || !Number.isFinite(fatG) || fatG < 0) {
      itemErrors.fatG = "Enter a number of 0 or more.";
    }

    const carbsG = Number(item.carbsG);
    if (!item.carbsG.trim() || !Number.isFinite(carbsG) || carbsG < 0) {
      itemErrors.carbsG = "Enter a number of 0 or more.";
    }

    if (Object.keys(itemErrors).length > 0) {
      errors.items[item.key] = itemErrors;
    } else {
      items.push({
        name,
        ...(quantityG !== undefined ? { quantityG } : {}),
        calories,
        proteinG,
        fatG,
        carbsG,
      });
    }
  }

  if (errors.mealType || errors.eatenAt || Object.keys(errors.items).length > 0 || !eatenAtIso) {
    return { errors };
  }

  return {
    errors,
    input: {
      mealType: form.mealType as MealType,
      eatenAt: eatenAtIso,
      items,
    },
  };
}

export function MealsPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const nextItemKey = useRef(1);

  function createEmptyItem(): FoodItemFormState {
    const key = nextItemKey.current++;
    return { key, name: "", quantityG: "", calories: "", proteinG: "", fatG: "", carbsG: "" };
  }

  function createEmptyForm(): MealFormState {
    return { mealType: "", eatenAt: "", items: [createEmptyItem()] };
  }

  const [form, setForm] = useState<MealFormState>(createEmptyForm);
  const [errors, setErrors] = useState<FormValidationErrors>(EMPTY_ITEM_ERRORS);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Guards against duplicate POSTs from clicks that land before React has
  // re-rendered the disabled button - `saving` state alone lags a tick.
  const submitInFlight = useRef(false);

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MealAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // Guards against duplicate POSTs from clicks that land before React has
  // re-rendered the disabled button - `analyzing` state alone lags a tick.
  const analyzeInFlight = useRef(false);

  // The editable, user-corrected draft built from the latest AI estimate.
  // Kept separate from `analysisResult` so the AI response stays immutable
  // reference data and edits never mutate it.
  const [correctedItems, setCorrectedItems] = useState<CorrectedItemFormState[]>([]);
  const nextCorrectedItemKey = useRef(1);

  // Meal metadata the existing Meal API requires but the AI never infers -
  // the user always owns mealType/eatenAt for a confirmed AI meal.
  const [aiMealType, setAiMealType] = useState("");
  const [aiEatenAt, setAiEatenAt] = useState("");
  const [aiTouched, setAiTouched] = useState({ mealType: false, eatenAt: false });
  const [aiConfirming, setAiConfirming] = useState(false);
  const [aiSaveMessage, setAiSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Guards against duplicate POSTs from clicks that land before React has
  // re-rendered the disabled button - `aiConfirming` state alone lags a tick.
  const aiConfirmInFlight = useRef(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function createCorrectedItemFromAnalysisItem(item: MealAnalysisItem): CorrectedItemFormState {
    const key = nextCorrectedItemKey.current++;
    return {
      key,
      name: item.name,
      quantityG: String(item.estimatedQuantityG),
      calories: String(item.calories),
      proteinG: String(item.proteinG),
      fatG: String(item.fatG),
      carbsG: String(item.carbsG),
    };
  }

  function createCorrectedItemsFromAnalysis(items: MealAnalysisItem[]): CorrectedItemFormState[] {
    return items.map(createCorrectedItemFromAnalysisItem);
  }

  function createEmptyCorrectedItem(): CorrectedItemFormState {
    const key = nextCorrectedItemKey.current++;
    return { key, name: "", quantityG: "", calories: "", proteinG: "", fatG: "", carbsG: "" };
  }

  const correctedItemErrors = useMemo(() => {
    const map: Record<number, ItemValidationErrors> = {};
    for (const item of correctedItems) {
      const itemErrors = validateCorrectedItem(item);
      if (Object.keys(itemErrors).length > 0) {
        map[item.key] = itemErrors;
      }
    }
    return map;
  }, [correctedItems]);

  const correctedTotals = useMemo<MealTotals>(() => {
    const items = correctedItems.map((item) => {
      const calories = Number(item.calories);
      const proteinG = Number(item.proteinG);
      const fatG = Number(item.fatG);
      const carbsG = Number(item.carbsG);
      return {
        calories: Number.isFinite(calories) ? calories : 0,
        proteinG: Number.isFinite(proteinG) ? proteinG : 0,
        fatG: Number.isFinite(fatG) ? fatG : 0,
        carbsG: Number.isFinite(carbsG) ? carbsG : 0,
      };
    });
    return calculateMealTotals(items);
  }, [correctedItems]);

  function handleCorrectedItemFieldChange(
    key: number,
    field: keyof Omit<CorrectedItemFormState, "key">,
    value: string,
  ) {
    setCorrectedItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  }

  function handleAddCorrectedItem() {
    setCorrectedItems((prev) => [...prev, createEmptyCorrectedItem()]);
  }

  function handleRemoveCorrectedItem(key: number) {
    setCorrectedItems((prev) => prev.filter((item) => item.key !== key));
  }

  function handleResetCorrectedItems() {
    if (!analysisResult) {
      return;
    }
    setCorrectedItems(createCorrectedItemsFromAnalysis(analysisResult.items));
  }

  function handleAiMealTypeChange(value: string) {
    setAiMealType(value);
    setAiTouched((prev) => ({ ...prev, mealType: true }));
  }

  function handleAiEatenAtChange(value: string) {
    setAiEatenAt(value);
    setAiTouched((prev) => ({ ...prev, eatenAt: true }));
  }

  const aiMealTypeValid = isAiMealTypeValid(aiMealType);
  const aiEatenAtValid = isAiEatenAtValid(aiEatenAt);

  const canConfirmAiMeal =
    !!analysisResult &&
    correctedItems.length > 0 &&
    Object.keys(correctedItemErrors).length === 0 &&
    aiMealTypeValid &&
    aiEatenAtValid;

  async function handleConfirmAiMeal() {
    if (aiConfirmInFlight.current || !canConfirmAiMeal) {
      return;
    }

    const { input } = validateAiConfirmation(aiMealType, aiEatenAt, correctedItems);
    if (!input) {
      return;
    }

    aiConfirmInFlight.current = true;
    setAiConfirming(true);
    setAiSaveMessage(null);

    const result = await createMeal(input);

    aiConfirmInFlight.current = false;
    setAiConfirming(false);

    if (result.kind === "success") {
      setMeals((prev) => sortMealsByEatenAtDesc([result.meal, ...prev]));

      // Return the AI Photo Analysis section to a clean initial state -
      // the confirmed draft is now an ordinary persisted Meal.
      setSelectedPhoto(null);
      setPhotoError(null);
      setAnalysisResult(null);
      setAnalysisError(null);
      setCorrectedItems([]);
      setAiMealType("");
      setAiEatenAt("");
      setAiTouched({ mealType: false, eatenAt: false });
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }

      setAiSaveMessage({ type: "success", text: "Meal saved successfully" });
      return;
    }

    if (result.kind === "invalid") {
      setAiSaveMessage({ type: "error", text: result.message });
      return;
    }

    setAiSaveMessage({ type: "error", text: "Meal could not be saved. Please try again." });
  }

  useEffect(() => {
    if (!selectedPhoto || photoError) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedPhoto);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedPhoto, photoError]);

  useEffect(() => {
    let cancelled = false;

    void getMeals().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "success") {
        setMeals(sortMealsByEatenAtDesc(result.meals));
        setLoadState("ready");
      } else {
        setLoadState("load-error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleOpenForm() {
    setForm(createEmptyForm());
    setErrors(EMPTY_ITEM_ERRORS);
    setSaveMessage(null);
    setFormOpen(true);
  }

  function handleCancelForm() {
    setFormOpen(false);
  }

  function handleFormFieldChange(field: "mealType" | "eatenAt", value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleItemFieldChange(key: number, field: keyof Omit<FoodItemFormState, "key">, value: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }));
  }

  function handleAddItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  }

  function handleRemoveItem(key: number) {
    setForm((prev) => (prev.items.length > 1 ? { ...prev, items: prev.items.filter((item) => item.key !== key) } : prev));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitInFlight.current) {
      return;
    }

    const { errors: validationErrors, input } = validateMealForm(form);
    setErrors(validationErrors);
    if (!input) {
      return;
    }

    submitInFlight.current = true;
    setSaving(true);
    setSaveMessage(null);
    const result = await createMeal(input);
    submitInFlight.current = false;
    setSaving(false);

    if (result.kind === "success") {
      setMeals((prev) => sortMealsByEatenAtDesc([result.meal, ...prev]));
      setFormOpen(false);
      setForm(createEmptyForm());
      setErrors(EMPTY_ITEM_ERRORS);
      setSaveMessage({ type: "success", text: "Meal saved successfully" });
      return;
    }

    if (result.kind === "invalid") {
      setSaveMessage({ type: "error", text: result.message });
      return;
    }

    setSaveMessage({ type: "error", text: "Unable to save meal" });
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    // A new selection immediately invalidates any prior AI estimate - it
    // must never appear to describe a different photo.
    setAnalysisResult(null);
    setAnalysisError(null);
    setCorrectedItems([]);
    setAiMealType("");
    setAiEatenAt("");
    setAiTouched({ mealType: false, eatenAt: false });
    setAiSaveMessage(null);

    setSelectedPhoto(file);
    setPhotoError(file ? validateMealPhoto(file) : null);
  }

  async function handleAnalyzePhoto() {
    if (analyzeInFlight.current || !selectedPhoto || photoError) {
      return;
    }

    analyzeInFlight.current = true;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setCorrectedItems([]);
    setAiMealType("");
    setAiEatenAt("");
    setAiTouched({ mealType: false, eatenAt: false });
    setAiSaveMessage(null);

    const result = await analyzeMealPhoto(selectedPhoto);
    analyzeInFlight.current = false;
    setAnalyzing(false);

    if (result.kind === "success") {
      setAnalysisResult(result.result);
      setCorrectedItems(createCorrectedItemsFromAnalysis(result.result.items));
      return;
    }

    setAnalysisError(result.message);
  }

  return (
    <section>
      <h1>Meals</h1>

      <button type="button" className="meals-page__add-button" onClick={handleOpenForm}>
        Add Meal
      </button>

      {saveMessage && (
        <p
          className={`meals-page__message meals-page__message--${saveMessage.type}`}
          role={saveMessage.type === "error" ? "alert" : "status"}
        >
          {saveMessage.text}
        </p>
      )}

      {formOpen && (
        <form className="meal-form" onSubmit={handleSubmit} noValidate>
          <div className="meal-form__field">
            <label htmlFor="meal-type">Meal type</label>
            <select
              id="meal-type"
              value={form.mealType}
              onChange={(event) => handleFormFieldChange("mealType", event.target.value)}
            >
              <option value="" disabled>
                Select meal type
              </option>
              {MEAL_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.mealType && <p className="meal-form__error">{errors.mealType}</p>}
          </div>

          <div className="meal-form__field">
            <label htmlFor="meal-eaten-at">Eaten at</label>
            <input
              id="meal-eaten-at"
              type="datetime-local"
              value={form.eatenAt}
              onChange={(event) => handleFormFieldChange("eatenAt", event.target.value)}
            />
            {errors.eatenAt && <p className="meal-form__error">{errors.eatenAt}</p>}
          </div>

          <h2 className="meal-form__items-heading">Food items</h2>

          {form.items.map((item, index) => {
            const position = index + 1;
            const itemErrors = errors.items[item.key];
            return (
              <div className="meal-form__item" key={item.key}>
                <div className="meal-form__item-header">
                  <h3>Item {position}</h3>
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(item.key)}>
                      Remove item
                    </button>
                  )}
                </div>

                <div className="meal-form__item-fields">
                  <div className="meal-form__field">
                    <label htmlFor={`item-${item.key}-name`}>{`Name (item ${position})`}</label>
                    <input
                      id={`item-${item.key}-name`}
                      type="text"
                      value={item.name}
                      onChange={(event) => handleItemFieldChange(item.key, "name", event.target.value)}
                    />
                    {itemErrors?.name && <p className="meal-form__error">{itemErrors.name}</p>}
                  </div>

                  <div className="meal-form__field">
                    <label htmlFor={`item-${item.key}-quantity`}>{`Quantity (g) (item ${position})`}</label>
                    <input
                      id={`item-${item.key}-quantity`}
                      type="number"
                      value={item.quantityG}
                      onChange={(event) => handleItemFieldChange(item.key, "quantityG", event.target.value)}
                    />
                    {itemErrors?.quantityG && <p className="meal-form__error">{itemErrors.quantityG}</p>}
                  </div>

                  <div className="meal-form__field">
                    <label htmlFor={`item-${item.key}-calories`}>{`Calories (item ${position})`}</label>
                    <input
                      id={`item-${item.key}-calories`}
                      type="number"
                      value={item.calories}
                      onChange={(event) => handleItemFieldChange(item.key, "calories", event.target.value)}
                    />
                    {itemErrors?.calories && <p className="meal-form__error">{itemErrors.calories}</p>}
                  </div>

                  <div className="meal-form__field">
                    <label htmlFor={`item-${item.key}-protein`}>{`Protein (g) (item ${position})`}</label>
                    <input
                      id={`item-${item.key}-protein`}
                      type="number"
                      value={item.proteinG}
                      onChange={(event) => handleItemFieldChange(item.key, "proteinG", event.target.value)}
                    />
                    {itemErrors?.proteinG && <p className="meal-form__error">{itemErrors.proteinG}</p>}
                  </div>

                  <div className="meal-form__field">
                    <label htmlFor={`item-${item.key}-fat`}>{`Fat (g) (item ${position})`}</label>
                    <input
                      id={`item-${item.key}-fat`}
                      type="number"
                      value={item.fatG}
                      onChange={(event) => handleItemFieldChange(item.key, "fatG", event.target.value)}
                    />
                    {itemErrors?.fatG && <p className="meal-form__error">{itemErrors.fatG}</p>}
                  </div>

                  <div className="meal-form__field">
                    <label htmlFor={`item-${item.key}-carbs`}>{`Carbohydrates (g) (item ${position})`}</label>
                    <input
                      id={`item-${item.key}-carbs`}
                      type="number"
                      value={item.carbsG}
                      onChange={(event) => handleItemFieldChange(item.key, "carbsG", event.target.value)}
                    />
                    {itemErrors?.carbsG && <p className="meal-form__error">{itemErrors.carbsG}</p>}
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" className="meal-form__add-item" onClick={handleAddItem}>
            Add item
          </button>

          <div className="meal-form__actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Meal"}
            </button>
            <button type="button" className="meal-form__cancel" onClick={handleCancelForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="ai-photo-analysis">
        <h2>AI Photo Analysis</h2>

        {aiSaveMessage && (
          <p
            className={`meals-page__message meals-page__message--${aiSaveMessage.type}`}
            role={aiSaveMessage.type === "error" ? "alert" : "status"}
          >
            {aiSaveMessage.text}
          </p>
        )}

        <div className="ai-photo-analysis__field">
          <label htmlFor="meal-photo-input">Meal photo</label>
          <input
            id="meal-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            ref={photoInputRef}
            onChange={handlePhotoChange}
          />
        </div>

        {selectedPhoto && (
          <p className="ai-photo-analysis__filename">
            Selected: {selectedPhoto.name} ({formatFileSize(selectedPhoto.size)})
          </p>
        )}

        {photoError && (
          <p className="ai-photo-analysis__error" role="alert">
            {photoError}
          </p>
        )}

        {previewUrl && (
          <img
            className="ai-photo-analysis__preview"
            src={previewUrl}
            alt={`Preview of ${selectedPhoto?.name ?? "selected meal photo"}`}
          />
        )}

        <button
          type="button"
          className="ai-photo-analysis__analyze-button"
          onClick={handleAnalyzePhoto}
          disabled={!selectedPhoto || !!photoError || analyzing}
        >
          {analyzing ? "Analyzing..." : "Analyze photo"}
        </button>

        {analysisError && (
          <p className="ai-photo-analysis__error" role="alert">
            {analysisError}
          </p>
        )}

        {analysisResult && (
          <div className="ai-meal-estimate">
            <h3>AI meal estimate</h3>
            <p className="ai-meal-estimate__disclaimer">
              AI-generated estimate — review and correct before saving.
            </p>

            {correctedItems.length === 0 ? (
              <p className="ai-meal-estimate__empty">Add at least one food item.</p>
            ) : (
              <ul className="ai-meal-estimate__items">
                {correctedItems.map((item, index) => {
                  const position = index + 1;
                  const itemErrors = correctedItemErrors[item.key];
                  return (
                    <li key={item.key} className="ai-meal-estimate__item">
                      <div className="ai-meal-estimate__item-header">
                        <h4>Item {position}</h4>
                        <button type="button" onClick={() => handleRemoveCorrectedItem(item.key)}>
                          Remove item
                        </button>
                      </div>

                      <div className="ai-meal-estimate__item-fields">
                        <div className="meal-form__field">
                          <label htmlFor={`ai-item-${item.key}-name`}>{`Name (AI item ${position})`}</label>
                          <input
                            id={`ai-item-${item.key}-name`}
                            type="text"
                            value={item.name}
                            onChange={(event) =>
                              handleCorrectedItemFieldChange(item.key, "name", event.target.value)
                            }
                          />
                          {itemErrors?.name && <p className="meal-form__error">{itemErrors.name}</p>}
                        </div>

                        <div className="meal-form__field">
                          <label htmlFor={`ai-item-${item.key}-quantity`}>{`Quantity in grams (AI item ${position})`}</label>
                          <input
                            id={`ai-item-${item.key}-quantity`}
                            type="number"
                            value={item.quantityG}
                            onChange={(event) =>
                              handleCorrectedItemFieldChange(item.key, "quantityG", event.target.value)
                            }
                          />
                          {itemErrors?.quantityG && <p className="meal-form__error">{itemErrors.quantityG}</p>}
                        </div>

                        <div className="meal-form__field">
                          <label htmlFor={`ai-item-${item.key}-calories`}>{`Calories (AI item ${position})`}</label>
                          <input
                            id={`ai-item-${item.key}-calories`}
                            type="number"
                            value={item.calories}
                            onChange={(event) =>
                              handleCorrectedItemFieldChange(item.key, "calories", event.target.value)
                            }
                          />
                          {itemErrors?.calories && <p className="meal-form__error">{itemErrors.calories}</p>}
                        </div>

                        <div className="meal-form__field">
                          <label htmlFor={`ai-item-${item.key}-protein`}>{`Protein in grams (AI item ${position})`}</label>
                          <input
                            id={`ai-item-${item.key}-protein`}
                            type="number"
                            value={item.proteinG}
                            onChange={(event) =>
                              handleCorrectedItemFieldChange(item.key, "proteinG", event.target.value)
                            }
                          />
                          {itemErrors?.proteinG && <p className="meal-form__error">{itemErrors.proteinG}</p>}
                        </div>

                        <div className="meal-form__field">
                          <label htmlFor={`ai-item-${item.key}-fat`}>{`Fat in grams (AI item ${position})`}</label>
                          <input
                            id={`ai-item-${item.key}-fat`}
                            type="number"
                            value={item.fatG}
                            onChange={(event) =>
                              handleCorrectedItemFieldChange(item.key, "fatG", event.target.value)
                            }
                          />
                          {itemErrors?.fatG && <p className="meal-form__error">{itemErrors.fatG}</p>}
                        </div>

                        <div className="meal-form__field">
                          <label htmlFor={`ai-item-${item.key}-carbs`}>{`Carbohydrates in grams (AI item ${position})`}</label>
                          <input
                            id={`ai-item-${item.key}-carbs`}
                            type="number"
                            value={item.carbsG}
                            onChange={(event) =>
                              handleCorrectedItemFieldChange(item.key, "carbsG", event.target.value)
                            }
                          />
                          {itemErrors?.carbsG && <p className="meal-form__error">{itemErrors.carbsG}</p>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="ai-meal-estimate__actions">
              <button type="button" className="ai-meal-estimate__add-item" onClick={handleAddCorrectedItem}>
                Add food item
              </button>
              <button type="button" className="ai-meal-estimate__reset" onClick={handleResetCorrectedItems}>
                Reset to AI estimate
              </button>
            </div>

            <div className="ai-meal-estimate__totals">
              <h4>Corrected totals</h4>
              <p className="ai-meal-estimate__totals-calories">{correctedTotals.calories} kcal</p>
              <p className="ai-meal-estimate__totals-macros">
                Protein {correctedTotals.proteinG} g &middot; Fat {correctedTotals.fatG} g &middot;
                Carbohydrates {correctedTotals.carbsG} g
              </p>
            </div>

            <div className="ai-meal-estimate__meta">
              <h4>Meal details</h4>

              <div className="meal-form__field">
                <label htmlFor="ai-meal-type">Meal type (AI meal)</label>
                <select
                  id="ai-meal-type"
                  value={aiMealType}
                  onChange={(event) => handleAiMealTypeChange(event.target.value)}
                >
                  <option value="" disabled>
                    Select meal type
                  </option>
                  {MEAL_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {aiTouched.mealType && !aiMealTypeValid && <p className="meal-form__error">Select a meal type.</p>}
              </div>

              <div className="meal-form__field">
                <label htmlFor="ai-eaten-at">Eaten at (AI meal)</label>
                <input
                  id="ai-eaten-at"
                  type="datetime-local"
                  value={aiEatenAt}
                  onChange={(event) => handleAiEatenAtChange(event.target.value)}
                />
                {aiTouched.eatenAt && !aiEatenAtValid && (
                  <p className="meal-form__error">Enter a valid date and time.</p>
                )}
              </div>
            </div>

            <div className="ai-meal-estimate__actions">
              <button
                type="button"
                className="ai-meal-estimate__confirm"
                onClick={handleConfirmAiMeal}
                disabled={!canConfirmAiMeal || aiConfirming}
              >
                {aiConfirming ? "Saving..." : "Confirm meal"}
              </button>
            </div>
          </div>
        )}
      </section>

      {loadState === "loading" && <p>Loading meals...</p>}

      {loadState === "load-error" && (
        <p className="meals-page__message meals-page__message--error" role="alert">
          Unable to load meals
        </p>
      )}

      {loadState === "ready" &&
        (meals.length === 0 ? (
          <p>No meals recorded yet.</p>
        ) : (
          <ul className="meals-list">
            {meals.map((meal) => (
              <li key={meal.id} className="meals-list__item">
                <h2 className="meals-list__type">{MEAL_TYPE_LABELS[meal.mealType]}</h2>
                <p className="meals-list__calories">{meal.calories} kcal</p>
                <p className="meals-list__macros">
                  Protein {meal.proteinG} g &middot; Fat {meal.fatG} g &middot; Carbohydrates {meal.carbsG} g
                </p>
                <p className="meals-list__time">{formatEatenAt(meal.eatenAt)}</p>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
