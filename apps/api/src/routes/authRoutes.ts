import { Router, type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@healthy-eating-ai/shared";
import { requireAuth } from "../auth/authMiddleware.js";
import { signAuthToken } from "../auth/jwt.js";
import { clearSessionCookie, setSessionCookie } from "../auth/sessionCookie.js";
import { findUserById, toPublicUser } from "../auth/userRepository.js";
import { loginBodySchema, registerBodySchema } from "../schemas/authSchema.js";
import { loginUser, registerUser } from "../services/authService.js";

export const authRouter = Router();

/**
 * How a successful register/login hands the freshly signed JWT to the
 * client - the ONLY thing that differs between the Web and Mobile auth
 * endpoints below. Validation, password hashing/verification (authService)
 * and token signing (signAuthToken) are shared, so both clients always get
 * the same kind of user and the same kind of token.
 */
type SessionIssuer = (res: Response, status: number, user: AuthUser, token: string) => void;

/** Web (Milestone 14): token goes into the httpOnly cookie, never into the response body - JavaScript on the page can never read it. */
const issueWebSession: SessionIssuer = (res, status, user, token) => {
  setSessionCookie(res, token);
  res.status(status).json(user);
};

/**
 * Mobile (Milestone 17): a native app has no browser cookie jar, so the
 * token is returned in the body for the app to keep in the device's secure
 * storage and send back as `Authorization: Bearer <token>`. No cookie is
 * set - these endpoints never touch the Web session.
 */
const issueMobileSession: SessionIssuer = (res, status, user, token) => {
  res.status(status).json({ user, token });
};

function registerHandler(issueSession: SessionIssuer) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const body = registerBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    try {
      const result = await registerUser(body.data.email, body.data.password);
      if (result.kind === "duplicate_email") {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }

      // Registration logs the user in immediately (one consistent behavior,
      // rather than requiring a separate login call right after).
      issueSession(res, 201, result.user, signAuthToken(result.user.id));
    } catch (error) {
      next(error);
    }
  };
}

function loginHandler(issueSession: SessionIssuer) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const body = loginBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    try {
      const result = await loginUser(body.data.email, body.data.password);
      if (result.kind === "invalid_credentials") {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      issueSession(res, 200, result.user, signAuthToken(result.user.id));
    } catch (error) {
      next(error);
    }
  };
}

authRouter.post("/api/auth/register", registerHandler(issueWebSession));
authRouter.post("/api/auth/login", loginHandler(issueWebSession));

authRouter.post("/api/auth/mobile/register", registerHandler(issueMobileSession));
authRouter.post("/api/auth/mobile/login", loginHandler(issueMobileSession));

authRouter.post("/api/auth/logout", (_req: Request, res: Response) => {
  // Stateless JWT: there is no server-side session record to invalidate.
  // Clearing the httpOnly cookie is sufficient for the normal (browser)
  // client, which can no longer present a token afterward - see the
  // Known limitations note in the milestone report for what this does not
  // cover (a token captured and replayed outside the cookie). The Mobile
  // app logs out by deleting its own stored token (it has no cookie).
  clearSessionCookie(res);
  res.status(200).json({});
});

authRouter.get("/api/auth/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.user.id came from a verified token, but the row itself could in
    // principle have been removed since - re-checking here means a
    // dangling token still gets a clean 401 instead of a false 200.
    const user = await findUserById(req.user!.id);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.status(200).json(toPublicUser(user));
  } catch (error) {
    next(error);
  }
});
