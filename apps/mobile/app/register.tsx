import { useRef, useState } from "react";
import { useAuth } from "../src/auth/AuthContext";
import { hasErrors, validateRegisterForm, type CredentialErrors } from "../src/auth/credentialsForm";
import { FormMessage } from "../src/components/FormMessage";
import { NavLinkButton } from "../src/components/NavLinkButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { TextField } from "../src/components/TextField";

/**
 * Creates the same kind of account as Web registration (same backend users
 * table and password hashing) and logs the user straight in - on success
 * the auth guards take the user to Dashboard (see login.tsx).
 */
export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // See login.tsx - blocks a second submit before React re-renders.
  const submitInFlight = useRef(false);

  async function handleSubmit() {
    if (submitInFlight.current) {
      return;
    }

    const validationErrors = validateRegisterForm(email, password);
    setErrors(validationErrors);
    setMessage(null);
    if (hasErrors(validationErrors)) {
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    const result = await register(email.trim(), password);
    submitInFlight.current = false;
    setSubmitting(false);

    if (result.kind !== "success") {
      setMessage(result.message);
    }
  }

  return (
    <ScreenContainer title="Create account" subtitle="This account also works on the Web app.">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void handleSubmit()}
      />
      <PrimaryButton
        label={submitting ? "Creating account..." : "Create account"}
        onPress={() => void handleSubmit()}
        busy={submitting}
      />
      {message ? <FormMessage type="error" text={message} /> : null}
      <NavLinkButton href="/login" label="I already have an account" variant="secondary" />
    </ScreenContainer>
  );
}
