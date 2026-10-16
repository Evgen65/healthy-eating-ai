import bcrypt from "bcryptjs";

// 12 is bcryptjs's own documented reasonable default cost for new code in
// 2026 - high enough to be slow for an attacker, low enough not to
// noticeably slow down register/login in this app.
const SALT_ROUNDS = 12;

/** Hashes a plaintext password with a fresh random salt. Never call this with anything that should stay reversible - bcrypt is one-way by design. */
export function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

/** Verifies a plaintext password against a stored bcrypt hash. `false` for a null hash (a pre-Milestone-14 row with no password set yet) rather than throwing. */
export function verifyPassword(plainTextPassword: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) {
    return Promise.resolve(false);
  }
  return bcrypt.compare(plainTextPassword, passwordHash);
}
