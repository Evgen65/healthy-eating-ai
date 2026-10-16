import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getProfile, saveProfile } from "../../src/api/profileApi";
import { NETWORK_ERROR_MESSAGE } from "../../src/api/messages";
import { ChoiceField } from "../../src/components/ChoiceField";
import { FormMessage } from "../../src/components/FormMessage";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { TextField } from "../../src/components/TextField";
import {
  ACTIVITY_LEVEL_OPTIONS,
  EMPTY_PROFILE_FORM,
  formStateFromProfile,
  GOAL_OPTIONS,
  JOB_TYPE_OPTIONS,
  SEX_OPTIONS,
  validateProfileForm,
  type ProfileFormErrors,
  type ProfileFormState,
} from "../../src/profile/profileForm";

type LoadState = "loading" | "ready" | "load-error";

/**
 * The real Profile, backed by the existing /api/me/profile routes - the same
 * data the Web Profile page reads and writes for the same account.
 */
export default function ProfileScreen() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadErrorText, setLoadErrorText] = useState("");
  const [form, setForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [profileExists, setProfileExists] = useState(false);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Synchronous double-save guard (see app/login.tsx) - one tap, one POST/PUT.
  const saveInFlight = useRef(false);

  const loadProfile = useCallback(async () => {
    setLoadState("loading");
    const result = await getProfile();
    if (result.kind === "found") {
      setForm(formStateFromProfile(result.profile));
      setProfileExists(true);
      setLoadState("ready");
    } else if (result.kind === "not_found") {
      setForm(EMPTY_PROFILE_FORM);
      setProfileExists(false);
      setLoadState("ready");
    } else {
      setLoadErrorText(result.kind === "network_error" ? NETWORK_ERROR_MESSAGE : "Unable to load profile.");
      setLoadState("load-error");
    }
  }, []);

  // Refetched every time the tab is opened (tabs stay mounted), so changes
  // saved from the Web app for the same account show up here too.
  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  function handleChange(field: keyof ProfileFormState, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSave() {
    if (saveInFlight.current) {
      return;
    }

    const { errors: validationErrors, input } = validateProfileForm(form);
    setErrors(validationErrors);
    setSaveMessage(null);
    if (!input) {
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    const result = await saveProfile(input, profileExists);
    saveInFlight.current = false;
    setSaving(false);

    if (result.kind === "success") {
      setForm(formStateFromProfile(result.profile));
      setProfileExists(true);
      setSaveMessage({ type: "success", text: "Profile saved successfully." });
    } else if (result.kind === "invalid") {
      setSaveMessage({ type: "error", text: "Some profile values are invalid. Please check the form." });
    } else if (result.kind === "network_error") {
      setSaveMessage({ type: "error", text: NETWORK_ERROR_MESSAGE });
    } else {
      setSaveMessage({ type: "error", text: "Unable to save profile." });
    }
  }

  if (loadState === "loading") {
    return (
      <ScreenContainer title="Profile" testID="profile-screen">
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text>Loading profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (loadState === "load-error") {
    return (
      <ScreenContainer title="Profile" testID="profile-screen">
        <FormMessage type="error" text={loadErrorText} />
        <PrimaryButton label="Retry" onPress={() => void loadProfile()} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      title="Profile"
      testID="profile-screen"
      subtitle={
        profileExists
          ? "Your personal nutrition profile."
          : "You have not filled in your profile yet. Enter your details below and save."
      }
    >
      <TextField
        label="Age"
        value={form.age}
        onChangeText={(value) => handleChange("age", value)}
        error={errors.age}
        keyboardType="number-pad"
        testID="profile-age"
      />
      <ChoiceField
        label="Sex"
        options={SEX_OPTIONS}
        value={form.sex}
        onChange={(value) => handleChange("sex", value)}
        error={errors.sex}
        testID="profile-sex"
      />
      <TextField
        label="Height (cm)"
        value={form.heightCm}
        onChangeText={(value) => handleChange("heightCm", value)}
        error={errors.heightCm}
        keyboardType="decimal-pad"
        testID="profile-height"
      />
      <TextField
        label="Weight (kg)"
        value={form.weightKg}
        onChangeText={(value) => handleChange("weightKg", value)}
        error={errors.weightKg}
        keyboardType="decimal-pad"
        testID="profile-weight"
      />
      <ChoiceField
        label="Activity level"
        options={ACTIVITY_LEVEL_OPTIONS}
        value={form.activityLevel}
        onChange={(value) => handleChange("activityLevel", value)}
        error={errors.activityLevel}
        testID="profile-activity"
      />
      <ChoiceField
        label="Job type"
        options={JOB_TYPE_OPTIONS}
        value={form.jobType}
        onChange={(value) => handleChange("jobType", value)}
        error={errors.jobType}
        testID="profile-job"
      />
      <TextField
        label="Workouts per week"
        value={form.workoutsPerWeek}
        onChangeText={(value) => handleChange("workoutsPerWeek", value)}
        error={errors.workoutsPerWeek}
        keyboardType="number-pad"
        testID="profile-workouts"
      />
      <ChoiceField
        label="Goal"
        options={GOAL_OPTIONS}
        value={form.goal}
        onChange={(value) => handleChange("goal", value)}
        error={errors.goal}
        testID="profile-goal"
      />

      <PrimaryButton
        label={saving ? "Saving..." : "Save Profile"}
        onPress={() => void handleSave()}
        busy={saving}
        testID="profile-save"
      />
      {saveMessage ? <FormMessage type={saveMessage.type} text={saveMessage.text} testID="profile-message" /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
