import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./jwt.js";
import { SESSION_COOKIE_NAME } from "./sessionCookie.js";

/**
 * Picks the one token this request authenticates with, from the two
 * supported transports for the SAME JWT (see jwt.ts):
 *
 *   - `Authorization: Bearer <JWT>` - the native Mobile app (Milestone 17),
 *     which keeps its token in the device's secure storage and has no
 *     browser cookie jar.
 *   - the httpOnly `heai_session` cookie - the Web app (Milestone 14).
 *
 * An explicitly supplied Authorization header is authoritative: if it is
 * present, the cookie is NOT consulted, even when the header's token turns
 * out to be invalid. A request that deliberately presents a Bearer token is
 * judged on that token alone, rather than silently authenticating as
 * whoever a leftover cookie belongs to. The Web app never sends an
 * Authorization header, so its cookie path is unaffected.
 *
 * Returns `null` when no credential was presented at all.
 */
function extractToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string") {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
    // A present-but-malformed header (wrong scheme, empty token) still
    // counts as "a credential was presented" - it yields an empty token,
    // which verifyAuthToken rejects, instead of falling back to the cookie.
    return match ? match[1] : "";
  }

  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof cookieToken === "string" ? cookieToken : null;
}

/**
 * The sole gate between a request and any user-scoped data. Sets
 * `req.user` from the verified JWT - the user id in the URL/body is never
 * trusted for this (see mealRoutes.ts etc., which all read `req.user!.id`).
 * Signature/expiry verification stays centralized in verifyAuthToken no
 * matter which transport (cookie or Bearer) carried the token. Missing,
 * malformed, or expired token all collapse to the same controlled 401 -
 * never a crash, never a hint about which case it was.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const userId = token ? verifyAuthToken(token) : null;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  req.user = { id: userId };
  next();
}
