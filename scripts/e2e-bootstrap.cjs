#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const password = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Column" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true');

  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChallengeSetting" (
    "id" TEXT PRIMARY KEY,
    "challengeName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "weeklyGoal" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "scoringRules" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'New activity submissions are temporarily paused.'
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AdminAudit" (
    "id" TEXT PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RankingSnapshot" (
    "id" TEXT PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("scope", "periodKey", "entityId", "snapshotDate")
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserProfileSettings" (
    "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
    "weeklyGoal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bio" TEXT NOT NULL DEFAULT '',
    "profilePhotoUrl" TEXT
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("userId", "weekStart")
  )`);

  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS app_internal');
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS app_internal.system_health_check (
    id UUID PRIMARY KEY,
    status TEXT NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS app_internal.operational_backup (
    id UUID PRIMARY KEY,
    format TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    counts JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS app_internal.duplicate_review_decision (
    pair_key TEXT PRIMARY KEY,
    activity_a_id TEXT NOT NULL REFERENCES "Activity"(id) ON DELETE CASCADE,
    activity_b_id TEXT NOT NULL REFERENCES "Activity"(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('DIFFERENT','DUPLICATE','LATER')),
    duplicate_activity_id TEXT REFERENCES "Activity"(id) ON DELETE SET NULL,
    kept_activity_id TEXT REFERENCES "Activity"(id) ON DELETE SET NULL,
    note TEXT,
    reviewed_by_id TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    reviewed_by_name TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS app_internal.weekly_result (
    season_key TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    challenge_name TEXT NOT NULL,
    week_start_key DATE NOT NULL,
    display_start_date DATE NOT NULL,
    display_end_date DATE NOT NULL,
    total_points DOUBLE PRECISION NOT NULL DEFAULT 0,
    activity_count INTEGER NOT NULL DEFAULT 0,
    active_athletes INTEGER NOT NULL DEFAULT 0,
    awards JSONB NOT NULL DEFAULT '[]'::jsonb,
    athlete_standings JSONB NOT NULL DEFAULT '[]'::jsonb,
    column_standings JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (season_key, week_number)
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS app_internal.notification (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    level TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    href TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    dedupe_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const hash = await bcrypt.hash(password, 10);
  await prisma.column.upsert({
    where: { name: 'E2E Column' },
    update: {},
    create: { id: 'e2e_column', name: 'E2E Column' },
  });
  await prisma.$executeRawUnsafe('UPDATE "Column" SET "isActive"=true WHERE "id"=$1', 'e2e_column');

  await prisma.user.upsert({
    where: { email: 'member-e2e@example.test' },
    update: { password: hash, role: 'MEMBER', columnId: 'e2e_column', mustChangePassword: false },
    create: {
      id: 'e2e_member', name: 'E2E Member', email: 'member-e2e@example.test', username: 'e2e-member',
      password: hash, role: 'MEMBER', columnId: 'e2e_column', mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin-e2e@example.test' },
    update: { password: hash, role: 'ADMIN', columnId: 'e2e_column', mustChangePassword: false },
    create: {
      id: 'e2e_admin', name: 'E2E Admin', email: 'admin-e2e@example.test', username: 'e2e-admin',
      password: hash, role: 'ADMIN', columnId: 'e2e_column', mustChangePassword: false,
    },
  });

  await prisma.$executeRawUnsafe(`INSERT INTO "ChallengeSetting"
    ("id","challengeName","startDate","endDate","weeklyGoal","scoringRules","maintenanceMode","maintenanceMessage")
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,false,$7)
    ON CONFLICT ("id") DO UPDATE SET
      "challengeName"=EXCLUDED."challengeName", "startDate"=EXCLUDED."startDate", "endDate"=EXCLUDED."endDate",
      "weeklyGoal"=EXCLUDED."weeklyGoal", "scoringRules"=EXCLUDED."scoringRules", "maintenanceMode"=false`,
    'primary', 'E2E Stay Active', new Date('2026-09-01T00:00:00Z'), new Date('2026-12-31T23:59:59Z'), 25, '{}', 'E2E maintenance');

  const e2eAwards = [{ type: 'TOP_ATHLETE', label: 'Top Athlete', emoji: '🥇', entityType: 'USER', entityId: 'e2e_member', entityName: 'E2E Member', value: 50, displayValue: '50.0 pts' }];
  const e2eAthletes = [{ userId: 'e2e_member', name: 'E2E Member', rank: 1, points: 50, activityCount: 3, runPoints: 50, cyclePoints: 0, swimPoints: 0, hikePoints: 0, troopGamePoints: 0, goalTarget: 25, goalCompletionPct: 200 }];
  const e2eColumns = [{ columnId: 'e2e_column', name: 'E2E Column', rank: 1, points: 50, activityCount: 3, activeAthletes: 1 }];
  await prisma.$executeRawUnsafe(`INSERT INTO app_internal.weekly_result
    (season_key,week_number,challenge_name,week_start_key,display_start_date,display_end_date,total_points,activity_count,active_athletes,awards,athlete_standings,column_standings)
    VALUES ('2026-09-01',1,'E2E Stay Active','2026-08-30','2026-09-01','2026-09-05',50,3,1,$1::jsonb,$2::jsonb,$3::jsonb)
    ON CONFLICT (season_key,week_number) DO UPDATE SET awards=EXCLUDED.awards, athlete_standings=EXCLUDED.athlete_standings, column_standings=EXCLUDED.column_standings, updated_at=NOW()`,
    JSON.stringify(e2eAwards), JSON.stringify(e2eAthletes), JSON.stringify(e2eColumns));
  await prisma.$executeRawUnsafe(`INSERT INTO app_internal.notification
    (id,user_id,kind,level,title,message,href,metadata,dedupe_key)
    VALUES ('00000000-0000-0000-0000-000000000003','e2e_member','WEEKLY_AWARD','success','🥇 Top Athlete','You earned Top Athlete for Week 1 with 50.0 pts.','/results',$1::jsonb,'e2e-weekly-award')
    ON CONFLICT (dedupe_key) DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,created_at=NOW()`,
    JSON.stringify({ seasonKey: '2026-09-01', weekNumber: 1 }));

  await prisma.$executeRawUnsafe(`INSERT INTO app_internal.system_health_check (id,status,details)
    VALUES ('00000000-0000-0000-0000-000000000001','HEALTHY',$1::jsonb)
    ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, details=EXCLUDED.details, created_at=NOW()`, JSON.stringify({
      users: 2, activities: 0, pending: 0, approved: 0, rejected: 0,
      score_mismatches: 0, negative_scores: 0, orphan_activity_users: 0, orphan_activity_columns: 0,
      duplicate_proof_groups: 0, duplicate_strava_groups: 0, approved_without_reviewer: 0,
      rejected_without_reason: 0, outside_challenge_window: 0, possible_duplicate_pairs: 0,
      open_duplicate_pairs: 0, deferred_duplicate_pairs: 0,
      latest_backup_at: new Date().toISOString(), checked_at: new Date().toISOString(),
    }));
  await prisma.$executeRawUnsafe(`INSERT INTO app_internal.operational_backup
    (id,format,version,payload,checksum_sha256,counts)
    VALUES ('00000000-0000-0000-0000-000000000002','kg-stay-active-operational-backup',4,$1::jsonb,'e2e-checksum', $2::jsonb)
    ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, counts=EXCLUDED.counts, version=4, created_at=NOW()`,
    JSON.stringify({ format: 'kg-stay-active-operational-backup', version: 4, exportedAt: new Date().toISOString(), users: [], activities: [], duplicateReviews: [], weeklyResults: [], notifications: [] }),
    JSON.stringify({ users: 2, activities: 0, weeklyScores: 0, profileSettings: 0, weeklyGoals: 0, rankingSnapshots: 0, duplicateReviews: 0, weeklyResults: 1, notifications: 1 }));

  console.log('E2E database bootstrapped.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
