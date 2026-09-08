#!/usr/bin/env node
'use strict';
// Deliberately NOT a production restore command. It only writes to a newly
// provisioned, empty, loopback CI database with a fixed name and confirmation.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const tables = {
  columns: 'public."Column"', users: 'public."User"', challenge: 'public."ChallengeSetting"',
  activities: 'public."Activity"', pointsLogs: 'public."PointsLog"', weeklyScores: 'public."WeeklyScore"',
  profileSettings: 'public."UserProfileSettings"', weeklyGoals: 'public."WeeklyGoal"',
  rankingSnapshots: 'public."RankingSnapshot"', announcements: 'public."Announcement"', audit: 'public."AdminAudit"',
  duplicateReviews: 'app_internal.duplicate_review_decision', weeklyResults: 'app_internal.weekly_result',
  notifications: 'app_internal.notification', passwordResetRequests: 'app_internal.password_reset_request',
  activityCorrections: 'app_internal.activity_correction', notificationPreferences: 'app_internal.notification_preference',
  achievementDefinitions: 'app_internal.achievement_definition', userAchievements: 'app_internal.user_achievement',
  weeklyResultRebuilds: 'app_internal.weekly_result_dirty',
};
function assertDisposable(env, confirmation) {
  const target = new URL(env.DRILL_TARGET_DATABASE_URL || 'http://invalid');
  if (confirmation !== '--confirm-disposable' || env.CI !== 'true' || env.E2E_TEST_MODE !== '1'
    || env.VERCEL || env.VERCEL_ENV || target.protocol !== 'postgresql:'
    || target.hostname !== '127.0.0.1' || target.pathname !== '/fitness_tracker_restore_drill'
    || target.search || target.hash || env.DRILL_TARGET_DATABASE_URL === env.DATABASE_URL) {
    throw new Error('Refusing restore: dedicated empty loopback CI drill database required.');
  }
  return target.toString();
}
const quote = key => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new Error('Invalid backup field name.');
  return `"${key}"`;
};
let phase = 'destination-precheck';
async function restore(input, confirmation) {
  const target = assertDisposable(process.env, confirmation);
  phase = 'fixture-validation';
  const validation = spawnSync(process.execPath, [path.join(__dirname, 'validate-operational-backup.cjs'), input], { encoding: 'utf8' });
  if (validation.status !== 0) throw new Error('Backup validator rejected the fixture.');
  const backup = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (backup.version !== 7 || !backup.users.every(u => u.email?.endsWith('@example.test'))) throw new Error('Only synthetic version-7 example.test fixtures are accepted by this drill.');
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: target } } });
  try {
    phase = 'empty-destination-verification';
    const result = await db.$transaction(async tx => {
      const identity = await tx.$queryRaw`SELECT current_database() AS name`;
      if (identity[0]?.name !== 'fitness_tracker_restore_drill') throw new Error('Unexpected destination database.');
      // Any row in any application table aborts. This tool never erases a target.
      const all = await tx.$queryRaw`SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public','app_internal')`;
      for (const table of all) {
        const full = `${quote(table.schemaname)}.${quote(table.tablename)}`;
        const rows = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${full}`);
        if (rows[0].n !== 0) throw new Error('Destination is not empty; refusing to overwrite.');
      }
      // Disable USER triggers only in this isolated destination, inside the
      // rollbackable transaction; foreign-key/check constraints stay active.
      // Historical achievement/notification state is restored, not regenerated.
      phase = 'isolated-trigger-suspension';
      for (const table of Object.values(tables)) await tx.$executeRawUnsafe(`ALTER TABLE ${table} DISABLE TRIGGER USER`);
      const expectedCounts = {};
      for (const [key, table] of Object.entries(tables)) {
        phase = `restore-${key}`;
        const rows = key === 'challenge' ? [backup.challenge] : backup[key];
        if (!Array.isArray(rows)) throw new Error(`Missing fixture collection ${key}.`);
        const columns = await tx.$queryRawUnsafe(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped`, table);
        const allowed = new Set(columns.map(c => c.attname));
        for (const source of rows) {
          const row = { ...source };
          if (key === 'users') {
            // No restored credentials or live sessions. A valid bcrypt hash of
            // an unrecorded random password makes restored accounts unusable.
            row.password = require('bcryptjs').hashSync(randomBytes(32).toString('hex'), 4);
            row.mustChangePassword = true; row.sessionVersion = 1;
          }
          if (key === 'challenge') { row.maintenanceMode = true; row.readOnlyMode = true; }
          const keys = Object.keys(row);
          if (keys.some(k => !allowed.has(k))) throw new Error(`Unknown field in ${key}.`);
          const names = keys.map(quote).join(',');
          // Identifiers come only from the fixed table list and checked schema;
          // all row values are a JSON parameter, never executable input.
          await tx.$executeRawUnsafe(`INSERT INTO ${table} (${names}) SELECT ${names} FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, JSON.stringify(row));
          const equality = await tx.$queryRawUnsafe(`SELECT EXISTS (SELECT ${names} FROM ${table} INTERSECT SELECT ${names} FROM jsonb_populate_record(NULL::${table},$1::jsonb)) AS same`, JSON.stringify(row));
          if (!equality[0]?.same) throw new Error(`Restored row mismatch in ${key}.`);
        }
        const count = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${table}`);
        if (count[0].n !== rows.length) throw new Error(`Restored count mismatch in ${key}.`);
        expectedCounts[key] = rows.length;
      }
      phase = 'isolated-trigger-restoration';
      for (const table of Object.values(tables)) await tx.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE TRIGGER USER`);
      return { restored: true, syntheticOnly: true, collections: expectedCounts, accountsLocked: true, operatingModesLocked: true, binaryMediaRestored: false };
    }, { isolationLevel: 'Serializable', timeout: 60000, maxWait: 5000 });
    // Fresh transaction, not just in-transaction assertions.
    phase = 'post-commit-verification';
    const persisted = await db.$queryRaw`SELECT (SELECT count(*)::int FROM "Activity") AS activities,(SELECT count(*)::int FROM "PointsLog") AS logs,(SELECT count(*)::int FROM "User" WHERE NOT "mustChangePassword") AS unlocked_users`;
    if (persisted[0].activities !== result.collections.activities || persisted[0].logs !== result.collections.pointsLogs || persisted[0].unlocked_users !== 0) throw new Error('Post-commit verification failed.');
    console.log(JSON.stringify({ ...result, postCommitVerified: true }));
  } finally { await db.$disconnect(); }
}
module.exports = { assertDisposable };
if (require.main === module) restore(process.argv[2], process.argv[3]).catch(() => { console.error(`Restore drill failed or refused at ${phase}. Destination must be inspected; do not automatically retry or erase it.`); process.exitCode = 1; });
