-- Up Migration

-- Nullable, not NOT NULL: existing rows created before Milestone 14 (manual
-- development users, the old E2E fixture user) have no password and cannot
-- log in until one is set - registration always sets it for new rows, and
-- the login/register services below never persist a plaintext password,
-- only this bcrypt hash. A NULL password_hash is treated identically to a
-- wrong password at login (401 "Invalid email or password"), never a crash
-- or a different error, so it cannot be used to enumerate which accounts
-- predate authentication.
ALTER TABLE users ADD COLUMN password_hash VARCHAR;

COMMENT ON COLUMN users.password_hash IS
  'bcrypt hash of the user''s password. NULL for pre-Milestone-14 rows created before authentication existed - such a user cannot log in until a password_hash is set (re-register is not possible while the email is already taken; a manual UPDATE is the only backfill path for keeping an existing pre-auth email).';

-- Down Migration

ALTER TABLE users DROP COLUMN password_hash;
