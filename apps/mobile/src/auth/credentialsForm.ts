/**
 * Client-side pre-checks for the Login/Register forms - a convenience that
 * saves a round trip, never a replacement for the backend's own
 * authSchema.ts validation. Register mirrors that schema (valid email,
 * password of at least 8 characters); Login only requires both fields to be
 * filled in, exactly like the backend's loginBodySchema, so it never hints
 * at what a valid password would look like.
 */
const MIN_PASSWORD_LENGTH = 8;

// Deliberately loose - the backend has the final say on what a valid email is.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CredentialErrors {
  email?: string;
  password?: string;
}

export function validateLoginForm(email: string, password: string): CredentialErrors {
  const errors: CredentialErrors = {};
  if (!email.trim()) {
    errors.email = "Enter your email.";
  }
  if (!password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

export function validateRegisterForm(email: string, password: string): CredentialErrors {
  const errors: CredentialErrors = {};
  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

export function hasErrors(errors: CredentialErrors): boolean {
  return Boolean(errors.email || errors.password);
}
