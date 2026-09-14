CREATE OR REPLACE FUNCTION public.enforce_finalized_week_activity_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_record record;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    target_record := OLD;
    IF EXISTS (
      SELECT 1 FROM public."WeekFinalization" wf
      JOIN public."ChallengeSeason" s ON s."seasonKey"=wf."seasonKey"
      WHERE wf."status"='FINALIZED'
        AND wf."weekNumber"=target_record."weekNumber"
        AND target_record."occurredAt">=s."startDate"
        AND target_record."occurredAt"<=s."endDate"
    ) THEN
      RAISE EXCEPTION 'Week % is finalized. Reopen it before changing activities.', target_record."weekNumber"
        USING ERRCODE='P0001';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    target_record := NEW;
    IF EXISTS (
      SELECT 1 FROM public."WeekFinalization" wf
      JOIN public."ChallengeSeason" s ON s."seasonKey"=wf."seasonKey"
      WHERE wf."status"='FINALIZED'
        AND wf."weekNumber"=target_record."weekNumber"
        AND target_record."occurredAt">=s."startDate"
        AND target_record."occurredAt"<=s."endDate"
    ) THEN
      RAISE EXCEPTION 'Week % is finalized. Reopen it before changing activities.', target_record."weekNumber"
        USING ERRCODE='P0001';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS "ActivityFinalizedWeekGuard" ON public."Activity";
CREATE TRIGGER "ActivityFinalizedWeekGuard"
BEFORE INSERT OR UPDATE OR DELETE ON public."Activity"
FOR EACH ROW EXECUTE FUNCTION public.enforce_finalized_week_activity_lock();