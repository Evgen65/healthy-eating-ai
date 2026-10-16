import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Matches SESSION_COOKIE_MAX_AGE_MS in sessionCookie.ts - the cookie and the
// token it carries expire together.
const TOKEN_TTL = "7d";

interface AuthTokenPayload {
  sub: string;
}

/** Signs a session token carrying only the user id - never the password/hash, never anything else sensitive. */
export function signAuthToken(userId: string): string {
  const payload: AuthTokenPayload = { sub: userId };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

/** Verifies signature and expiration. Returns the user id, or null for anything invalid/expired/malformed - callers must treat null as "not authenticated", never throw it up as a 500. */
export function verifyAuthToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === "object" && decoded !== null && typeof decoded.sub === "string") {
      return decoded.sub;
    }
    return null;
  } catch {
    return null;
  }
}
