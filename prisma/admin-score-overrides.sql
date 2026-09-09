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

-- Keep the existing private v7 operational backup format while enriching each
-- Activity object with the two override fields. Older v7 backups remain valid.
CREATE OR REPLACE FUNCTION app_internal.enrich_score_overrides_backup_v7()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public,app_internal
AS $$
DECLARE enriched jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    item || jsonb_build_object(
      'basePointsOverride', a."basePointsOverride",
      'totalPointsOverride', a."totalPointsOverride"
    ) ORDER BY item->>'id'
  ), '[]'::jsonb)
  INTO enriched
  FROM jsonb_array_elements(coalesce(NEW.payload->'activities','[]'::jsonb)) item
  LEFT JOIN public."Activity" a ON a.id=item->>'id';

  NEW.payload:=jsonb_set(NEW.payload,'{activities}',enriched,true);
  NEW.checksum_sha256:=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex');
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app_internal.enrich_score_overrides_backup_v7() FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app_internal.enrich_score_overrides_backup_v7() FROM %I',r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS zzzz_score_overrides_backup_v7 ON app_internal.operational_backup;
CREATE TRIGGER zzzz_score_overrides_backup_v7
BEFORE INSERT OR UPDATE ON app_internal.operational_backup
FOR EACH ROW EXECUTE FUNCTION app_internal.enrich_score_overrides_backup_v7();
