import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Gate for every user-scoped page (Dashboard, Meals, History,
 * Recommendations, Plan, Shopping, Profile - see App.tsx). Renders nothing
 * but a loading placeholder until the initial session-restore check
 * resolves, so an authenticated user with a valid cookie is never
 * flash-redirected to /login before GET /api/auth/me has had a chance to
 * answer.
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="auth-loading">Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
