-- Apply after achievement-engine.sql and achievement-final-state.sql.
-- Achievement eligibility follows participation (a column assignment), not
-- authorization role. This keeps operator-only admins out while allowing admins
-- who also compete to receive the same progress and badges as members.
--
-- This migration only replaces the two private refresh functions and silently
-- rebuilds achievement rows. It does not mutate activities, score ledgers,
-- weekly scores, published results, storage, or operating modes.

CREATE OR REPLACE FUNCTION app_internal.refresh_user_achievements(p_user_id text,p_notify boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE start_day date; end_day date; default_goal double precision; today_sg date; season text;
  metrics jsonb; category_counts jsonb; streak integer; active_weeks integer; wins integer;
  definition record; progress_value double precision; qualified boolean; already_notified timestamptz; enabled boolean; notification_key text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public."User" WHERE id=p_user_id AND "columnId" IS NOT NULL) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kg-achievement:'||p_user_id,0));
  SELECT "startDate"::date,"endDate"::date,"weeklyGoal" INTO start_day,end_day,default_goal FROM public."ChallengeSetting" WHERE id='primary';
  IF start_day IS NULL THEN RETURN; END IF;
  season:=start_day::text;
  today_sg:=(now() AT TIME ZONE 'Asia/Singapore')::date;
  SELECT jsonb_build_object('activities',count(*),'points',coalesce(sum(points),0),'friends',count(*) FILTER(WHERE "completedWithFriend" AND "companionUserId" IS NOT NULL),'categories',count(DISTINCT category) FILTER(WHERE points>0))
  INTO metrics FROM public."Activity" WHERE "userId"=p_user_id AND status='APPROVED' AND ("occurredAt"+interval '8 hours')::date BETWEEN start_day AND end_day;
  SELECT coalesce(jsonb_object_agg(category,n),'{}'::jsonb) INTO category_counts FROM (
    SELECT category::text,count(*) AS n FROM public."Activity" WHERE "userId"=p_user_id AND status='APPROVED' AND ("occurredAt"+interval '8 hours')::date BETWEEN start_day AND end_day GROUP BY category
  ) categories;
  WITH weekly AS (
    SELECT "weekStart"::date AS k,sum(points) AS points FROM public."Activity"
    WHERE "userId"=p_user_id AND status='APPROVED' AND ("occurredAt"+interval '8 hours')::date BETWEEN start_day AND end_day GROUP BY "weekStart"::date
  ), qualifying AS (
    SELECT w.k FROM weekly w LEFT JOIN public."WeeklyGoal" g ON g."userId"=p_user_id AND g."weekStart"=w.k::timestamp
    WHERE least(w.k+6,end_day)<today_sg AND w.points>=coalesce(g.target,default_goal) AND coalesce(g.target,default_goal)>0
  ), islands AS (
    SELECT k-(row_number() OVER(ORDER BY k)::integer*7) AS island FROM qualifying
  ) SELECT coalesce(max(n),0)::integer INTO streak FROM (SELECT count(*) n FROM islands GROUP BY island) grouped;
  SELECT count(*)::integer INTO active_weeks FROM (SELECT "weekStart" FROM public."Activity" WHERE "userId"=p_user_id AND status='APPROVED' AND ("occurredAt"+interval '8 hours')::date BETWEEN start_day AND end_day GROUP BY "weekStart" HAVING sum(points)>0) weeks;
  SELECT count(*)::integer INTO wins FROM app_internal.weekly_result r CROSS JOIN LATERAL jsonb_array_elements(r.awards) a
    WHERE r.season_key=season AND a->>'type'='TOP_ATHLETE' AND a->>'entityType'='USER' AND a->>'entityId'=p_user_id
    AND NOT EXISTS(SELECT 1 FROM app_internal.weekly_result_dirty d WHERE d.season_key=r.season_key AND d.week_number=r.week_number);
  metrics:=metrics||category_counts||jsonb_build_object('goalStreak',streak,'activeWeeks',active_weeks,'weeklyWins',wins);
  SELECT achievements INTO enabled FROM app_internal.notification_preference WHERE user_id=p_user_id;
  FOR definition IN SELECT * FROM app_internal.achievement_definition ORDER BY sort_order LOOP
    progress_value:=coalesce((metrics->>definition.metric)::double precision,0);
    qualified:=progress_value>=definition.target;
    INSERT INTO app_internal.user_achievement(user_id,season_key,achievement_id,current_value,unlocked,first_earned_at)
      VALUES(p_user_id,season,definition.id,progress_value,qualified,CASE WHEN qualified THEN now() END)
      ON CONFLICT(user_id,season_key,achievement_id) DO UPDATE SET current_value=excluded.current_value,unlocked=excluded.unlocked,
        first_earned_at=coalesce(app_internal.user_achievement.first_earned_at,excluded.first_earned_at),
        revoked_at=CASE WHEN excluded.unlocked THEN NULL WHEN app_internal.user_achievement.unlocked THEN now() ELSE app_internal.user_achievement.revoked_at END,updated_at=now()
      RETURNING notified_at INTO already_notified;
    notification_key:='achievement:'||season||':'||p_user_id||':'||definition.id;
    IF qualified AND already_notified IS NULL THEN
      IF p_notify AND coalesce(enabled,true) THEN
        INSERT INTO app_internal.notification(id,user_id,kind,level,title,message,href,metadata,dedupe_key)
        VALUES(gen_random_uuid(),p_user_id,'ACHIEVEMENT','success','Achievement unlocked: '||definition.name,definition.description,'/trophies',jsonb_build_object('seasonKey',season,'achievementId',definition.id),notification_key)
        ON CONFLICT(dedupe_key) DO NOTHING;
      END IF;
      UPDATE app_internal.user_achievement SET notified_at=now() WHERE user_id=p_user_id AND season_key=season AND achievement_id=definition.id;
    ELSIF NOT qualified THEN
      DELETE FROM app_internal.notification WHERE dedupe_key=notification_key;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION app_internal.refresh_user_achievements(text,boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION app_internal.refresh_all_achievements(p_notify boolean DEFAULT true)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE u record; n integer:=0;
BEGIN
  FOR u IN SELECT id FROM public."User" WHERE "columnId" IS NOT NULL ORDER BY id LOOP
    PERFORM app_internal.refresh_user_achievements(u.id,p_notify); n:=n+1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_internal.refresh_all_achievements(boolean) FROM PUBLIC;

DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app_internal.refresh_user_achievements(text,boolean) FROM %I',r);
      EXECUTE format('REVOKE ALL ON FUNCTION app_internal.refresh_all_achievements(boolean) FROM %I',r);
    END IF;
  END LOOP;
END $$;

-- Repair existing participant-admin progress without historical bell alerts.
SELECT app_internal.refresh_all_achievements(false);
