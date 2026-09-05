BEGIN;
LOCK TABLE "User", "Activity", "WeeklyScore", "WeeklyGoal" IN SHARE ROW EXCLUSIVE MODE;
UPDATE "User" SET "columnId"='cmtjy2gr20000cozwx0juvfbu' WHERE id='cmtk7myfx0001paydx8gmi3a3';
UPDATE "Activity" SET "columnId"='cmtjy2gr20000cozwx0juvfbu' WHERE "userId"='cmtk7myfx0001paydx8gmi3a3';
UPDATE "ChallengeSetting" SET "startDate"='2026-09-01 00:00:00',"updatedAt"=CURRENT_TIMESTAMP WHERE id='primary';
UPDATE "Activity" SET "weekStart"=date_trunc('day', "occurredAt" + interval '8 hours') - extract(dow from "occurredAt" + interval '8 hours')::int * interval '1 day';
UPDATE "Activity" SET "weekNumber"=floor(extract(epoch from ("weekStart" - timestamp '2026-08-30'))/604800)::int+1;
DELETE FROM "WeeklyScore";
INSERT INTO "WeeklyScore" (id,"userId","columnId","weekStart","weekNumber","totalPoints","runPoints","cyclePoints","swimPoints","hikePoints","troopGamePoints","createdAt","updatedAt")
SELECT 'week-repair-'||md5("userId"||"weekStart"::text),"userId","columnId","weekStart","weekNumber",sum(points),coalesce(sum(points) FILTER (WHERE category='RUN'),0),coalesce(sum(points) FILTER (WHERE category='CYCLE'),0),coalesce(sum(points) FILTER (WHERE category='SWIM'),0),coalesce(sum(points) FILTER (WHERE category='WALK_OR_HIKE'),0),coalesce(sum(points) FILTER (WHERE category='TROOP_GAMES'),0),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM "Activity" WHERE status='APPROVED' GROUP BY "userId","columnId","weekStart","weekNumber";
-- Keep the latest saved target if legacy timestamps created several records.
CREATE TEMP TABLE normalized_goals ON COMMIT DROP AS SELECT DISTINCT ON ("userId",date_trunc('day',"weekStart")) "userId",date_trunc('day',"weekStart") AS "weekStart",target,"createdAt","updatedAt" FROM "WeeklyGoal" ORDER BY "userId",date_trunc('day',"weekStart"),"updatedAt" DESC;
DELETE FROM "WeeklyGoal";
INSERT INTO "WeeklyGoal" SELECT * FROM normalized_goals;
DO $$ BEGIN
IF (SELECT coalesce(sum("totalPoints"),0) FROM "WeeklyScore") <> (SELECT coalesce(sum(points),0) FROM "Activity" WHERE status='APPROVED') THEN RAISE EXCEPTION 'Score mismatch'; END IF;
END $$;
COMMIT;
