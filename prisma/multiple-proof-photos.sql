-- Persistent multiple private proof references per activity.
-- Apply only after the feature release is approved. Existing proof references,
-- scores, operating modes and storage permissions are not changed.

ALTER TABLE public."Activity"
  ADD COLUMN IF NOT EXISTS "proofUrls" text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Preserve every existing single proof as the first entry in the new list.
UPDATE public."Activity"
SET "proofUrls" = ARRAY["proofUrl"]::text[]
WHERE "proofUrl" IS NOT NULL
  AND cardinality("proofUrls") = 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='activity_proof_urls_max_five'
  ) THEN
    ALTER TABLE public."Activity"
      ADD CONSTRAINT activity_proof_urls_max_five
      CHECK (cardinality("proofUrls") <= 5);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='activity_proof_urls_no_nulls'
  ) THEN
    ALTER TABLE public."Activity"
      ADD CONSTRAINT activity_proof_urls_no_nulls
      CHECK (array_position("proofUrls", NULL) IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS activity_proof_urls_gin
  ON public."Activity" USING gin ("proofUrls");

-- Keep the v7 operational backup format while enriching each Activity object
-- with the proof list. Older v7 backups remain valid because proofUrls is
-- optional to the validator and the restore drill targets the current schema.
CREATE OR REPLACE FUNCTION app_internal.enrich_multiple_proofs_backup_v7()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public,app_internal
AS $$
DECLARE enriched jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    item || jsonb_build_object('proofUrls', to_jsonb(a."proofUrls"))
    ORDER BY item->>'id'
  ), '[]'::jsonb)
  INTO enriched
  FROM jsonb_array_elements(coalesce(NEW.payload->'activities','[]'::jsonb)) item
  LEFT JOIN public."Activity" a ON a.id=item->>'id';

  NEW.payload:=jsonb_set(NEW.payload,'{activities}',enriched,true);
  NEW.checksum_sha256:=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex');
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app_internal.enrich_multiple_proofs_backup_v7() FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app_internal.enrich_multiple_proofs_backup_v7() FROM %I',r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS zzzzz_multiple_proofs_backup_v7 ON app_internal.operational_backup;
CREATE TRIGGER zzzzz_multiple_proofs_backup_v7
BEFORE INSERT OR UPDATE ON app_internal.operational_backup
FOR EACH ROW EXECUTE FUNCTION app_internal.enrich_multiple_proofs_backup_v7();
