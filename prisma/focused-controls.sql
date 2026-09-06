-- Focused controls, corrections and notification preferences.
-- Run as a migration, never during an application request.
CREATE SCHEMA IF NOT EXISTS app_internal;
ALTER TABLE public."ChallengeSetting" ADD COLUMN IF NOT EXISTS "readOnlyMode" boolean NOT NULL DEFAULT false;

CREATE TABLE app_internal.notification_preference (
  user_id text PRIMARY KEY REFERENCES public."User"(id) ON DELETE CASCADE,
  activity_reviews boolean NOT NULL DEFAULT true,
  correction_updates boolean NOT NULL DEFAULT true,
  achievements boolean NOT NULL DEFAULT true,
  weekly_results boolean NOT NULL DEFAULT true,
  goal_reminders boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_internal.activity_correction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL,
  user_id text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','APPROVED','REJECTED','CANCELLED','STALE')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 1000),
  original jsonb NOT NULL CHECK (jsonb_typeof(original)='object'),
  proposed jsonb NOT NULL CHECK (jsonb_typeof(proposed)='object'),
  applied jsonb,
  decision_reason text,
  duplicate_override_reason text,
  reviewed_by_id text REFERENCES public."User"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX activity_correction_one_open ON app_internal.activity_correction(activity_id) WHERE status='OPEN';
CREATE INDEX activity_correction_owner ON app_internal.activity_correction(user_id,created_at DESC);
CREATE INDEX activity_correction_queue ON app_internal.activity_correction(status,created_at);

CREATE TABLE app_internal.weekly_result_dirty (
  season_key text NOT NULL,
  week_number integer NOT NULL,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(season_key,week_number),
  FOREIGN KEY(season_key,week_number) REFERENCES app_internal.weekly_result(season_key,week_number) ON DELETE CASCADE
);

ALTER TABLE app_internal.notification_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_internal.activity_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_internal.weekly_result_dirty ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_internal.notification_preference,app_internal.activity_correction,app_internal.weekly_result_dirty FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON app_internal.notification_preference,app_internal.activity_correction,app_internal.weekly_result_dirty FROM %I',r);
    END IF;
  END LOOP;
END $$;

-- A database backstop also covers imports, scripts and concurrent requests.
-- FOR SHARE serializes a lock activation against in-flight competition writes.
CREATE OR REPLACE FUNCTION app_internal.guard_competition_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE locked boolean;
BEGIN
  SELECT "readOnlyMode" INTO locked FROM public."ChallengeSetting" WHERE id='primary' FOR SHARE;
  IF coalesce(locked,false) THEN
    RAISE EXCEPTION 'COMPETITION_READ_ONLY: Competition changes are locked. An administrator can unlock them in Maintenance controls.' USING ERRCODE='55000';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_internal.guard_competition_write() FROM PUBLIC;
CREATE TRIGGER focused_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public."Activity" FOR EACH STATEMENT EXECUTE FUNCTION app_internal.guard_competition_write();
CREATE TRIGGER focused_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public."WeeklyScore" FOR EACH STATEMENT EXECUTE FUNCTION app_internal.guard_competition_write();
CREATE TRIGGER focused_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public."PointsLog" FOR EACH STATEMENT EXECUTE FUNCTION app_internal.guard_competition_write();
CREATE TRIGGER focused_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON app_internal.weekly_result FOR EACH STATEMENT EXECUTE FUNCTION app_internal.guard_competition_write();
CREATE TRIGGER focused_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON app_internal.activity_correction FOR EACH STATEMENT EXECUTE FUNCTION app_internal.guard_competition_write();

CREATE OR REPLACE FUNCTION app_internal.flag_changed_competition_week()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE keys date[] := ARRAY[]::date[];
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.status='APPROVED' THEN keys := array_append(keys,OLD."weekStart"::date); END IF;
  IF TG_OP <> 'DELETE' AND NEW.status='APPROVED' THEN keys := array_append(keys,NEW."weekStart"::date); END IF;
  INSERT INTO app_internal.weekly_result_dirty(season_key,week_number,reason)
  SELECT season_key,week_number,'Approved activity data changed after finalization. Review and rebuild this week.'
  FROM app_internal.weekly_result WHERE week_start_key=ANY(keys)
  ON CONFLICT(season_key,week_number) DO UPDATE SET reason=excluded.reason,updated_at=now();
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_internal.flag_changed_competition_week() FROM PUBLIC;
CREATE TRIGGER focused_dirty_week AFTER INSERT OR UPDATE OR DELETE ON public."Activity" FOR EACH ROW EXECUTE FUNCTION app_internal.flag_changed_competition_week();

CREATE OR REPLACE FUNCTION app_internal.clear_rebuilt_competition_week()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
BEGIN
  DELETE FROM app_internal.weekly_result_dirty WHERE season_key=NEW.season_key AND week_number=NEW.week_number;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_internal.clear_rebuilt_competition_week() FROM PUBLIC;
CREATE TRIGGER focused_clear_dirty AFTER INSERT OR UPDATE ON app_internal.weekly_result FOR EACH ROW EXECUTE FUNCTION app_internal.clear_rebuilt_competition_week();
