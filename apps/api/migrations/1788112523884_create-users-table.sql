-- Up Migration

-- gen_random_uuid() is built into PostgreSQL 13+; pgcrypto keeps this
-- migration working on older versions too.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON COLUMN users.updated_at IS
  'Set to now() on insert. No update trigger yet - application code must set this explicitly on UPDATE until a later milestone adds one.';

-- Down Migration

DROP TABLE users;
