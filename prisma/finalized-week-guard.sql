CREATE OR REPLACE FUNCTION public.enforce_finalized_week_activity_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE target_record record;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    target_record := OLD;
    IF EXISTS (SELECT 1 FROM public."WeekFinalization" wf JOIN public."ChallengeSeason" s ON s."seasonKey"=wf."seasonKey" WHERE wf."status"='FINALIZED' AND wf."weekNumber"=target_record."weekNumber" AND target_record."occurredAt">=s."startDate" AND target_record."occurredAt"<=s."endDate") THEN
      RAISE EXCEPTION 'Week % is finalized. Reopen it before changing activities.', target_record."weekNumber" USING ERRCODE='P0001';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    target_record := NEW;
    IF EXISTS (SELECT 1 FROM public."WeekFinalization" wf JOIN public."ChallengeSeason" s ON s."seasonKey"=wf."seasonKey" WHERE wf."status"='FINALIZED' AND wf."weekNumber"=target_record."weekNumber" AND target_record."occurredAt">=s."startDate" AND target_record."occurredAt"<=s."endDate") THEN
      RAISE EXCEPTION 'Week % is finalized. Reopen it before changing activities.', target_record."weekNumber" USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS "ActivityFinalizedWeekGuard" ON public."Activity";
CREATE TRIGGER "ActivityFinalizedWeekGuard" BEFORE INSERT OR UPDATE OR DELETE ON public."Activity" FOR EACH ROW EXECUTE FUNCTION public.enforce_finalized_week_activity_lock();

CREATE OR REPLACE FUNCTION public.enforce_finalized_week_weeklyscore_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_record record;
BEGIN
  target_record := CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  IF EXISTS (SELECT 1 FROM public."WeekFinalization" wf WHERE wf."status"='FINALIZED' AND wf."weekStart"=target_record."weekStart"::date) THEN
    RAISE EXCEPTION 'This weekly score belongs to a finalized week. Reopen the week before changing scores.' USING ERRCODE='P0001';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS "WeeklyScoreFinalizedWeekGuard" ON public."WeeklyScore";
CREATE TRIGGER "WeeklyScoreFinalizedWeekGuard" BEFORE INSERT OR UPDATE OR DELETE ON public."WeeklyScore" FOR EACH ROW EXECUTE FUNCTION public.enforce_finalized_week_weeklyscore_lock();

CREATE OR REPLACE FUNCTION public.enforce_finalized_week_pointslog_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE activity_id text; target_week integer; target_time timestamp without time zone;
BEGIN
  activity_id := CASE WHEN TG_OP='DELETE' THEN OLD."activityId" ELSE NEW."activityId" END;
  SELECT a."weekNumber",a."occurredAt" INTO target_week,target_time FROM public."Activity" a WHERE a.id=activity_id;
  IF target_week IS NOT NULL AND EXISTS (SELECT 1 FROM public."WeekFinalization" wf JOIN public."ChallengeSeason" s ON s."seasonKey"=wf."seasonKey" WHERE wf."status"='FINALIZED' AND wf."weekNumber"=target_week AND target_time>=s."startDate" AND target_time<=s."endDate") THEN
    RAISE EXCEPTION 'This points log belongs to a finalized week. Reopen the week before changing scores.' USING ERRCODE='P0001';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS "PointsLogFinalizedWeekGuard" ON public."PointsLog";
CREATE TRIGGER "PointsLogFinalizedWeekGuard" BEFORE INSERT OR UPDATE OR DELETE ON public."PointsLog" FOR EACH ROW EXECUTE FUNCTION public.enforce_finalized_week_pointslog_lock();
