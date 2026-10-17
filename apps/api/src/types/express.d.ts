import type { Logger } from "../logging/logger.js";

export {};

declare global {
  namespace Express {
    interface Request {
      /** Server-generated correlation id (see logging/requestLogging.ts). For log correlation only - never authentication or authorization data. */
      requestId: string;
      /** Logger bound to this request's requestId. */
      log: Logger;
      /** Set by requireAuth (see auth/authMiddleware.ts) once the request's JWT (Web session cookie or Mobile Bearer header) has been verified. Never trust a userId from req.params/req.body for anything user-scoped - this is the only authoritative source. */
      user?: { id: string };
    }
  }
}
