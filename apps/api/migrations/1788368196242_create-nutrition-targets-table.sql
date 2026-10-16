-- Up Migration

CREATE TABLE nutrition_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bmr INTEGER NOT NULL,
  tdee INTEGER NOT NULL,
  calorie_target INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  formula_version VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_targets_bmr_check
    CHECK (bmr > 0),
  CONSTRAINT nutrition_targets_tdee_check
    CHECK (tdee > 0),
  CONSTRAINT nutrition_targets_calorie_target_check
    CHECK (calorie_target > 0),
  CONSTRAINT nutrition_targets_protein_g_check
    CHECK (protein_g > 0),
  CONSTRAINT nutrition_targets_fat_g_check
    CHECK (fat_g > 0),
  CONSTRAINT nutrition_targets_carbs_g_check
    CHECK (carbs_g >= 0)
);

COMMENT ON COLUMN nutrition_targets.formula_version IS
  'Identifies the deterministic calculation formula used, e.g. mifflin-st-jeor-v1';
COMMENT ON COLUMN nutrition_targets.updated_at IS
  'Set to now() on insert. No update trigger yet - application code must set this explicitly on UPDATE until a later milestone adds one.';

-- Down Migration

DROP TABLE nutrition_targets;
