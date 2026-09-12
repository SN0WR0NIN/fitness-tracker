-- Persistent achievement milestones. No badge changes competition points.
ALTER TABLE app_internal.notification ALTER COLUMN id SET DEFAULT gen_random_uuid();
CREATE TABLE app_internal.achievement_definition (
  id text PRIMARY KEY, name text NOT NULL, description text NOT NULL,
  metric text NOT NULL, target double precision NOT NULL CHECK(target>0),
  category text NOT NULL, tier text NOT NULL CHECK(tier IN ('bronze','silver','gold')),
  unit text NOT NULL, sort_order integer NOT NULL
);
CREATE TABLE app_internal.user_achievement (
  user_id text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  season_key text NOT NULL,
  achievement_id text NOT NULL REFERENCES app_internal.achievement_definition(id),
  current_value double precision NOT NULL DEFAULT 0,
  unlocked boolean NOT NULL DEFAULT false,
  first_earned_at timestamptz,
  notified_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,season_key,achievement_id)
);
INSERT INTO app_internal.achievement_definition(id,name,description,metric,target,category,tier,unit,sort_order) VALUES
('first-move','First Move','Complete your first approved activity.','activities',1,'Milestones','bronze','activities',1),
('momentum','Momentum','Complete 5 approved activities.','activities',5,'Milestones','bronze','activities',2),
('dedicated','Dedicated','Complete 10 approved activities.','activities',10,'Milestones','silver','activities',3),
('activity-25','Committed','Complete 25 approved activities.','activities',25,'Milestones','silver','activities',4),
('activity-50','Relentless','Complete 50 approved activities.','activities',50,'Milestones','gold','activities',5),
('points-100','Century Club','Earn 100 approved points.','points',100,'Milestones','silver','pts',6),
('points-200','Double Century','Earn 200 approved points.','points',200,'Milestones','gold','pts',7),
('points-250','250 Point Club','Earn 250 approved points.','points',250,'Milestones','gold','pts',8),
('points-500','500 Point Club','Earn 500 approved points.','points',500,'Milestones','gold','pts',9),
('team-player','Team Player','Complete 3 approved activities with a registered companion.','friends',3,'Social','bronze','teammate activities',10),
('social-athlete','Social Athlete','Complete 8 approved activities with registered companions.','friends',8,'Social','silver','teammate activities',11),
('all-rounder','All-Rounder','Earn approved points in 3 activity categories.','categories',3,'Variety','silver','categories',12),
('full-spectrum','Full Spectrum','Earn approved points in all 5 activity categories.','categories',5,'Variety','gold','categories',13),
('consistency','Consistency','Earn approved points in 3 different weeks.','activeWeeks',3,'Consistency','silver','active weeks',14),
('goal-streak-3','Goal Streak','Meet your recorded goal in 3 consecutive completed weeks. Where no target was recorded, the challenge default is used.','goalStreak',3,'Consistency','silver','consecutive weeks',15),
('goal-streak-5','Perfect Five','Meet your recorded goal in 5 consecutive completed weeks. Where no target was recorded, the challenge default is used.','goalStreak',5,'Consistency','gold','consecutive weeks',16),
('run-specialist','Run Specialist','Complete 10 approved runs.','RUN',10,'Variety','silver','runs',17),
('cycle-specialist','Cycle Specialist','Complete 10 approved cycling activities.','CYCLE',10,'Variety','silver','rides',18),
('swim-specialist','Swim Specialist','Complete 10 approved swims.','SWIM',10,'Variety','silver','swims',19),
('walk-specialist','Walk / Hike Specialist','Complete 10 approved walks or hikes.','WALK_OR_HIKE',10,'Variety','silver','walks / hikes',20),
('games-specialist','Troop Games Specialist','Complete 10 approved Troop Games activities.','TROOP_GAMES',10,'Variety','silver','games',21),
('weekly-champion','Weekly Champion','Earn Top Athlete in a finalized week. Corrected results must be rebuilt before this badge is confirmed.','weeklyWins',1,'Competition','gold','weekly wins',22);
ALTER TABLE app_internal.achievement_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_internal.user_achievement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_internal.achievement_definition,app_internal.user_achievement FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON app_internal.achievement_definition,app_internal.user_achievement FROM %I',r); END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION app_internal.refresh_user_achievements(p_user_id text,p_notify boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE start_day date; end_day date; default_goal double precision; today_sg date; season text;
  metrics jsonb; category_counts jsonb; streak integer; active_weeks integer; wins integer;
  definition record; progress_value double precision; qualified boolean; already_notified timestamptz; enabled boolean; notification_key text;
BEGIN
  -- A participant is defined by column assignment, not by account role. Admins
  -- can compete too, while operator-only accounts without a column stay out.
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
      -- Remember suppressed/backfilled unlocks as well, so re-enabling a
      -- preference or re-earning a corrected badge never floods the bell.
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

CREATE OR REPLACE FUNCTION app_internal.achievements_after_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN PERFORM app_internal.refresh_user_achievements(OLD."userId",true); END IF;
  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW."userId"<>OLD."userId") THEN PERFORM app_internal.refresh_user_achievements(NEW."userId",true); END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_internal.achievements_after_activity() FROM PUBLIC;
-- Alphabetically after focused_dirty_week, so stale weekly winners cannot unlock.
CREATE TRIGGER zz_focused_achievements AFTER INSERT OR UPDATE OR DELETE ON public."Activity" FOR EACH ROW EXECUTE FUNCTION app_internal.achievements_after_activity();
CREATE TRIGGER zz_focused_goal_achievements AFTER INSERT OR UPDATE OR DELETE ON public."WeeklyGoal" FOR EACH ROW EXECUTE FUNCTION app_internal.achievements_after_activity();

CREATE OR REPLACE FUNCTION app_internal.achievements_after_results()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
BEGIN PERFORM app_internal.refresh_all_achievements(true); RETURN NULL; END $$;
REVOKE ALL ON FUNCTION app_internal.achievements_after_results() FROM PUBLIC;
CREATE TRIGGER zz_focused_award_achievements AFTER INSERT OR UPDATE OR DELETE ON app_internal.weekly_result FOR EACH STATEMENT EXECUTE FUNCTION app_internal.achievements_after_results();

-- Preserve existing earned progress without sending historical unlock alerts.
SELECT app_internal.refresh_all_achievements(false);

-- Operational backups keep the same export format but advance to version 6.
CREATE OR REPLACE FUNCTION app_internal.enrich_focused_backup()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,app_internal AS $$
DECLARE extras jsonb;
BEGIN
  extras:=jsonb_build_object(
    'activityCorrections',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM app_internal.activity_correction c),'[]'::jsonb),
    'notificationPreferences',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.user_id) FROM app_internal.notification_preference p),'[]'::jsonb),
    'achievementDefinitions',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_order) FROM app_internal.achievement_definition d),'[]'::jsonb),
    'userAchievements',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.user_id,a.achievement_id) FROM app_internal.user_achievement a),'[]'::jsonb),
    'weeklyResultRebuilds',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.season_key,w.week_number) FROM app_internal.weekly_result_dirty w),'[]'::jsonb)
  );
  NEW.version:=6;
  NEW.payload:=NEW.payload||extras||jsonb_build_object('version',6);
  NEW.counts:=NEW.counts||jsonb_build_object('activityCorrections',jsonb_array_length(extras->'activityCorrections'),'notificationPreferences',jsonb_array_length(extras->'notificationPreferences'),'achievementDefinitions',jsonb_array_length(extras->'achievementDefinitions'),'userAchievements',jsonb_array_length(extras->'userAchievements'),'weeklyResultRebuilds',jsonb_array_length(extras->'weeklyResultRebuilds'));
  NEW.checksum_sha256:=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_internal.enrich_focused_backup() FROM PUBLIC;
CREATE TRIGGER focused_backup_payload BEFORE INSERT OR UPDATE ON app_internal.operational_backup FOR EACH ROW EXECUTE FUNCTION app_internal.enrich_focused_backup();

-- pg_cron exists in production, but is intentionally optional in disposable CI.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='cron') THEN
    PERFORM cron.schedule('kg-achievements-refresh','20 * * * *','SELECT app_internal.refresh_all_achievements(true);');
  END IF;
END $$;
