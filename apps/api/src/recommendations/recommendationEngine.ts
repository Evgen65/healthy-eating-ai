import type { NutritionRecommendation, NutritionSummary } from "@healthy-eating-ai/shared";

/**
 * Deterministic v1 recommendation engine (Milestone 10A). Pure function -
 * no Express, no PostgreSQL, no AI/LLM - it only interprets an already
 * calculated NutritionSummary (target/consumed/remaining) into a fixed set
 * of numeric-state observations. It never suggests specific foods and never
 * makes a medical claim; that stays out of scope for this milestone.
 */
export function generateDailyRecommendations(summary: NutritionSummary): NutritionRecommendation[] {
  return [
    ...calorieRecommendations(summary.remaining.calories),
    ...proteinRecommendations(summary.remaining.proteinG),
    ...fatRecommendations(summary.remaining.fatG),
    ...carbsRecommendations(summary.remaining.carbsG),
  ];
}

function calorieRecommendations(remainingCalories: number): NutritionRecommendation[] {
  if (remainingCalories > 0) {
    return [
      {
        code: "CALORIES_REMAINING",
        level: "info",
        message: `You have ${remainingCalories} kcal remaining today.`,
      },
    ];
  }

  if (remainingCalories < 0) {
    return [
      {
        code: "CALORIES_EXCEEDED",
        level: "warning",
        message: `You have exceeded today's calorie target by ${Math.abs(remainingCalories)} kcal.`,
      },
    ];
  }

  return [
    {
      code: "CALORIES_TARGET_REACHED",
      level: "info",
      message: "You have reached today's calorie target.",
    },
  ];
}

function proteinRecommendations(remainingProteinG: number): NutritionRecommendation[] {
  if (remainingProteinG > 0) {
    return [
      {
        code: "PROTEIN_REMAINING",
        level: "info",
        message: `You still need about ${remainingProteinG} g of protein today.`,
      },
    ];
  }

  // <= 0 - the target is met or exceeded. Never phrase this as a negative
  // amount still to consume.
  return [
    {
      code: "PROTEIN_TARGET_MET",
      level: "info",
      message: "You have met today's protein target.",
    },
  ];
}

function fatRecommendations(remainingFatG: number): NutritionRecommendation[] {
  if (remainingFatG > 0) {
    return [
      {
        code: "FAT_REMAINING",
        level: "info",
        message: `You have ${remainingFatG} g of fat remaining today.`,
      },
    ];
  }

  return [
    {
      code: "FAT_TARGET_MET",
      level: "info",
      message: "You have reached or exceeded today's fat target.",
    },
  ];
}

function carbsRecommendations(remainingCarbsG: number): NutritionRecommendation[] {
  if (remainingCarbsG > 0) {
    return [
      {
        code: "CARBS_REMAINING",
        level: "info",
        message: `You have ${remainingCarbsG} g of carbohydrates remaining today.`,
      },
    ];
  }

  return [
    {
      code: "CARBS_TARGET_MET",
      level: "info",
      message: "You have reached or exceeded today's carbohydrate target.",
    },
  ];
}
