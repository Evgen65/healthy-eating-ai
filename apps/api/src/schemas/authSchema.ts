import { z } from "zod";

// 8 is a reasonable minimum for a learning-project auth flow - long enough
// to rule out trivially short passwords, without imposing a composition
// policy (uppercase/digit/symbol rules) this milestone doesn't ask for.
const MIN_PASSWORD_LENGTH = 8;

export const registerBodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(MIN_PASSWORD_LENGTH),
  })
  .strict();

// Deliberately just "non-empty", not the same min-length rule as
// registration - a login attempt's password is being checked against a
// stored hash, not created, so rejecting a short one before even trying
// would leak that "this password is too short to ever be valid" instead of
// the uniform "Invalid email or password".
export const loginBodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
