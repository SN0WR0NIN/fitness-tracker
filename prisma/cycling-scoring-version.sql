-- Apply only with approved feature release, before starting new application code.
-- Existing and historical-import records retain version 1; no scores are recalculated.
ALTER TABLE public."Activity" ADD COLUMN IF NOT EXISTS "cycleScoringVersion" integer NOT NULL DEFAULT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='activity_cycle_scoring_version') THEN
    ALTER TABLE public."Activity" ADD CONSTRAINT activity_cycle_scoring_version CHECK ("cycleScoringVersion" IN (1,2));
  END IF;
END $$;
ALTER TABLE public."Activity" DROP CONSTRAINT IF EXISTS activity_total_points_override_half_step;
ALTER TABLE public."Activity" ADD CONSTRAINT activity_total_points_override_half_step CHECK (
  "totalPointsOverride" IS NULL OR
  abs("totalPointsOverride" * CASE WHEN category='CYCLE' AND "cycleScoringVersion"=2 THEN 10 ELSE 2 END
    - round("totalPointsOverride" * CASE WHEN category='CYCLE' AND "cycleScoringVersion"=2 THEN 10 ELSE 2 END)) < 0.0000001
);
