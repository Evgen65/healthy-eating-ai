export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealItem {
  id: string;
  name: string;
  quantityG: number | null;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface Meal {
  id: string;
  userId: string;
  mealType: MealType;
  eatenAt: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  createdAt: string;
  updatedAt: string;
}

export interface MealWithItems extends Meal {
  items: MealItem[];
}
