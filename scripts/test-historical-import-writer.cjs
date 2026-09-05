const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { writeHistoricalImport } = require('../src/lib/historical-import-writer.ts');
const base = { name: "Athlete's name", column: 'Column 1', userId: 'athlete-1', columnId: 'column-1', createParticipant: true, category: 'RUN', distance: 5, points: 7.5, weekStart: new Date('2026-08-30T00:00:00Z'), occurredAt: new Date('2026-09-01T00:00:00Z'), weekNumber: 3 };
async function main() {
  const calls = [];
  const tx = {
    user: { createMany: async (input) => calls.push(['users', input]) },
    activity: { createMany: async (input) => calls.push(['activities', input]) },
    $executeRaw: async (input) => calls.push(['scores', input]),
  };
  // 500 activities, including repeated participants, categories and separate weeks.
  const rows = Array.from({ length: 498 }, (_, i) => ({ ...base, id: `activity-${i}` }));
  rows.push({ ...base, id: 'cycle', category: 'CYCLE', points: 4 });
  rows.push({ ...base, id: 'next-week', weekStart: new Date('2026-09-06T00:00:00Z'), weekNumber: 4, points: 10 });
  await writeHistoricalImport(tx, rows, 'reviewer');
  assert.deepEqual(calls.map(([name]) => name), ['users', 'activities', 'scores']);
  assert.equal(calls[0][1].data.length, 1);
  assert.equal(calls[0][1].data[0].name, base.name);
  assert.equal(calls[1][1].data.length, 500);
  assert.equal(calls[1][1].skipDuplicates, undefined);
  assert.ok(calls[1][1].data.every((a) => a.reviewedById === 'reviewer' && a.status === 'APPROVED'));
  const sql = calls[2][1];
  assert.equal(sql.values.length, 22);
  assert.deepEqual(sql.values.slice(4, 11), [3, 3739, 3735, 4, 0, 0, 0]);
  assert.deepEqual(sql.values.slice(15, 22), [4, 10, 10, 0, 0, 0, 0]);
  assert.ok(sql.text.includes('ON CONFLICT ("userId", "weekStart") DO UPDATE'));
  assert.ok(!sql.text.includes(base.userId));
  calls.length = 0;
  await writeHistoricalImport(tx, [], 'reviewer');
  assert.equal(calls.length, 0);
  await writeHistoricalImport(tx, [{ ...base, id: 'existing-user', createParticipant: false }], 'reviewer');
  assert.deepEqual(calls.map(([name]) => name), ['activities', 'scores']);
  calls.length = 0;
  tx.activity.createMany = async () => { throw Object.assign(new Error('conflict'), { code: 'P2002' }); };
  await assert.rejects(writeHistoricalImport(tx, [{ ...base, id: 'conflict' }], 'reviewer'), { code: 'P2002' });
  assert.ok(!calls.some(([name]) => name === 'scores'));
  console.log('Bulk import: 500 rows in three writes, grouped scores, existing users, empty selection and conflict propagation passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
