import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthUser } from "@healthy-eating-ai/shared";
import { UNAUTHORIZED_EVENT } from "../api/httpClient";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type LoginResult,
  type RegisterResult,
} from "./authApi";

interface AuthContextValue {
  user: AuthUser | null;
  /** `true` only while the initial GET /api/auth/me (session restore) is in flight - never true again afterward, so a page can tell "we don't know yet" apart from "we checked, and you're logged out". */
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The single reusable auth layer the rest of the app depends on (see
 * ProtectedRoute.tsx, LoginPage.tsx, RegisterPage.tsx, Header.tsx) - no page
 * talks to authApi.ts or the session cookie directly. Restores the session
 * once on mount via GET /api/auth/me (the httpOnly cookie, if any, is sent
 * automatically) and clears its user state whenever apiFetch reports a 401
 * from any protected endpoint, so an expired/revoked session is reflected
 * everywhere without every page polling for it.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards against a slow initial session-restore resolving AFTER an
  // explicit login()/register() already set the user - without this, a
  // network-connection-refused (or just slow) GET /api/auth/me that started
  // before the user finished typing their credentials could resolve to
  // `null` after login's own (faster, since it's the one that just
  // succeeded) response and stomp the freshly-set user back to logged out.
  const explicitAuthRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then((currentUser) => {
      if (cancelled) {
        return;
      }
      if (!explicitAuthRef.current) {
        setUser(currentUser);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    if (result.kind === "success") {
      explicitAuthRef.current = true;
      setUser(result.user);
    }
    return result;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await registerRequest(email, password);
    if (result.kind === "success") {
      explicitAuthRef.current = true;
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    explicitAuthRef.current = true;
    await logoutRequest();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
