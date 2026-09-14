ALTER TABLE public."ChallengeSeason" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WeekFinalization" ENABLE ROW LEVEL SECURITY;

ALTER FUNCTION public.enforce_finalized_week_activity_lock() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_finalized_week_weeklyscore_lock() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_finalized_week_pointslog_lock() SET search_path = public, pg_temp;
