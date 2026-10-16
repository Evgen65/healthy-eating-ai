import type { MealType, PlannedIngredient, PlannedMeal, PlannedNutrition, WeeklyMealPlan, WeeklyPlanDay } from "@healthy-eating-ai/shared";
import { MEAL_CALORIE_ALLOCATION, MEAL_TYPE_ORDER, RECIPE_CATALOG, type RecipeTemplate } from "./weeklyPlanCatalog.js";

export const WEEKLY_PLAN_VERSION = "deterministic-v1";

export const WEEKLY_PLAN_NOTICE =
  "Generic meal plan template; does not account for allergies or medical dietary needs.";

const DAY_COUNT = 7;

/**
 * Calendar-safe day offset - builds the target date from its own UTC
 * year/month/day components (like dayRangeCalculator.ts) instead of adding
 * 24h*offset in milliseconds, so month/year rollovers and DST-adjacent
 * shifts never occur.
 */
function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function getUtcWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Splits totalCalories across the four meal slots using the stable
 * MEAL_CALORIE_ALLOCATION percentages, then distributes the rounding
 * remainder (largest-remainder method, ties broken by MEAL_TYPE_ORDER) so
 * the four integer slot allocations always sum back to exactly
 * totalCalories. This keeps daily rounding drift out of the calorie
 * allocation step entirely - the only remaining source of drift is the
 * per-meal Math.round in scaleNutrition below.
 */
function allocateSlotCalories(totalCalories: number): Record<MealType, number> {
  const exact = MEAL_TYPE_ORDER.map((mealType) => ({
    mealType,
    exact: totalCalories * MEAL_CALORIE_ALLOCATION[mealType],
  }));
  const floored = exact.map((entry) => ({ ...entry, floor: Math.floor(entry.exact) }));
  const flooredSum = floored.reduce((sum, entry) => sum + entry.floor, 0);
  let remainder = Math.round(totalCalories - flooredSum);

  const byRemainderDesc = [...floored].sort((a, b) => b.exact - b.floor - (a.exact - a.floor));

  const allocation = {} as Record<MealType, number>;
  for (const entry of floored) {
    allocation[entry.mealType] = entry.floor;
  }
  for (const entry of byRemainderDesc) {
    if (remainder <= 0) {
      break;
    }
    allocation[entry.mealType] += 1;
    remainder -= 1;
  }
  return allocation;
}

function pickRecipeTemplate(mealType: MealType, weekday: number): RecipeTemplate {
  const templates = RECIPE_CATALOG[mealType];
  return templates[weekday % templates.length];
}

function scaleIngredients(baseIngredients: PlannedIngredient[], scaleFactor: number): PlannedIngredient[] {
  return baseIngredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: Math.max(1, Math.round(ingredient.quantity * scaleFactor)),
    unit: ingredient.unit,
  }));
}

function scaleNutrition(baseNutrition: PlannedNutrition, scaleFactor: number): PlannedNutrition {
  return {
    calories: Math.max(0, Math.round(baseNutrition.calories * scaleFactor)),
    proteinG: Math.max(0, Math.round(baseNutrition.proteinG * scaleFactor)),
    fatG: Math.max(0, Math.round(baseNutrition.fatG * scaleFactor)),
    carbsG: Math.max(0, Math.round(baseNutrition.carbsG * scaleFactor)),
  };
}

function buildPlannedMeal(mealType: MealType, weekday: number, slotCalories: number): PlannedMeal {
  const template = pickRecipeTemplate(mealType, weekday);
  const scaleFactor = slotCalories / template.baseNutrition.calories;

  return {
    mealType,
    recipeId: template.id,
    title: template.title,
    ingredients: scaleIngredients(template.baseIngredients, scaleFactor),
    plannedNutrition: scaleNutrition(template.baseNutrition, scaleFactor),
  };
}

function sumNutrition(values: PlannedNutrition[]): PlannedNutrition {
  return values.reduce(
    (totals, value) => ({
      calories: totals.calories + value.calories,
      proteinG: totals.proteinG + value.proteinG,
      fatG: totals.fatG + value.fatG,
      carbsG: totals.carbsG + value.carbsG,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  );
}

function subtractNutrition(a: PlannedNutrition, b: PlannedNutrition): PlannedNutrition {
  return {
    calories: a.calories - b.calories,
    proteinG: a.proteinG - b.proteinG,
    fatG: a.fatG - b.fatG,
    carbsG: a.carbsG - b.carbsG,
  };
}

/**
 * Recipe choice per date depends only on that date's UTC weekday (e.g.
 * Monday breakfast always resolves to the same breakfast template), not on
 * the requested startDate or request time - so overlapping weekly requests
 * always agree on the plan for any calendar date they share, and repeating
 * the same request always returns identical data.
 */
function buildDay(date: string, dailyTarget: PlannedNutrition, slotCalories: Record<MealType, number>): WeeklyPlanDay {
  const weekday = getUtcWeekday(date);
  const meals = MEAL_TYPE_ORDER.map((mealType) => buildPlannedMeal(mealType, weekday, slotCalories[mealType]));
  const plannedTotals = sumNutrition(meals.map((meal) => meal.plannedNutrition));

  return {
    date,
    meals,
    plannedTotals,
    differenceFromTarget: subtractNutrition(plannedTotals, dailyTarget),
  };
}

/**
 * Pure deterministic weekly plan generator (Milestone 11A) - no Express, no
 * PostgreSQL, no AI/LLM. The same (startDate, dailyTarget) pair always
 * produces the same plan.
 */
export function generateWeeklyPlan(startDate: string, dailyTarget: PlannedNutrition): WeeklyMealPlan {
  const slotCalories = allocateSlotCalories(dailyTarget.calories);

  const days: WeeklyPlanDay[] = [];
  for (let offset = 0; offset < DAY_COUNT; offset += 1) {
    days.push(buildDay(addUtcDays(startDate, offset), dailyTarget, slotCalories));
  }

  return {
    startDate,
    endDate: addUtcDays(startDate, DAY_COUNT - 1),
    planVersion: WEEKLY_PLAN_VERSION,
    dailyTarget,
    days,
    notice: WEEKLY_PLAN_NOTICE,
  };
}
