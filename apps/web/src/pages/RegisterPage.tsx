import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./AuthPage.css";

const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a duplicate POST /api/auth/register from two clicks that
  // land before React has re-rendered the disabled button - `submitting`
  // state alone lags a tick (see MealsPage.tsx's submitInFlight for the same
  // pattern/reasoning).
  const submitInFlight = useRef(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitInFlight.current) {
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setError(null);
    const result = await register(email, password);
    submitInFlight.current = false;
    setSubmitting(false);

    if (result.kind !== "success") {
      setError(result.message);
    }
  }

  return (
    <section className="auth-page">
      <h1>Register</h1>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-form__field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-form__field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Register"}
        </button>

        {error && (
          <p className="auth-page__message auth-page__message--error" role="alert">
            {error}
          </p>
        )}
      </form>

      <p className="auth-page__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
