export type Sex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";

export type JobType = "desk" | "mixed" | "physical";

export type NutritionGoal = "weight_loss" | "maintain" | "muscle_gain";

export interface UserProfile {
  id: string;
  userId: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  jobType: JobType;
  workoutsPerWeek: number;
  goal: NutritionGoal;
  createdAt: string;
  updatedAt: string;
}
