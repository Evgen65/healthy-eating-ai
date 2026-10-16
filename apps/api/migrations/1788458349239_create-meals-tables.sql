-- Up Migration

CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_type VARCHAR NOT NULL,
  eaten_at TIMESTAMP NOT NULL,
  calories INTEGER NOT NULL,
  protein_g NUMERIC NOT NULL,
  fat_g NUMERIC NOT NULL,
  carbs_g NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT meals_meal_type_check
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  CONSTRAINT meals_calories_check
    CHECK (calories >= 0),
  CONSTRAINT meals_protein_g_check
    CHECK (protein_g >= 0),
  CONSTRAINT meals_fat_g_check
    CHECK (fat_g >= 0),
  CONSTRAINT meals_carbs_g_check
    CHECK (carbs_g >= 0)
);

CREATE TABLE meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  quantity_g NUMERIC,
  calories INTEGER NOT NULL,
  protein_g NUMERIC NOT NULL,
  fat_g NUMERIC NOT NULL,
  carbs_g NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT meal_items_name_check
    CHECK (btrim(name) <> ''),
  CONSTRAINT meal_items_quantity_g_check
    CHECK (quantity_g IS NULL OR quantity_g > 0),
  CONSTRAINT meal_items_calories_check
    CHECK (calories >= 0),
  CONSTRAINT meal_items_protein_g_check
    CHECK (protein_g >= 0),
  CONSTRAINT meal_items_fat_g_check
    CHECK (fat_g >= 0),
  CONSTRAINT meal_items_carbs_g_check
    CHECK (carbs_g >= 0)
);

-- Supports "list meals for a user, most recent first" (GET /api/users/:userId/meals).
CREATE INDEX meals_user_id_eaten_at_idx ON meals (user_id, eaten_at DESC);

-- Supports fetching/replacing all items belonging to a meal.
CREATE INDEX meal_items_meal_id_idx ON meal_items (meal_id);

COMMENT ON COLUMN meals.meal_type IS
  'Allowed values: breakfast, lunch, dinner, snack';
COMMENT ON COLUMN meals.eaten_at IS
  'When the user ate the meal - distinct from created_at, which is when the record was saved.';
COMMENT ON COLUMN meals.calories IS
  'Backend-calculated sum of this meal''s items. Never trust totals supplied by the client.';
COMMENT ON COLUMN meals.updated_at IS
  'Set to now() on insert. No update trigger yet - application code must set this explicitly on UPDATE until a later milestone adds one.';
COMMENT ON COLUMN meal_items.quantity_g IS
  'Optional - not every item source (e.g. AI recognition) will supply a gram quantity.';

-- Down Migration

DROP TABLE meal_items;
DROP TABLE meals;
