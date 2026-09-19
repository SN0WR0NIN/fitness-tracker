const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { assertDisposableEnvironment } = require('./e2e-environment.cjs');

assertDisposableEnvironment();
const db = new PrismaClient();
async function main() {
  const seasons = await db.$queryRaw`SELECT "seasonKey", "status" FROM public."ChallengeSeason"`;
  assert.deepEqual(seasons, [{ seasonKey: '2026-09-01', status: 'ACTIVE' }]);
  await db.$queryRaw`SELECT "id" FROM public."WeekFinalization" LIMIT 1`;
  const guards = await db.$queryRaw`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
    AND tgname IN ('ActivityFinalizedWeekGuard','WeeklyScoreFinalizedWeekGuard','PointsLogFinalizedWeekGuard')`;
  assert.equal(guards.length, 3, 'All finalized-week guards must be installed');
  const secured = await db.$queryRaw`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ChallengeSeason','WeekFinalization') AND c.relrowsecurity`;
  assert.equal(secured.length, 2, 'Season tables must have row-level security enabled');
  console.log('E2E season schema, active seed and finalized-week guards verified.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
