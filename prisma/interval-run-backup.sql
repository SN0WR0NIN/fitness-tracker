-- Apply through the approved migration process after interval-run-segments.sql and cycling-scoring-version.sql.
-- Enrich future private operational snapshots only; existing archives are untouched.
CREATE OR REPLACE FUNCTION app_internal.enrich_interval_segments_backup_v7()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public,app_internal
AS $$
DECLARE enriched jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    item || jsonb_build_object(
      'runSegments', a."runSegments",
      'cycleScoringVersion', a."cycleScoringVersion"
    )
    ORDER BY item->>'id'
  ), '[]'::jsonb)
  INTO enriched
  FROM jsonb_array_elements(coalesce(NEW.payload->'activities','[]'::jsonb)) item
  LEFT JOIN public."Activity" a ON a.id=item->>'id';

  NEW.payload:=jsonb_set(NEW.payload,'{activities}',enriched,true);
  NEW.checksum_sha256:=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex');
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app_internal.enrich_interval_segments_backup_v7() FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app_internal.enrich_interval_segments_backup_v7() FROM %I',r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS zzzzzz_interval_segments_backup_v7 ON app_internal.operational_backup;
CREATE TRIGGER zzzzzz_interval_segments_backup_v7
BEFORE INSERT OR UPDATE ON app_internal.operational_backup
FOR EACH ROW EXECUTE FUNCTION app_internal.enrich_interval_segments_backup_v7();
