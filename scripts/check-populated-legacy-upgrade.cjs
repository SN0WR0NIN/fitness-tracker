#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS regression runner */
// Synthetic upgrade rehearsal only. Never connects to an external database.
// The normal E2E job separately verifies application flows and READ_ONLY guards.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { assertDisposableEnvironment } = require('./e2e-environment.cjs');

const DATABASE = 'fitness_tracker_upgrade_drill';
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:5432/${DATABASE}?schema=public`;
const ROOT = path.resolve(__dirname, '..');
const sqlFile = name => fs.readFileSync(path.join(ROOT, 'prisma', name), 'utf8');

function assertUpgradeEnvironment(env) {
  assertDisposableEnvironment(env);
  if (env.GITHUB_ACTIONS !== 'true' || !/^[a-f0-9]{12,64}$/.test(env.PG_CONTAINER || '')) {
    throw new Error('Upgrade rehearsal requires the GitHub Actions PostgreSQL service container.');
  }
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = new URL(env[name]);
    if (url.hostname !== '127.0.0.1' || url.port !== '5432' || url.username !== 'postgres' || url.password !== 'postgres') {
      throw new Error('Upgrade rehearsal requires the fixed disposable PostgreSQL service configuration.');
    }
  }
}

function legacySchema() {
  const source = sqlFile('schema.prisma');
  const declaration = /^\s*cycleScoringVersion\s+Int\s+@default\(1\)[^\n]*\n/gm;
  assert.equal([...source.matchAll(declaration)].length, 1, 'Expected one reviewed scoring-version declaration');
  const legacy = source.replace(declaration, '');
  assert.ok(!legacy.includes('cycleScoringVersion'), 'Legacy schema must not already contain scoring versions');
  assert.match(legacy, /runSegments\s+Json\?/);
  assert.match(legacy, /totalPointsOverride\s+Float\?/);
  return legacy;
}

function rehearsalSql() {
  return `
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_database() <> '${DATABASE}' THEN RAISE EXCEPTION 'Wrong rehearsal database'; END IF;
  IF EXISTS (SELECT FROM public."Activity") THEN RAISE EXCEPTION 'Rehearsal database must be empty'; END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='Activity' AND column_name='cycleScoringVersion') THEN
    RAISE EXCEPTION 'Must begin with a legacy schema without scoring versions';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA app_internal;
CREATE TABLE app_internal.operational_backup (
  id uuid PRIMARY KEY, format text NOT NULL, version integer NOT NULL,
  payload jsonb NOT NULL, checksum_sha256 text NOT NULL, counts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_internal.operational_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA app_internal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON app_internal.operational_backup FROM PUBLIC, anon, authenticated;

-- Existing prerequisites, not the feature migration under test.
${sqlFile('interval-run-segments.sql')}
${sqlFile('admin-score-overrides.sql')}
${sqlFile('multiple-proof-photos.sql')}
${sqlFile('points-log-backup-v7.sql')}

INSERT INTO public."Column" (id,name,"updatedAt") VALUES ('upgrade-column','Synthetic upgrade column',now());
INSERT INTO public."User" (id,name,email,password,"columnId","updatedAt")
VALUES ('upgrade-user','Synthetic upgrade user','upgrade@example.invalid','!UNCLAIMED','upgrade-column',now());
INSERT INTO public."Activity" (id,"userId","columnId",category,distance,pace,"runSegments",points,
  "basePointsOverride","totalPointsOverride",status,"occurredAt","weekStart","weekNumber","updatedAt")
VALUES
  ('legacy-cycle-20','upgrade-user','upgrade-column','CYCLE',20,NULL,NULL,6.5,NULL,NULL,'APPROVED','2026-09-02','2026-08-30',1,now()),
  ('legacy-cycle-override','upgrade-user','upgrade-column','CYCLE',40,NULL,NULL,14.5,13.33,14.5,'APPROVED','2026-09-03','2026-08-30',1,now()),
  ('legacy-interval','upgrade-user','upgrade-column','RUN',6,6,
    '[{"kind":"WORK","distance":4,"pace":4.5},{"kind":"RECOVERY","distance":2,"pace":9}]',
    13,NULL,NULL,'APPROVED','2026-09-04','2026-08-30',1,now());
INSERT INTO public."PointsLog" (id,"activityId","basePoints","friendBonus","totalPoints") VALUES
  ('upgrade-log-1','legacy-cycle-20',6.67,0,6.5),
  ('upgrade-log-2','legacy-cycle-override',13.33,0,14.5),
  ('upgrade-log-3','legacy-interval',13,0,13);
INSERT INTO public."WeeklyScore" (id,"userId","columnId","weekStart","weekNumber","totalPoints","runPoints","cyclePoints","updatedAt")
VALUES ('upgrade-week','upgrade-user','upgrade-column','2026-08-30',1,34,13,21,now());
INSERT INTO app_internal.operational_backup(id,format,version,payload,checksum_sha256,counts)
SELECT '00000000-0000-0000-0000-000000000001','kg-stay-active-operational-backup',7,
  jsonb_build_object('version',7,'activities',jsonb_agg(to_jsonb(a)-'runSegments' ORDER BY a.id)),
  'pending','{}'::jsonb FROM public."Activity" a;

CREATE TEMP TABLE upgrade_baseline AS SELECT
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public."Activity" a) AS activities,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public."PointsLog" p) AS logs,
  (SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM public."WeeklyScore" w) AS weekly,
  (SELECT to_jsonb(b) FROM app_internal.operational_backup b) AS archive,
  (SELECT jsonb_agg(jsonb_build_object('id',c.oid,'acl',c.relacl,'rls',c.relrowsecurity) ORDER BY c.oid)
    FROM pg_class c WHERE c.oid IN ('public."Activity"'::regclass,'public."PointsLog"'::regclass,'app_internal.operational_backup'::regclass)) AS access;
CREATE FUNCTION pg_temp.assert_true(ok boolean, description text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Upgrade check failed: %',description; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text, expected_constraint text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text; actual_constraint text;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE,actual_constraint=CONSTRAINT_NAME;
    IF actual_state <> expected_state OR (expected_constraint <> '' AND actual_constraint <> expected_constraint) THEN
      RAISE EXCEPTION 'Wrong rejection: expected % / %, got % / %',expected_state,expected_constraint,actual_state,actual_constraint;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected statement to be rejected: %',statement;
END $$;

-- Execute the exact reviewed files, without replacing or weakening any SQL.
${sqlFile('cycling-scoring-version.sql')}
${sqlFile('interval-run-backup.sql')}

SELECT pg_temp.assert_true(
  (SELECT jsonb_agg(to_jsonb(a)-'cycleScoringVersion' ORDER BY id) FROM public."Activity" a) = activities,
  'every pre-existing Activity field is unchanged') FROM upgrade_baseline;
SELECT pg_temp.assert_true((SELECT bool_and("cycleScoringVersion"=1) FROM public."Activity"), 'all old entries default to version 1');
SELECT pg_temp.assert_true((SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public."PointsLog" p)=logs,
  'every PointsLog field is unchanged') FROM upgrade_baseline;
SELECT pg_temp.assert_true((SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM public."WeeklyScore" w)=weekly,
  'every WeeklyScore field is unchanged') FROM upgrade_baseline;
SELECT pg_temp.assert_true((SELECT to_jsonb(b) FROM app_internal.operational_backup b)=archive,
  'existing archive is not rewritten') FROM upgrade_baseline;
SELECT pg_temp.assert_true((SELECT count(*)=3 AND bool_and(convalidated) FROM pg_constraint
  WHERE conrelid='public."Activity"'::regclass AND conname IN
    ('activity_cycle_scoring_version','activity_total_points_override_half_step','activity_run_segments_array')),
  'version, override and interval constraints are validated');
SELECT pg_temp.assert_true((SELECT a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='1'
  FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid='public."Activity"'::regclass AND a.attname='cycleScoringVersion'), 'column is NOT NULL with default 1');

-- Simulate old and new writers at the database boundary, not application flows.
INSERT INTO public."Activity" (id,"userId","columnId",category,distance,points,"weekStart","weekNumber","updatedAt")
VALUES ('old-writer','upgrade-user','upgrade-column','CYCLE',20,6.5,'2026-08-30',1,now());
INSERT INTO public."Activity" (id,"userId","columnId",category,distance,points,"totalPointsOverride","cycleScoringVersion","weekStart","weekNumber","updatedAt")
VALUES ('new-writer','upgrade-user','upgrade-column','CYCLE',20,9.6,9.6,2,'2026-08-30',1,now());
SELECT pg_temp.assert_true((SELECT "cycleScoringVersion"=1 FROM public."Activity" WHERE id='old-writer'), 'old writer receives version 1');
SELECT pg_temp.assert_true((SELECT "cycleScoringVersion"=2 AND "totalPointsOverride"=9.6 FROM public."Activity" WHERE id='new-writer'), 'new writer can save version 2 and tenths');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET "cycleScoringVersion"=3 WHERE id=''new-writer''','23514','activity_cycle_scoring_version');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET "cycleScoringVersion"=NULL WHERE id=''new-writer''','23502');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET "totalPointsOverride"=9.6 WHERE id=''old-writer''','23514','activity_total_points_override_half_step');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET "totalPointsOverride"=9.65 WHERE id=''new-writer''','23514','activity_total_points_override_half_step');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET category=''RUN'' WHERE id=''new-writer''','23514','activity_total_points_override_half_step');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET "runSegments"=''{}''::jsonb WHERE id=''legacy-interval''','23514','activity_run_segments_array');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET "runSegments"=''[]''::jsonb WHERE id=''legacy-interval''','23514','activity_run_segments_array');
SELECT pg_temp.expect_error('UPDATE public."Activity" SET category=''CYCLE'' WHERE id=''legacy-interval''','23514','activity_run_segments_array');

INSERT INTO app_internal.operational_backup(id,format,version,payload,checksum_sha256,counts)
SELECT '00000000-0000-0000-0000-000000000002','kg-stay-active-operational-backup',7,
  jsonb_build_object('version',7,'activities',jsonb_agg(to_jsonb(a)-'runSegments'-'cycleScoringVersion' ORDER BY a.id)),
  'pending','{}'::jsonb FROM public."Activity" a;
SELECT pg_temp.assert_true(checksum_sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex'), 'enriched snapshot checksum')
FROM app_internal.operational_backup WHERE id='00000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT count(*)=5 AND bool_and(
  item->'runSegments' IS NOT DISTINCT FROM coalesce(to_jsonb(a."runSegments"),'null'::jsonb)
  AND (item->>'cycleScoringVersion')::integer=a."cycleScoringVersion")
  FROM jsonb_array_elements(b.payload->'activities') item JOIN public."Activity" a ON a.id=item->>'id'),
  'snapshot retains all interval segments and both scoring versions')
FROM app_internal.operational_backup b WHERE id='00000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true(version=7 AND payload->'pointsLogs'=(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public."PointsLog" p),
  'existing v7 ledger enrichment is retained') FROM app_internal.operational_backup WHERE id='00000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT to_jsonb(b) FROM app_internal.operational_backup b WHERE id='00000000-0000-0000-0000-000000000001')=archive,
  'new snapshots do not alter old archives') FROM upgrade_baseline;
SELECT pg_temp.assert_true((SELECT jsonb_agg(jsonb_build_object('id',c.oid,'acl',c.relacl,'rls',c.relrowsecurity) ORDER BY c.oid)
  FROM pg_class c WHERE c.oid IN ('public."Activity"'::regclass,'public."PointsLog"'::regclass,'app_internal.operational_backup'::regclass))=access,
  'table privileges and RLS remain unchanged') FROM upgrade_baseline;
SELECT pg_temp.assert_true(NOT has_schema_privilege('anon','app_internal','USAGE')
  AND NOT has_schema_privilege('authenticated','app_internal','USAGE')
  AND NOT has_table_privilege('anon','app_internal.operational_backup','SELECT')
  AND NOT has_table_privilege('authenticated','app_internal.operational_backup','SELECT')
  AND NOT has_function_privilege('anon','app_internal.enrich_interval_segments_backup_v7()','EXECUTE')
  AND NOT has_function_privilege('authenticated','app_internal.enrich_interval_segments_backup_v7()','EXECUTE'),
  'private backup access is not broadened');
SELECT pg_temp.assert_true((SELECT NOT prosecdef AND NOT EXISTS (
    SELECT FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE')
  FROM pg_proc WHERE oid='app_internal.enrich_interval_segments_backup_v7()'::regprocedure),
  'new enrichment is invoker-only without PUBLIC execution');
-- Roll back synthetic fixtures, migration and any temporary client roles.
ROLLBACK;
`;
}

function main() {
  if (process.argv.slice(2).length) throw new Error('This rehearsal takes no command-line overrides.');
  assertUpgradeEnvironment(process.env);
  const schema = legacySchema();
  const sql = rehearsalSql();
  const container = process.env.PG_CONTAINER;
  const docker = args => execFileSync('docker', args, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
  assert.equal(docker(['inspect', '--format', '{{.Config.Image}}', container]), 'postgres:17', 'Expected the disposable PostgreSQL 17 service');
  assert.equal(docker(['inspect', '--format', '{{.State.Running}}', container]), 'true');
  // createdb fails if the database already exists; never reset a populated target.
  docker(['exec', container, 'createdb', '-U', 'postgres', DATABASE]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stay-active-upgrade-'));
  try {
    const schemaPath = path.join(directory, 'legacy.prisma');
    fs.writeFileSync(schemaPath, schema);
    execFileSync(process.execPath, [path.join(ROOT, 'node_modules/prisma/build/index.js'), 'db', 'push', '--schema', schemaPath, '--skip-generate'], {
      cwd: ROOT, stdio: 'inherit', env: { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL },
    });
    execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-d', DATABASE], {
      cwd: ROOT, input: sql, stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log('Populated legacy upgrade passed: exact feature SQL, unchanged old activities/ledger/weekly scores/archives, version defaults, override/interval constraints, private enriched backup and SHA-256. Synthetic transaction rolled back.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { assertUpgradeEnvironment, legacySchema, rehearsalSql };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
