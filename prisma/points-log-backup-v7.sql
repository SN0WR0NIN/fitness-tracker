-- Apply ONLY after approval, through the migration mechanism. Does not rewrite
-- existing backups, scores, activities, operating mode or storage permissions.
-- Existing v1-v6 validators remain available. This records the actual PointsLog
-- rows, rather than promising reconstruction from rounded display amounts.
CREATE FUNCTION app_internal.enrich_ledger_backup_v7()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public,app_internal AS $$
DECLARE logs jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) INTO logs FROM public."PointsLog" p;
  NEW.version:=7;
  NEW.payload:=NEW.payload||jsonb_build_object('version',7,'pointsLogs',logs,
    'mediaCoverage','References only. Storage object bytes and external provider files require separate private backups.');
  NEW.counts:=NEW.counts||jsonb_build_object('pointsLogs',jsonb_array_length(logs));
  NEW.checksum_sha256:=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_internal.enrich_ledger_backup_v7() FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION app_internal.enrich_ledger_backup_v7() FROM %I',r); END IF;
  END LOOP;
END $$;
CREATE TRIGGER zzz_ledger_backup_v7 BEFORE INSERT OR UPDATE ON app_internal.operational_backup
FOR EACH ROW EXECUTE FUNCTION app_internal.enrich_ledger_backup_v7();
