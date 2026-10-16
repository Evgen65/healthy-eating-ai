import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, type Location } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./AuthPage.css";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a duplicate POST /api/auth/login from two clicks that
  // land before React has re-rendered the disabled button - `submitting`
  // state alone lags a tick (see MealsPage.tsx's submitInFlight for the same
  // pattern/reasoning).
  const submitInFlight = useRef(false);

  // Already authenticated (e.g. navigated here manually) - send them
  // straight to the app rather than showing the form again.
  if (!loading && user) {
    const from = (location.state as { from?: Location } | null)?.from;
    return <Navigate to={from?.pathname ?? "/dashboard"} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitInFlight.current) {
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setError(null);
    const result = await login(email, password);
    submitInFlight.current = false;
    setSubmitting(false);

    if (result.kind !== "success") {
      setError(result.message);
    }
  }

  return (
    <section className="auth-page">
      <h1>Log in</h1>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-form__field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="auth-form__field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Log in"}
        </button>

        {error && (
          <p className="auth-page__message auth-page__message--error" role="alert">
            {error}
          </p>
        )}
      </form>

      <p className="auth-page__switch">
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
