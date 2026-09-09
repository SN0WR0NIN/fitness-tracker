-- Persistent admin-only score overrides.
-- Apply only after the feature release is approved. Existing scores are untouched.
ALTER TABLE public."Activity"
  ADD COLUMN IF NOT EXISTS "basePointsOverride" double precision,
  ADD COLUMN IF NOT EXISTS "totalPointsOverride" double precision;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='activity_base_points_override_nonnegative'
  ) THEN
    ALTER TABLE public."Activity"
      ADD CONSTRAINT activity_base_points_override_nonnegative
      CHECK ("basePointsOverride" IS NULL OR "basePointsOverride" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='activity_total_points_override_nonnegative'
  ) THEN
    ALTER TABLE public."Activity"
      ADD CONSTRAINT activity_total_points_override_nonnegative
      CHECK ("totalPointsOverride" IS NULL OR "totalPointsOverride" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='activity_total_points_override_half_step'
  ) THEN
    ALTER TABLE public."Activity"
      ADD CONSTRAINT activity_total_points_override_half_step
      CHECK ("totalPointsOverride" IS NULL OR abs(("totalPointsOverride" * 2) - round("totalPointsOverride" * 2)) < 0.0000001);
  END IF;
END $$;
