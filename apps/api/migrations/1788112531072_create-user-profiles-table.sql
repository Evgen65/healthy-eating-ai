-- Up Migration

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age SMALLINT,
  sex VARCHAR,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  activity_level VARCHAR,
  job_type VARCHAR,
  workouts_per_week SMALLINT,
  goal VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_age_check
    CHECK (age IS NULL OR age > 0),
  CONSTRAINT user_profiles_height_cm_check
    CHECK (height_cm IS NULL OR height_cm > 0),
  CONSTRAINT user_profiles_weight_kg_check
    CHECK (weight_kg IS NULL OR weight_kg > 0),
  CONSTRAINT user_profiles_workouts_per_week_check
    CHECK (workouts_per_week IS NULL OR workouts_per_week >= 0),
  CONSTRAINT user_profiles_sex_check
    CHECK (sex IS NULL OR sex IN ('male', 'female')),
  CONSTRAINT user_profiles_activity_level_check
    CHECK (activity_level IS NULL OR activity_level IN ('sedentary', 'light', 'moderate', 'very_active')),
  CONSTRAINT user_profiles_job_type_check
    CHECK (job_type IS NULL OR job_type IN ('desk', 'mixed', 'physical')),
  CONSTRAINT user_profiles_goal_check
    CHECK (goal IS NULL OR goal IN ('weight_loss', 'maintain', 'muscle_gain'))
);

COMMENT ON COLUMN user_profiles.sex IS
  'Allowed values: male, female';
COMMENT ON COLUMN user_profiles.activity_level IS
  'Allowed values: sedentary, light, moderate, very_active';
COMMENT ON COLUMN user_profiles.job_type IS
  'Allowed values: desk (desk-based work), mixed (partly active work), physical (physically demanding work)';
COMMENT ON COLUMN user_profiles.goal IS
  'Allowed values: weight_loss, maintain, muscle_gain';
COMMENT ON COLUMN user_profiles.updated_at IS
  'Set to now() on insert. No update trigger yet - application code must set this explicitly on UPDATE until a later milestone adds one.';

-- Down Migration

DROP TABLE user_profiles;
