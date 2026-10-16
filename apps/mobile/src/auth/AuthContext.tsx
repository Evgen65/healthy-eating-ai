import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@healthy-eating-ai/shared";
import { onUnauthorized } from "../api/httpClient";
import {
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  type AuthFailure,
  type AuthResult,
} from "./authApi";
import { getToken, removeToken, setToken } from "./tokenStorage";

/**
 * - "restoring": startup check of a stored token is in flight - nothing
 *   (neither Login nor protected screens) should render yet.
 * - "unavailable": a token IS stored, but the server could not be reached
 *   (or answered 5xx) to confirm it. The token is kept; the user can retry.
 * - "authenticated" / "unauthenticated": settled.
 */
export type AuthStatus = "restoring" | "unavailable" | "authenticated" | "unauthenticated";

export type AuthActionResult = { kind: "success" } | AuthFailure;

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (email: string, password: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The single mobile auth layer (mirrors apps/web/src/auth/AuthContext.tsx's
 * role): screens only ever call login/register/logout from here, never
 * authApi.ts or tokenStorage.ts directly. The route guards in app/_layout.tsx
 * are driven purely by `status` - they are UX only; the backend's
 * requireAuth remains the authority on every request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<AuthUser | null>(null);

  const becomeUnauthenticated = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const restoreSession = useCallback(async () => {
    setStatus("restoring");

    const token = await getToken();
    if (!token) {
      becomeUnauthenticated();
      return;
    }

    const result = await getCurrentUser();
    if (result.kind === "success") {
      setUser(result.user);
      setStatus("authenticated");
    } else if (result.kind === "unauthorized") {
      // Invalid/expired token (httpClient has already deleted it on the 401).
      becomeUnauthenticated();
    } else {
      // Network outage / 5xx: the token may well still be valid - keep it.
      setStatus("unavailable");
    }
  }, [becomeUnauthenticated]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Any authenticated request anywhere that gets a 401 has already had its
  // token removed by httpClient - reflect that here so the guards send the
  // user back to Login.
  useEffect(() => onUnauthorized(becomeUnauthenticated), [becomeUnauthenticated]);

  const completeAuthentication = useCallback(async (result: AuthResult): Promise<AuthActionResult> => {
    if (result.kind !== "success") {
      return result;
    }
    try {
      await setToken(result.token);
    } catch {
      return { kind: "error", message: "Unable to save your session securely on this device." };
    }
    setUser(result.user);
    setStatus("authenticated");
    return { kind: "success" };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => completeAuthentication(await loginRequest(email, password)),
    [completeAuthentication],
  );

  const register = useCallback(
    async (email: string, password: string) => completeAuthentication(await registerRequest(email, password)),
    [completeAuthentication],
  );

  /**
   * The JWT is stateless and the mobile app has no cookie for the server to
   * clear, so logging out is purely local: delete the stored token (so no
   * later request can carry it) and drop the in-memory user.
   */
  const logout = useCallback(async () => {
    await removeToken();
    becomeUnauthenticated();
  }, [becomeUnauthenticated]);

  const value = useMemo(
    () => ({ status, user, login, register, logout, restoreSession }),
    [status, user, login, register, logout, restoreSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
