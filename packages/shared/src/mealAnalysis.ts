/**
 * `estimatedQuantityG` (not `quantityG`) - this is an AI-style estimate of
 * portion size, not a measured value. The same caveat applies to the
 * calories/macros on each item and to `totals`.
 */
export interface MealAnalysisItem {
  name: string;
  estimatedQuantityG: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealAnalysisTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealAnalysisResult {
  provider: string;
  analysisVersion: string;
  items: MealAnalysisItem[];
  totals: MealAnalysisTotals;
}
