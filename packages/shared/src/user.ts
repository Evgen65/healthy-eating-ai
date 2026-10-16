/** The public shape of an authenticated user - never a password or password hash. */
export interface AuthUser {
  id: string;
  email: string;
}
