-- Preserve the pace-band inputs used to score interval runs. Existing steady
-- runs remain NULL and are not recalculated by this additive migration.
ALTER TABLE public."Activity"
  ADD COLUMN IF NOT EXISTS "runSegments" jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_run_segments_array'
      AND conrelid = 'public."Activity"'::regclass
  ) THEN
    ALTER TABLE public."Activity"
      ADD CONSTRAINT activity_run_segments_array
      CHECK (
        "runSegments" IS NULL OR (
          category = 'RUN'
          AND jsonb_typeof("runSegments") = 'array'
          AND jsonb_array_length("runSegments") BETWEEN 2 AND 20
        )
      );
  END IF;
END $$;
