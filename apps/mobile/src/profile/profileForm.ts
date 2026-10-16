import type { ActivityLevel, JobType, NutritionGoal, Sex, UserProfile } from "@healthy-eating-ai/shared";
import type { ProfileInput } from "../api/profileApi";
import { parseDecimal } from "../utils/number";

/**
 * Profile form state + validation, kept out of the screen component. Rules
 * and option labels match apps/web/src/pages/ProfilePage.tsx and the
 * backend's profileBodySchema, so both clients accept exactly the same data.
 */
export interface ProfileFormState {
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  jobType: string;
  workoutsPerWeek: string;
  goal: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormState, string>>;

export type Option<T extends string> = { value: T; label: string };

export const EMPTY_PROFILE_FORM: ProfileFormState = {
  age: "",
  sex: "",
  heightCm: "",
  weightKg: "",
  activityLevel: "",
  jobType: "",
  workoutsPerWeek: "",
  goal: "",
};

export const SEX_OPTIONS: Option<Sex>[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const ACTIVITY_LEVEL_OPTIONS: Option<ActivityLevel>[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Moderately active" },
  { value: "very_active", label: "Very active" },
];

export const JOB_TYPE_OPTIONS: Option<JobType>[] = [
  { value: "desk", label: "Desk work" },
  { value: "mixed", label: "Mixed activity" },
  { value: "physical", label: "Physical work" },
];

export const GOAL_OPTIONS: Option<NutritionGoal>[] = [
  { value: "weight_loss", label: "Weight loss" },
  { value: "maintain", label: "Maintain weight" },
  { value: "muscle_gain", label: "Muscle gain" },
];

export function formStateFromProfile(profile: UserProfile): ProfileFormState {
  return {
    age: String(profile.age),
    sex: profile.sex,
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    activityLevel: profile.activityLevel,
    jobType: profile.jobType,
    workoutsPerWeek: String(profile.workoutsPerWeek),
    goal: profile.goal,
  };
}

function isOption<T extends string>(options: Option<T>[], value: string): value is T {
  return options.some((option) => option.value === value);
}

export function validateProfileForm(form: ProfileFormState): { errors: ProfileFormErrors; input?: ProfileInput } {
  const errors: ProfileFormErrors = {};

  const age = parseDecimal(form.age);
  if (!Number.isInteger(age) || age <= 0) {
    errors.age = "Enter a whole number greater than 0.";
  }
  const heightCm = parseDecimal(form.heightCm);
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    errors.heightCm = "Enter a number greater than 0.";
  }
  const weightKg = parseDecimal(form.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    errors.weightKg = "Enter a number greater than 0.";
  }
  const workoutsPerWeek = parseDecimal(form.workoutsPerWeek);
  if (!Number.isInteger(workoutsPerWeek) || workoutsPerWeek < 0) {
    errors.workoutsPerWeek = "Enter a whole number of 0 or more.";
  }

  const sex = isOption(SEX_OPTIONS, form.sex) ? form.sex : null;
  if (!sex) {
    errors.sex = "Select a value.";
  }
  const activityLevel = isOption(ACTIVITY_LEVEL_OPTIONS, form.activityLevel) ? form.activityLevel : null;
  if (!activityLevel) {
    errors.activityLevel = "Select a value.";
  }
  const jobType = isOption(JOB_TYPE_OPTIONS, form.jobType) ? form.jobType : null;
  if (!jobType) {
    errors.jobType = "Select a value.";
  }
  const goal = isOption(GOAL_OPTIONS, form.goal) ? form.goal : null;
  if (!goal) {
    errors.goal = "Select a value.";
  }

  if (Object.keys(errors).length > 0 || !sex || !activityLevel || !jobType || !goal) {
    return { errors };
  }

  return {
    errors,
    input: { age, sex, heightCm, weightKg, activityLevel, jobType, workoutsPerWeek, goal },
  };
}
