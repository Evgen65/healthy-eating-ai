export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth (see auth/authMiddleware.ts) once the request's JWT (Web session cookie or Mobile Bearer header) has been verified. Never trust a userId from req.params/req.body for anything user-scoped - this is the only authoritative source. */
      user?: { id: string };
    }
  }
}
