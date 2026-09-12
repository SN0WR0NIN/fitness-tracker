#!/usr/bin/env node
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const dbUrl = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || process.env.VERCEL || process.env.VERCEL_ENV || dbUrl.hostname !== '127.0.0.1' || dbUrl.pathname !== '/fitness_tracker_e2e') throw new Error('Disposable CI database required.');
const db = new PrismaClient();
async function main() {
  const fixture = JSON.parse(fs.readFileSync('/tmp/kg-hardening-fixture.json','utf8'));
  const id = randomUUID();
  const done = new Error('EXPECTED_ROLLBACK');
  let valid = false;
  try {
    await db.$transaction(async tx => {
      const activityId = fixture.activities?.[0]?.id;
      if (!activityId || !(await tx.activity.findUnique({ where: { id: activityId } }))) throw new Error('Fixture activity unavailable for backup check');
      const owner = await tx.activity.findUniqueOrThrow({ where: { id: activityId }, select: { userId: true } });
      const proofs = [
        `https://example.invalid/e2e-proof/${owner.userId}/backup-a.png`,
        `https://example.invalid/e2e-proof/${owner.userId}/backup-b.png`,
      ];
      await tx.activity.update({ where: { id: activityId }, data: { basePointsOverride: 1.25, totalPointsOverride: 1.5, proofUrl: proofs[0], proofUrls: proofs } });
      await tx.$executeRaw`INSERT INTO app_internal.operational_backup(id,format,version,payload,checksum_sha256,counts) VALUES (${id}::uuid,'kg-stay-active-operational-backup',6,${JSON.stringify({...fixture,version:6})}::jsonb,'pending','{}'::jsonb)`;
      const expected = JSON.stringify([{ id: activityId, basePointsOverride: 1.25, totalPointsOverride: 1.5, proofUrl: proofs[0], proofUrls: proofs }]);
      const rows = await tx.$queryRaw`SELECT version,
        checksum_sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex') AS checksum,
        (payload->'pointsLogs')=coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM "PointsLog" p),'[]'::jsonb) AS logs,
        (counts->>'pointsLogs')::int AS log_count,
        payload->'activities' @> ${expected}::jsonb AS activity_fields,
        (SELECT value FROM jsonb_array_elements(payload->'activities') value WHERE value->>'id'=${activityId} LIMIT 1) AS backed_activity
        FROM app_internal.operational_backup WHERE id=${id}::uuid`;
      const count = await tx.pointsLog.count();
      const row = rows[0];
      const checks = {
        version: row?.version === 7,
        checksum: Boolean(row?.checksum),
        pointsLogs: Boolean(row?.logs),
        pointsLogCount: row?.log_count === count,
        activityFields: Boolean(row?.activity_fields),
      };
      if (!Object.values(checks).every(Boolean)) {
        console.error(JSON.stringify({ checks, observed: row, expectedActivity: JSON.parse(expected)[0], expectedPointsLogCount: count }, null, 2));
        throw new Error('v7 snapshot check failed');
      }
      valid = true;
      throw done;
    });
  } catch (e) { if (e !== done) throw e; }
  if (!valid || (await db.$queryRaw`SELECT id FROM app_internal.operational_backup WHERE id=${id}::uuid`).length) throw new Error('Snapshot rollback verification failed');
  console.log('Scheduled v7 enrichment, PointsLog equality, score overrides, multiple proofs, SHA-256 and rollback verified in CI.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
