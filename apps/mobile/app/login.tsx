import { useRef, useState } from "react";
import { useAuth } from "../src/auth/AuthContext";
import { hasErrors, validateLoginForm, type CredentialErrors } from "../src/auth/credentialsForm";
import { FormMessage } from "../src/components/FormMessage";
import { NavLinkButton } from "../src/components/NavLinkButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { TextField } from "../src/components/TextField";

/**
 * On success the auth status flips to "authenticated", which closes this
 * screen's guard and lets app/_layout.tsx + app/index.tsx take the user to
 * Dashboard - no explicit navigation here.
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard: two taps can land before `submitting` re-renders the
  // button as disabled - the ref blocks the second one immediately, so one
  // user action always produces exactly one request.
  const submitInFlight = useRef(false);

  async function handleSubmit() {
    if (submitInFlight.current) {
      return;
    }

    const validationErrors = validateLoginForm(email, password);
    setErrors(validationErrors);
    setMessage(null);
    if (hasErrors(validationErrors)) {
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    const result = await login(email.trim(), password);
    submitInFlight.current = false;
    setSubmitting(false);

    if (result.kind !== "success") {
      setMessage(result.message);
    }
  }

  return (
    <ScreenContainer title="Log in" subtitle="Use the same account as on the Web app." testID="login-screen">
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
        testID="login-email"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        testID="login-password"
        onSubmitEditing={() => void handleSubmit()}
      />
      <PrimaryButton
        label={submitting ? "Logging in..." : "Log in"}
        onPress={() => void handleSubmit()}
        busy={submitting}
        testID="login-submit"
      />
      {message ? <FormMessage type="error" text={message} testID="login-message" /> : null}
      <NavLinkButton href="/register" label="Create an account" variant="secondary" />
    </ScreenContainer>
  );
}
