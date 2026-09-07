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
  // A rollback-only test verifies the installed final enrichment trigger.
  // Its ledger collection must reflect the CURRENT source database snapshot,
  // not a supplied snapshot's potentially outdated point-log array.
  const done = new Error('EXPECTED_ROLLBACK');
  let valid=false;
  try { await db.$transaction(async tx=>{
    await tx.$executeRaw`INSERT INTO app_internal.operational_backup(id,format,version,payload,checksum_sha256,counts) VALUES (${id}::uuid,'kg-stay-active-operational-backup',6,${JSON.stringify({...fixture,version:6})}::jsonb,'pending','{}'::jsonb)`;
    const rows = await tx.$queryRaw`SELECT version,checksum_sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex') AS checksum,(payload->'pointsLogs') = coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM "PointsLog" p),'[]'::jsonb) AS logs, (counts->>'pointsLogs')::int AS log_count FROM app_internal.operational_backup WHERE id=${id}::uuid`;
    const count = await tx.pointsLog.count();
    if (rows[0]?.version!==7 || !rows[0]?.checksum || !rows[0]?.logs || rows[0]?.log_count!==count) throw new Error('v7 snapshot check failed');
    valid=true;throw done;
  }); } catch(e) { if(e!==done) throw e; }
  if (!valid || (await db.$queryRaw`SELECT id FROM app_internal.operational_backup WHERE id=${id}::uuid`).length) throw new Error('Snapshot rollback verification failed');
  console.log('Scheduled v7 enrichment, PointsLog equality, SHA-256 and rollback verified in CI.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
