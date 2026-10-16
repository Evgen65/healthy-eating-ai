import type { UserProfile } from "@healthy-eating-ai/shared";
import { findProfileByUserId, insertProfile, updateProfile } from "../repositories/profileRepository.js";
import { userExists } from "../repositories/userRepository.js";
import type { ProfileInput } from "../schemas/profileSchema.js";

export type ProfileServiceResult =
  | { kind: "success"; profile: UserProfile }
  | { kind: "user_not_found" }
  | { kind: "profile_not_found" }
  | { kind: "profile_exists" };

// PostgreSQL unique_violation. Catching this closes a TOCTOU race between
// the existence check and the insert (e.g. two concurrent POSTs).
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function createProfile(userId: string, input: ProfileInput): Promise<ProfileServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }
  if (await findProfileByUserId(userId)) {
    return { kind: "profile_exists" };
  }

  try {
    const profile = await insertProfile(userId, input);
    return { kind: "success", profile };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { kind: "profile_exists" };
    }
    throw error;
  }
}

export async function getProfile(userId: string): Promise<ProfileServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }

  const profile = await findProfileByUserId(userId);
  if (!profile) {
    return { kind: "profile_not_found" };
  }

  return { kind: "success", profile };
}

export async function replaceProfile(userId: string, input: ProfileInput): Promise<ProfileServiceResult> {
  if (!(await userExists(userId))) {
    return { kind: "user_not_found" };
  }
  if (!(await findProfileByUserId(userId))) {
    return { kind: "profile_not_found" };
  }

  const profile = await updateProfile(userId, input);
  return { kind: "success", profile };
}
