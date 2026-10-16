import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { profileBodySchema } from "../schemas/profileSchema.js";
import { createProfile, getProfile, replaceProfile, type ProfileServiceResult } from "../services/profileService.js";

export const profileRouter = Router();

function sendResult(result: ProfileServiceResult, res: Response, successStatus: number): void {
  switch (result.kind) {
    case "success":
      res.status(successStatus).json(result.profile);
      return;
    case "user_not_found":
      // Structurally unreachable in normal operation: requireAuth already
      // guarantees req.user.id names a real, currently-existing user. Kept
      // only as a defensive fallback for the theoretical case of a user row
      // deleted mid-session.
      res.status(404).json({ error: "User not found" });
      return;
    case "profile_not_found":
      res.status(404).json({ error: "Profile not found" });
      return;
    case "profile_exists":
      res.status(409).json({ error: "Profile already exists" });
      return;
  }
}

profileRouter.post("/api/me/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const body = profileBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }

  try {
    const result = await createProfile(req.user!.id, body.data);
    sendResult(result, res, 201);
  } catch (error) {
    next(error);
  }
});

profileRouter.get("/api/me/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getProfile(req.user!.id);
    sendResult(result, res, 200);
  } catch (error) {
    next(error);
  }
});

profileRouter.put("/api/me/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const body = profileBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }

  try {
    const result = await replaceProfile(req.user!.id, body.data);
    sendResult(result, res, 200);
  } catch (error) {
    next(error);
  }
});
