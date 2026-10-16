import type { AuthUser } from "@healthy-eating-ai/shared";
import { hashPassword, verifyPassword } from "../auth/passwordHasher.js";
import { findUserByEmail, insertUser, toPublicUser } from "../auth/userRepository.js";

export type RegisterResult = { kind: "success"; user: AuthUser } | { kind: "duplicate_email" };

export type LoginResult = { kind: "success"; user: AuthUser } | { kind: "invalid_credentials" };

export async function registerUser(email: string, password: string): Promise<RegisterResult> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return { kind: "duplicate_email" };
  }

  const passwordHash = await hashPassword(password);
  const user = await insertUser(email, passwordHash);
  return { kind: "success", user: toPublicUser(user) };
}

/**
 * Deliberately takes the same path (verifyPassword against a null hash
 * resolves to `false`, never throws) whether the email doesn't exist at all
 * or exists but the password is wrong - both return `invalid_credentials`,
 * so the public API can never be used to enumerate registered emails.
 */
export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const user = await findUserByEmail(email);
  const isValid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !isValid) {
    return { kind: "invalid_credentials" };
  }
  return { kind: "success", user: toPublicUser(user) };
}
