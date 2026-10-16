import { calculateMealTotals, type MealAnalysisItem, type MealTotals, type MealType } from "@healthy-eating-ai/shared";
import type { MealCreateInput, MealItemCreateInput } from "../api/mealApi";
import { formatLocalDate, formatLocalTime, localDateTimeToIso } from "../utils/date";
import { parseDecimal } from "../utils/number";

/**
 * Add Meal form state + validation (manual entry and the AI review draft),
 * kept out of the screen. Rules
 * mirror apps/web/src/pages/MealsPage.tsx's validateMealForm and the
 * backend's mealBodySchema (meal type required, a valid date/time, at least
 * one item, name required, optional quantity > 0, whole-number calories
 * >= 0, macros >= 0), so Mobile and Web accept exactly the same meals.
 */
export const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function mealTypeLabel(mealType: MealType): string {
  return MEAL_TYPE_OPTIONS.find((option) => option.value === mealType)?.label ?? mealType;
}

export interface MealItemFormState {
  key: number;
  name: string;
  quantityG: string;
  calories: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}

export interface MealFormState {
  mealType: string;
  /** Local YYYY-MM-DD. */
  date: string;
  /** Local HH:MM. */
  time: string;
  items: MealItemFormState[];
}

export type MealItemErrors = Partial<Record<Exclude<keyof MealItemFormState, "key">, string>>;

export interface MealFormErrors {
  mealType?: string;
  eatenAt?: string;
  items: Record<number, MealItemErrors>;
}

export const NO_MEAL_FORM_ERRORS: MealFormErrors = { items: {} };

export function createEmptyItem(key: number): MealItemFormState {
  return { key, name: "", quantityG: "", calories: "", proteinG: "", fatG: "", carbsG: "" };
}

/** Pre-fills "now" (local) so the common case - logging a meal just eaten - needs no date/time typing. */
export function createEmptyMealForm(firstItemKey: number, now: Date = new Date()): MealFormState {
  return { mealType: "", date: formatLocalDate(now), time: formatLocalTime(now), items: [createEmptyItem(firstItemKey)] };
}

/**
 * The AI review draft is an ordinary MealFormState pre-filled from the AI
 * estimate (mirrors Web's createCorrectedItemFromAnalysisItem), so a
 * confirmed AI meal goes through exactly the same validation and
 * /api/me/meals payload as a manual one. Meal type is left for the user to
 * choose; date/time default to "now", like the manual form.
 */
export function createMealFormFromAnalysis(
  items: MealAnalysisItem[],
  nextItemKey: () => number,
  now: Date = new Date(),
): MealFormState {
  return {
    mealType: "",
    date: formatLocalDate(now),
    time: formatLocalTime(now),
    items: items.map((item) => ({
      key: nextItemKey(),
      name: item.name,
      quantityG: String(item.estimatedQuantityG),
      calories: String(item.calories),
      proteinG: String(item.proteinG),
      fatG: String(item.fatG),
      carbsG: String(item.carbsG),
    })),
  };
}

/**
 * Live totals while the user corrects items - through the shared
 * calculateMealTotals (whole calories, grams to one decimal), the same
 * function the backend uses when it stores the meal. A field that is not
 * (yet) a valid number counts as 0, as on Web.
 */
export function calculateFormTotals(items: MealItemFormState[]): MealTotals {
  const valueOf = (text: string) => {
    const value = parseDecimal(text);
    return Number.isFinite(value) ? value : 0;
  };
  return calculateMealTotals(
    items.map((item) => ({
      calories: valueOf(item.calories),
      proteinG: valueOf(item.proteinG),
      fatG: valueOf(item.fatG),
      carbsG: valueOf(item.carbsG),
    })),
  );
}

export interface MealFormValidationOptions {
  /** AI review requires a quantity per item (as Web's validateCorrectedItem does); manual Add Meal keeps it optional. */
  quantityRequired?: boolean;
}

function validateItem(
  item: MealItemFormState,
  { quantityRequired = false }: MealFormValidationOptions,
): { errors: MealItemErrors; input?: MealItemCreateInput } {
  const errors: MealItemErrors = {};

  const name = item.name.trim();
  if (!name) {
    errors.name = "Enter a name.";
  }

  let quantityG: number | undefined;
  if (quantityRequired && !item.quantityG.trim()) {
    errors.quantityG = "Enter a number greater than 0.";
  } else if (item.quantityG.trim()) {
    const value = parseDecimal(item.quantityG);
    if (!Number.isFinite(value) || value <= 0) {
      errors.quantityG = "Enter a number greater than 0.";
    } else {
      quantityG = value;
    }
  }

  const calories = parseDecimal(item.calories);
  if (!Number.isInteger(calories) || calories < 0) {
    errors.calories = "Enter a whole number of 0 or more.";
  }
  const proteinG = parseDecimal(item.proteinG);
  if (!Number.isFinite(proteinG) || proteinG < 0) {
    errors.proteinG = "Enter a number of 0 or more.";
  }
  const fatG = parseDecimal(item.fatG);
  if (!Number.isFinite(fatG) || fatG < 0) {
    errors.fatG = "Enter a number of 0 or more.";
  }
  const carbsG = parseDecimal(item.carbsG);
  if (!Number.isFinite(carbsG) || carbsG < 0) {
    errors.carbsG = "Enter a number of 0 or more.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return {
    errors,
    input: { name, ...(quantityG !== undefined ? { quantityG } : {}), calories, proteinG, fatG, carbsG },
  };
}

export function validateMealForm(
  form: MealFormState,
  options: MealFormValidationOptions = {},
): { errors: MealFormErrors; input?: MealCreateInput } {
  const errors: MealFormErrors = { items: {} };

  const mealType = MEAL_TYPE_OPTIONS.find((option) => option.value === form.mealType)?.value;
  if (!mealType) {
    errors.mealType = "Select a meal type.";
  }

  const eatenAt = localDateTimeToIso(form.date, form.time);
  if (!eatenAt) {
    errors.eatenAt = "Enter a valid date (YYYY-MM-DD) and time (HH:MM).";
  }

  const items: MealItemCreateInput[] = [];
  for (const item of form.items) {
    const result = validateItem(item, options);
    if (result.input) {
      items.push(result.input);
    } else {
      errors.items[item.key] = result.errors;
    }
  }

  if (!mealType || !eatenAt || items.length === 0 || Object.keys(errors.items).length > 0) {
    return { errors };
  }
  return { errors, input: { mealType, eatenAt, items } };
}
