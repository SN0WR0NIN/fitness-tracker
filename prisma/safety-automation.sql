-- Production safety automation for KG Stay Active.
-- Applied to Supabase project rflkkcdwashopzzahizw on 2026-09-05.
-- All automation tables/functions live in a private schema; no anon/authenticated access is granted.

create extension if not exists pg_cron;
create schema if not exists app_internal;
revoke all on schema app_internal from public;
revoke all on schema app_internal from anon, authenticated;

create table if not exists app_internal.system_health_check (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('HEALTHY','WARN','ERROR')),
  details jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists system_health_check_created_at_idx on app_internal.system_health_check (created_at desc);

create table if not exists app_internal.operational_backup (
  id uuid primary key default gen_random_uuid(),
  format text not null default 'kg-stay-active-operational-backup',
  version integer not null default 2,
  payload jsonb not null,
  checksum_sha256 text not null,
  counts jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists operational_backup_created_at_idx on app_internal.operational_backup (created_at desc);

alter table app_internal.system_health_check enable row level security;
alter table app_internal.operational_backup enable row level security;
revoke all on app_internal.system_health_check from public, anon, authenticated;
revoke all on app_internal.operational_backup from public, anon, authenticated;

create or replace function app_internal.create_operational_backup()
returns uuid
language plpgsql
set search_path = pg_catalog, public, app_internal, extensions
as $$
declare
  backup_id uuid := gen_random_uuid();
  payload_json jsonb;
  counts_json jsonb;
begin
  select jsonb_build_object(
    'format', 'kg-stay-active-operational-backup',
    'version', 2,
    'exportedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'excludes', jsonb_build_array('passwords','Strava access tokens','Strava refresh tokens'),
    'challenge', coalesce((select to_jsonb(cs) from public."ChallengeSetting" cs where cs.id='primary' limit 1), '{}'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(a) order by a."createdAt") from public."Announcement" a), '[]'::jsonb),
    'columns', coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public."Column" c), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id',u.id,'name',u.name,'email',u.email,'username',u.username,'role',u.role,'columnId',u."columnId",
      'stravaAthleteId',u."stravaAthleteId",'createdAt',u."createdAt",'updatedAt',u."updatedAt"
    ) order by u.name) from public."User" u), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'userId',a."userId",'columnId',a."columnId",'category',a.category,'distance',a.distance,
      'pace',a.pace,'duration',a.duration,'completedWithFriend',a."completedWithFriend",'companion',a.companion,
      'companionUserId',a."companionUserId",'proofUrl',a."proofUrl",'points',a.points,'status',a.status,
      'reviewedById',a."reviewedById",'reviewedAt',a."reviewedAt",'rejectionReason',a."rejectionReason",
      'occurredAt',a."occurredAt",'weekStart',a."weekStart",'weekNumber',a."weekNumber",
      'stravaActivityId',a."stravaActivityId",'elevationGain',a."elevationGain",'createdAt',a."createdAt",'updatedAt',a."updatedAt"
    ) order by a."occurredAt") from public."Activity" a), '[]'::jsonb),
    'weeklyScores', coalesce((select jsonb_agg(to_jsonb(w) order by w."weekStart", w."userId") from public."WeeklyScore" w), '[]'::jsonb),
    'profileSettings', coalesce((select jsonb_agg(to_jsonb(p) order by p."userId") from public."UserProfileSettings" p), '[]'::jsonb),
    'weeklyGoals', coalesce((select jsonb_agg(to_jsonb(g) order by g."weekStart", g."userId") from public."WeeklyGoal" g), '[]'::jsonb),
    'rankingSnapshots', coalesce((select jsonb_agg(to_jsonb(r) order by r."capturedAt") from public."RankingSnapshot" r), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(to_jsonb(aa) order by aa."createdAt") from public."AdminAudit" aa), '[]'::jsonb)
  ) into payload_json;

  counts_json := jsonb_build_object(
    'users', jsonb_array_length(payload_json->'users'),
    'activities', jsonb_array_length(payload_json->'activities'),
    'weeklyScores', jsonb_array_length(payload_json->'weeklyScores'),
    'profileSettings', jsonb_array_length(payload_json->'profileSettings'),
    'weeklyGoals', jsonb_array_length(payload_json->'weeklyGoals'),
    'rankingSnapshots', jsonb_array_length(payload_json->'rankingSnapshots')
  );

  insert into app_internal.operational_backup(id, format, version, payload, checksum_sha256, counts)
  values (
    backup_id, 'kg-stay-active-operational-backup', 2, payload_json,
    encode(extensions.digest(convert_to(payload_json::text,'UTF8'),'sha256'),'hex'), counts_json
  );
  return backup_id;
end;
$$;

create or replace function app_internal.run_integrity_check()
returns uuid
language plpgsql
set search_path = pg_catalog, public, app_internal
as $$
declare
  check_id uuid := gen_random_uuid();
  details_json jsonb;
  result_status text;
begin
  with expected as (
    select a."userId", a."weekStart",
      coalesce(sum(a.points),0)::float8 total,
      coalesce(sum(a.points) filter (where a.category='RUN'),0)::float8 run,
      coalesce(sum(a.points) filter (where a.category='CYCLE'),0)::float8 cycle,
      coalesce(sum(a.points) filter (where a.category='SWIM'),0)::float8 swim,
      coalesce(sum(a.points) filter (where a.category='WALK_OR_HIKE'),0)::float8 hike,
      coalesce(sum(a.points) filter (where a.category='TROOP_GAMES'),0)::float8 troop
    from public."Activity" a where a.status='APPROVED'
    group by a."userId", a."weekStart"
  ), mismatches as (
    select coalesce(e."userId",w."userId") as user_id
    from expected e full outer join public."WeeklyScore" w
      on w."userId"=e."userId" and w."weekStart"=e."weekStart"
    where coalesce(e.total,0) <> coalesce(w."totalPoints",0)
       or coalesce(e.run,0) <> coalesce(w."runPoints",0)
       or coalesce(e.cycle,0) <> coalesce(w."cyclePoints",0)
       or coalesce(e.swim,0) <> coalesce(w."swimPoints",0)
       or coalesce(e.hike,0) <> coalesce(w."hikePoints",0)
       or coalesce(e.troop,0) <> coalesce(w."troopGamePoints",0)
  ), possible_duplicates as (
    select x.id
    from public."Activity" x join public."Activity" y
      on x."userId"=y."userId" and x.category=y.category and x.id<y.id
    where x.status <> 'REJECTED' and y.status <> 'REJECTED'
      and x.distance > 0 and y.distance > 0
      and ((x."occurredAt" at time zone 'UTC') at time zone 'Asia/Singapore')::date =
          ((y."occurredAt" at time zone 'UTC') at time zone 'Asia/Singapore')::date
      and abs(x.distance-y.distance) <= greatest(x.distance,y.distance)*0.02
  ), exact_proof_dupes as (
    select "proofUrl" from public."Activity"
    where "proofUrl" is not null and status <> 'REJECTED'
    group by "proofUrl" having count(*) > 1
  ), strava_dupes as (
    select "stravaActivityId" from public."Activity"
    where "stravaActivityId" is not null
    group by "stravaActivityId" having count(*) > 1
  ), challenge as (
    select
      ((cs."startDate"::date::text || ' 00:00:00+08')::timestamptz at time zone 'UTC') as utc_start,
      ((cs."endDate"::date::text || ' 23:59:59.999+08')::timestamptz at time zone 'UTC') as utc_end
    from public."ChallengeSetting" cs where cs.id='primary'
  )
  select jsonb_build_object(
    'users',(select count(*)::int from public."User"),
    'activities',(select count(*)::int from public."Activity"),
    'pending',(select count(*)::int from public."Activity" where status='PENDING'),
    'approved',(select count(*)::int from public."Activity" where status='APPROVED'),
    'rejected',(select count(*)::int from public."Activity" where status='REJECTED'),
    'score_mismatches',(select count(*)::int from mismatches),
    'negative_scores',(select count(*)::int from public."WeeklyScore" where "totalPoints"<0 or "runPoints"<0 or "cyclePoints"<0 or "swimPoints"<0 or "hikePoints"<0 or "troopGamePoints"<0),
    'orphan_activity_users',(select count(*)::int from public."Activity" a left join public."User" u on u.id=a."userId" where u.id is null),
    'orphan_activity_columns',(select count(*)::int from public."Activity" a left join public."Column" c on c.id=a."columnId" where c.id is null),
    'duplicate_proof_groups',(select count(*)::int from exact_proof_dupes),
    'duplicate_strava_groups',(select count(*)::int from strava_dupes),
    'approved_without_reviewer',(select count(*)::int from public."Activity" where status='APPROVED' and ("reviewedById" is null or "reviewedAt" is null)),
    'rejected_without_reason',(select count(*)::int from public."Activity" where status='REJECTED' and coalesce(trim("rejectionReason"),'')=''),
    'outside_challenge_window',(select count(*)::int from public."Activity" a cross join challenge c where a."occurredAt" < c.utc_start or a."occurredAt" > c.utc_end),
    'possible_duplicate_pairs',(select count(*)::int from possible_duplicates),
    'latest_backup_at',(select max(created_at) from app_internal.operational_backup),
    'checked_at',clock_timestamp()
  ) into details_json;

  result_status := case
    when (details_json->>'score_mismatches')::int > 0
      or (details_json->>'negative_scores')::int > 0
      or (details_json->>'orphan_activity_users')::int > 0
      or (details_json->>'orphan_activity_columns')::int > 0
      or (details_json->>'duplicate_proof_groups')::int > 0
      or (details_json->>'duplicate_strava_groups')::int > 0
      or (details_json->>'approved_without_reviewer')::int > 0
      or (details_json->>'rejected_without_reason')::int > 0
      or (details_json->>'outside_challenge_window')::int > 0 then 'ERROR'
    when (details_json->>'possible_duplicate_pairs')::int > 0 then 'WARN'
    else 'HEALTHY'
  end;

  insert into app_internal.system_health_check(id,status,details) values(check_id,result_status,details_json);
  return check_id;
end;
$$;

create or replace function app_internal.cleanup_safety_history()
returns void
language plpgsql
set search_path = pg_catalog, app_internal
as $$
begin
  delete from app_internal.operational_backup where created_at < now() - interval '30 days';
  delete from app_internal.system_health_check where created_at < now() - interval '90 days';
end;
$$;

revoke all on function app_internal.create_operational_backup() from public, anon, authenticated;
revoke all on function app_internal.run_integrity_check() from public, anon, authenticated;
revoke all on function app_internal.cleanup_safety_history() from public, anon, authenticated;

select cron.schedule('kg-hourly-integrity','10 * * * *','select app_internal.run_integrity_check();');
select cron.schedule('kg-daily-operational-backup','30 18 * * *','select app_internal.create_operational_backup();');
select cron.schedule('kg-daily-safety-retention','45 18 * * *','select app_internal.cleanup_safety_history();');
