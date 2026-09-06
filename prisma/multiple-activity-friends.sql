-- Additive only: no historical activity, scoring or operating-mode updates.
ALTER TABLE public."Activity" ADD COLUMN IF NOT EXISTS "companionUserIds" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public."Activity" ADD CONSTRAINT activity_friend_array_shape CHECK (
  cardinality("companionUserIds") <= 100 AND array_position("companionUserIds", NULL) IS NULL
  AND coalesce(array_ndims("companionUserIds"),1)=1 AND NOT ("userId"=ANY("companionUserIds"))
);

-- Scalar-array references are checked and key-share locked for the duration
-- of each write. Keep the legacy first-companion field consistent for reports.
CREATE FUNCTION app_internal.validate_activity_friends() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE n integer;
BEGIN
  IF cardinality(NEW."companionUserIds")=0 THEN RETURN NEW; END IF;
  IF (SELECT count(DISTINCT friend) FROM unnest(NEW."companionUserIds") friend) <> cardinality(NEW."companionUserIds")
     OR NEW."companionUserId" IS DISTINCT FROM NEW."companionUserIds"[1]
     OR NOT NEW."completedWithFriend" THEN
    RAISE EXCEPTION 'Invalid or inconsistent activity friend selection' USING ERRCODE='23514';
  END IF;
  PERFORM id FROM public."User" WHERE id=ANY(NEW."companionUserIds") ORDER BY id FOR KEY SHARE;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>cardinality(NEW."companionUserIds") THEN
    RAISE EXCEPTION 'Selected activity friend no longer exists' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_internal.validate_activity_friends() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_multi_friends BEFORE INSERT OR UPDATE OF "companionUserIds","companionUserId","completedWithFriend","userId" ON public."Activity" FOR EACH ROW EXECUTE FUNCTION app_internal.validate_activity_friends();

-- Do not silently orphan secondary friends when an admin deletes a user.
-- Account linking transfers all references before deleting its placeholder.
CREATE FUNCTION app_internal.guard_activity_friend_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public."Activity" WHERE "userId"<>OLD.id AND OLD.id=ANY("companionUserIds")) THEN
    RAISE EXCEPTION 'Participant is recorded as a friend on existing activities; update those selections before deleting the account' USING ERRCODE='23503';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION app_internal.guard_activity_friend_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_multi_friend_delete BEFORE DELETE ON public."User" FOR EACH ROW EXECUTE FUNCTION app_internal.guard_activity_friend_delete();

-- Backward-compatible optional field in v6 backups. Run after the existing
-- focused backup trigger; retain privacy-safe base fields and recompute hash.
CREATE FUNCTION app_internal.enrich_multi_friend_backup() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
BEGIN
  NEW.payload:=jsonb_set(NEW.payload,'{activities}',coalesce((
    SELECT jsonb_agg(item.value || jsonb_build_object('companionUserIds',coalesce(a."companionUserIds",ARRAY[]::text[])) ORDER BY item.ordinality)
    FROM jsonb_array_elements(NEW.payload->'activities') WITH ORDINALITY item(value,ordinality)
    LEFT JOIN public."Activity" a ON a.id=item.value->>'id'
  ),'[]'::jsonb));
  NEW.checksum_sha256:=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_internal.enrich_multi_friend_backup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_multi_friend_backup BEFORE INSERT OR UPDATE ON app_internal.operational_backup FOR EACH ROW EXECUTE FUNCTION app_internal.enrich_multi_friend_backup();
