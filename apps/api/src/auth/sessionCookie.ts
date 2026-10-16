import type { Response } from "express";
import { env } from "../config/env.js";

export const SESSION_COOKIE_NAME = "heai_session";

// Matches TOKEN_TTL in jwt.ts - the cookie and the token it carries expire
// together, so an expired cookie is never sent for a token that would fail
// verification anyway.
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `sameSite: "lax"` is enough for this app's actual cross-origin shape (Web
 * on :5173, API on :4000 - different origins, but the same site/registrable
 * domain "localhost"), without needing `sameSite: "none"` + `secure: true`,
 * which would require HTTPS even in local dev. `secure` itself still
 * follows NODE_ENV, so a real deployment over HTTPS gets the stricter
 * cookie automatically.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.nodeEnv === "production",
    path: "/",
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_COOKIE_MAX_AGE_MS });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
}
