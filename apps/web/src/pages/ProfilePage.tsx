import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ActivityLevel, JobType, NutritionGoal, Sex, UserProfile } from "@healthy-eating-ai/shared";
import { createProfile, getProfile, updateProfile, type ProfileFormInput } from "../api/profileApi";
import "./ProfilePage.css";

interface ProfileFormState {
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  jobType: string;
  workoutsPerWeek: string;
  goal: string;
}

const EMPTY_FORM: ProfileFormState = {
  age: "",
  sex: "",
  heightCm: "",
  weightKg: "",
  activityLevel: "",
  jobType: "",
  workoutsPerWeek: "",
  goal: "",
};

const SEX_OPTIONS: Array<[Sex, string]> = [
  ["male", "Male"],
  ["female", "Female"],
];

const ACTIVITY_LEVEL_OPTIONS: Array<[ActivityLevel, string]> = [
  ["sedentary", "Sedentary"],
  ["light", "Lightly active"],
  ["moderate", "Moderately active"],
  ["very_active", "Very active"],
];

const JOB_TYPE_OPTIONS: Array<[JobType, string]> = [
  ["desk", "Desk work"],
  ["mixed", "Mixed activity"],
  ["physical", "Physical work"],
];

const GOAL_OPTIONS: Array<[NutritionGoal, string]> = [
  ["weight_loss", "Weight loss"],
  ["maintain", "Maintain weight"],
  ["muscle_gain", "Muscle gain"],
];

type LoadState = "loading" | "ready" | "load-error";

function formStateFromProfile(profile: UserProfile): ProfileFormState {
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

interface ValidationErrors {
  age?: string;
  sex?: string;
  heightCm?: string;
  weightKg?: string;
  activityLevel?: string;
  jobType?: string;
  workoutsPerWeek?: string;
  goal?: string;
}

function validate(form: ProfileFormState): { errors: ValidationErrors; input?: ProfileFormInput } {
  const errors: ValidationErrors = {};

  const age = Number(form.age);
  if (!form.age.trim() || !Number.isInteger(age) || age <= 0) {
    errors.age = "Enter a whole number greater than 0.";
  }

  const heightCm = Number(form.heightCm);
  if (!form.heightCm.trim() || !Number.isFinite(heightCm) || heightCm <= 0) {
    errors.heightCm = "Enter a number greater than 0.";
  }

  const weightKg = Number(form.weightKg);
  if (!form.weightKg.trim() || !Number.isFinite(weightKg) || weightKg <= 0) {
    errors.weightKg = "Enter a number greater than 0.";
  }

  const workoutsPerWeek = Number(form.workoutsPerWeek);
  if (!form.workoutsPerWeek.trim() || !Number.isInteger(workoutsPerWeek) || workoutsPerWeek < 0) {
    errors.workoutsPerWeek = "Enter a whole number of 0 or more.";
  }

  if (!SEX_OPTIONS.some(([value]) => value === form.sex)) {
    errors.sex = "Select a value.";
  }
  if (!ACTIVITY_LEVEL_OPTIONS.some(([value]) => value === form.activityLevel)) {
    errors.activityLevel = "Select a value.";
  }
  if (!JOB_TYPE_OPTIONS.some(([value]) => value === form.jobType)) {
    errors.jobType = "Select a value.";
  }
  if (!GOAL_OPTIONS.some(([value]) => value === form.goal)) {
    errors.goal = "Select a value.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    errors,
    input: {
      age,
      sex: form.sex as Sex,
      heightCm,
      weightKg,
      activityLevel: form.activityLevel as ActivityLevel,
      jobType: form.jobType as JobType,
      workoutsPerWeek,
      goal: form.goal as NutritionGoal,
    },
  };
}

export function ProfilePage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [profileExists, setProfileExists] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Guards against a duplicate POST/PUT /api/me/profile from two clicks that
  // land before React has re-rendered the disabled button - `saving` state
  // alone lags a tick (see MealsPage.tsx's submitInFlight for the same
  // pattern/reasoning).
  const submitInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void getProfile().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.kind === "found") {
        setForm(formStateFromProfile(result.profile));
        setProfileExists(true);
        setLoadState("ready");
      } else if (result.kind === "not_found") {
        setProfileExists(false);
        setLoadState("ready");
      } else {
        setLoadState("load-error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(field: keyof ProfileFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitInFlight.current) {
      return;
    }

    const { errors: validationErrors, input } = validate(form);
    setErrors(validationErrors);
    setSaveMessage(null);
    if (!input) {
      return;
    }

    submitInFlight.current = true;
    setSaving(true);
    const result = profileExists ? await updateProfile(input) : await createProfile(input);
    submitInFlight.current = false;
    setSaving(false);

    if (result.kind === "success") {
      setForm(formStateFromProfile(result.profile));
      setProfileExists(true);
      setSaveMessage({ type: "success", text: "Profile saved successfully" });
      return;
    }

    if (result.kind === "invalid") {
      setSaveMessage({ type: "error", text: result.message });
      return;
    }

    setSaveMessage({ type: "error", text: "Unable to save profile" });
  }

  if (loadState === "loading") {
    return (
      <section>
        <h1>Profile</h1>
        <p>Loading profile...</p>
      </section>
    );
  }

  if (loadState === "load-error") {
    return (
      <section>
        <h1>Profile</h1>
        <p className="profile-page__message profile-page__message--error" role="alert">
          Unable to load profile
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Profile</h1>
      <p>Your personal nutrition profile.</p>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="profile-form__field">
          <label htmlFor="profile-age">Age</label>
          <input
            id="profile-age"
            type="number"
            value={form.age}
            onChange={(event) => handleChange("age", event.target.value)}
          />
          {errors.age && <p className="profile-form__error">{errors.age}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-sex">Sex</label>
          <select id="profile-sex" value={form.sex} onChange={(event) => handleChange("sex", event.target.value)}>
            <option value="" disabled>
              Select sex
            </option>
            {SEX_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.sex && <p className="profile-form__error">{errors.sex}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-height">Height (cm)</label>
          <input
            id="profile-height"
            type="number"
            value={form.heightCm}
            onChange={(event) => handleChange("heightCm", event.target.value)}
          />
          {errors.heightCm && <p className="profile-form__error">{errors.heightCm}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-weight">Weight (kg)</label>
          <input
            id="profile-weight"
            type="number"
            value={form.weightKg}
            onChange={(event) => handleChange("weightKg", event.target.value)}
          />
          {errors.weightKg && <p className="profile-form__error">{errors.weightKg}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-activity-level">Activity level</label>
          <select
            id="profile-activity-level"
            value={form.activityLevel}
            onChange={(event) => handleChange("activityLevel", event.target.value)}
          >
            <option value="" disabled>
              Select activity level
            </option>
            {ACTIVITY_LEVEL_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.activityLevel && <p className="profile-form__error">{errors.activityLevel}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-job-type">Job type</label>
          <select
            id="profile-job-type"
            value={form.jobType}
            onChange={(event) => handleChange("jobType", event.target.value)}
          >
            <option value="" disabled>
              Select job type
            </option>
            {JOB_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.jobType && <p className="profile-form__error">{errors.jobType}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-workouts">Workouts per week</label>
          <input
            id="profile-workouts"
            type="number"
            value={form.workoutsPerWeek}
            onChange={(event) => handleChange("workoutsPerWeek", event.target.value)}
          />
          {errors.workoutsPerWeek && <p className="profile-form__error">{errors.workoutsPerWeek}</p>}
        </div>

        <div className="profile-form__field">
          <label htmlFor="profile-goal">Goal</label>
          <select id="profile-goal" value={form.goal} onChange={(event) => handleChange("goal", event.target.value)}>
            <option value="" disabled>
              Select goal
            </option>
            {GOAL_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.goal && <p className="profile-form__error">{errors.goal}</p>}
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </button>

        {saveMessage && (
          <p
            className={`profile-page__message profile-page__message--${saveMessage.type}`}
            role={saveMessage.type === "error" ? "alert" : "status"}
          >
            {saveMessage.text}
          </p>
        )}
      </form>
    </section>
  );
}
