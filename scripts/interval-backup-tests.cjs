#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS regression runner. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { validateRunSegments } = require('./validate-backup-run-segments.cjs');
const segments = [{ kind: 'WORK', distance: 4, pace: 4.5 }, { kind: 'RECOVERY', distance: 2, pace: 9 }];
const activity = { id: 'activity', userId: 'user', columnId: 'column', category: 'RUN', status: 'APPROVED', distance: 6, pace: 6, points: 13, runSegments: segments };
const errorsFor = row => { const errors = []; validateRunSegments(row, (ok, error) => { if (!ok) errors.push(error); }); return errors; };
assert.deepEqual(errorsFor(activity), []);
for (const runSegments of [undefined, null]) assert.deepEqual(errorsFor({ ...activity, runSegments }), []);
for (const runSegments of [[], segments.slice(0, 1), Array(21).fill(segments[0]), 'invalid', [null, segments[1]], [{ ...segments[0], kind: 'OTHER' }, segments[1]], [{ ...segments[0], distance: 0 }, segments[1]], [{ ...segments[0], pace: 61 }, segments[1]], [{ ...segments[0], pace: Infinity }, segments[1]]]) assert.ok(errorsFor({ ...activity, runSegments }).length);
// Keep totals internally consistent so these assert schema rules, not summary mismatch.
for (const kind of ['WORK', 'RECOVERY']) assert.ok(errorsFor({ ...activity, runSegments: segments.map(segment => ({ ...segment, kind })) }).length);
const maxSegments = [{ kind: 'WORK', distance: 1000, pace: 6 }, { kind: 'RECOVERY', distance: 2, pace: 6 }];
assert.deepEqual(errorsFor({ ...activity, distance: 1002, pace: 6, runSegments: maxSegments }), []);
assert.ok(errorsFor({ ...activity, distance: 1003, pace: 6, runSegments: [{ ...maxSegments[0], distance: 1001 }, maxSegments[1]] }).length);
for (const change of [{ category: 'CYCLE' }, { distance: 7 }, { pace: 5 }, { distance: null }]) assert.ok(errorsFor({ ...activity, ...change }).length);
const fixture = {
  format: 'kg-stay-active-operational-backup', version: 7, exportedAt: '2026-09-01T00:00:00Z', challenge: {},
  columns: [{ id: 'column' }], users: [{ id: 'user', email: 'synthetic@example.test' }], activities: [activity],
  pointsLogs: [{ id: 'log', activityId: 'activity', basePoints: 13, friendBonus: 0, totalPoints: 13, createdAt: '2026-09-01T00:00:00Z' }],
  weeklyScores: [], announcements: [], audit: [], activityCorrections: [], notificationPreferences: [], achievementDefinitions: [], userAchievements: [], weeklyResultRebuilds: [],
};
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'interval-backup-test-'));
try {
  function checkArchive(value, expected) {
    const file = path.join(temporary, 'fixture.json');
    fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
    const result = spawnSync(process.execPath, [path.join(__dirname, 'validate-operational-backup.cjs'), file], { encoding: 'utf8' });
    assert.equal(result.status, expected, result.stderr);
  }
  checkArchive(fixture, 0);
  for (const cycleScoringVersion of [1, 2]) checkArchive({ ...fixture, activities: [{ ...activity, cycleScoringVersion }] }, 0);
  for (const cycleScoringVersion of [0, 3, null, '2']) checkArchive({ ...fixture, activities: [{ ...activity, cycleScoringVersion }] }, 1);
  checkArchive({ ...fixture, activities: [{ ...activity, runSegments: undefined }] }, 0);
  checkArchive({ ...fixture, activities: [{ ...activity, runSegments: null }] }, 0);
  checkArchive({ ...fixture, activities: [{ ...activity, runSegments: [{ ...segments[0], pace: 0 }, segments[1]] }] }, 1);
  const correction = { id: 'correction', user_id: 'user', activity_id: 'activity', status: 'OPEN', original: activity, proposed: activity };
  checkArchive({ ...fixture, activityCorrections: [correction] }, 0);
  checkArchive({ ...fixture, activityCorrections: [{ ...correction, proposed: { ...activity, distance: 7 } }] }, 1);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
// Exercise the actual export function with a read-only transaction double.
async function testExport() {
  const queries = [];
  const tx = {
    $executeRawUnsafe: async sql => assert.equal(sql, 'SET TRANSACTION READ ONLY'),
    $queryRaw: async () => [{ id: 'primary' }],
    $queryRawUnsafe: async sql => { queries.push(sql); return sql.includes('FROM public."Activity"') ? [activity] : []; },
  };
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/operational-backup.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', source)(id => {
    assert.equal(id, '@/lib/prisma');
    return { prisma: { $transaction: async (callback, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return callback(tx); } } };
  }, loaded.exports, loaded);
  const backup = await loaded.exports.captureOperationalBackup();
  assert.match(queries.find(sql => sql.includes('FROM public."Activity"')), /"runSegments"/);
  assert.deepEqual(backup.activities[0].runSegments, segments);
  assert.match(queries.find(sql => sql.includes('FROM public."Activity"')), /"cycleScoringVersion"/);
  assert.equal(backup.counts.activities, 1);
  assert.ok(backup.excludes.includes('passwords'));
  assert.doesNotMatch(queries.join('\n'), /stravaAccessToken|stravaRefreshToken|SELECT \* FROM public\."User"/);
}
testExport().then(() => console.log('Interval backup validation, legacy compatibility, correction snapshots and read-only export passed.')).catch(error => { console.error(error); process.exitCode = 1; });
