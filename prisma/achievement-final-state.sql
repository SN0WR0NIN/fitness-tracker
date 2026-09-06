-- Apply after achievement-engine.sql through the migration mechanism.
-- A daily bonus can move between rows within one scoring transaction. Immediate
-- row triggers can observe 102 then 99 points, or 97 then 100, and permanently
-- consume/remove a notification even though that state was never committed.
-- Evaluate only the final transaction state. Keep the existing private invoker
-- functions, dedupe rules, permissions, dirty-week triggers and scoring intact.
-- This migration changes trigger timing only; it does not backfill live data.

DROP TRIGGER zz_focused_achievements ON public."Activity";
CREATE CONSTRAINT TRIGGER zz_focused_achievements
  AFTER INSERT OR UPDATE OR DELETE ON public."Activity"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_internal.achievements_after_activity();

DROP TRIGGER zz_focused_goal_achievements ON public."WeeklyGoal";
CREATE CONSTRAINT TRIGGER zz_focused_goal_achievements
  AFTER INSERT OR UPDATE OR DELETE ON public."WeeklyGoal"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_internal.achievements_after_activity();

DROP TRIGGER zz_focused_award_achievements ON app_internal.weekly_result;
CREATE CONSTRAINT TRIGGER zz_focused_award_achievements
  AFTER INSERT OR UPDATE OR DELETE ON app_internal.weekly_result
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_internal.achievements_after_results();

-- PostgreSQL runs these before COMMIT completes; callers see finalized badges
-- on their next read. Rollbacks discard both queued checks and notifications.
-- Do not SET CONSTRAINTS IMMEDIATE midway through a real scoring mutation.
-- If a maintenance transaction needs a backup, commit reconciliation first,
-- then take the backup in a separate transaction so its achievements are final.
