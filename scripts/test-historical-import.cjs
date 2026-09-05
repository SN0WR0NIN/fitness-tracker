const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Run the shared TypeScript logic without adding a production test dependency.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { ImportSchema, prepareRow, participantKey, placeholderId } = require('../src/lib/historical-import.ts');
const { DEFAULT_SCORING_RULES } = require('../src/lib/scoring.ts');
const row = { name: 'Athlete', column: 'Column 1', occurredAt: '2026-09-04T12:00:00+08:00', category: 'RUN', distance: 5, pace: 6.5 };
const rules = DEFAULT_SCORING_RULES;
const start = new Date('2026-08-16T00:00:00Z');
assert.equal(prepareRow(row, rules, start).points, 7.5);
assert.equal(prepareRow({ ...row, companion: 'Friend' }, rules, start).points, 10.5);
assert.equal(prepareRow({ ...row, category: 'SWIM', distance: 1000 }, rules, start).points, 10);
assert.equal(prepareRow({ ...row, pace: 10, distance: 4 }, rules, start).points, 0);
assert.equal(prepareRow({ ...row, category: 'TROOP_GAMES', distance: 0 }, rules, start).points, 5);
assert.equal(prepareRow({ ...row, occurredAt: '2026-09-04T04:00:00Z' }, rules, start).id, prepareRow(row, rules, start).id);
assert.equal(participantKey({ ...row, name: ' Athlete  ' }), participantKey(row));
assert.notEqual(placeholderId(participantKey(row)), placeholderId(participantKey({ ...row, column: 'Column 2' })));
assert.equal(ImportSchema.safeParse({ rows: [{ ...row, proofUrl: 'javascript:alert(1)' }], mappings: {} }).success, false);
assert.equal(ImportSchema.safeParse({ rows: [{ ...row, distance: -1 }], mappings: {} }).success, false);
if (process.argv[2]) {
  const file = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const data = ImportSchema.parse({ rows: file.rows, mappings: {} });
  assert.equal(data.rows.length, 61);
  assert.equal(new Set(data.rows.map(participantKey)).size, 29);
  assert.equal(data.rows.some((row) => row.name.toUpperCase() === 'TEST'), false);
  const prepared = data.rows.map((row) => prepareRow(row, rules, start));
  assert.equal(new Set(prepared.map((row) => row.id)).size, 61);
  console.log(`Validated ${prepared.length} rows; default-rule estimate: ${prepared.reduce((sum, row) => sum + row.points, 0)} points. Live settings are applied at preview time.`);
}
console.log('Historical import validation and scoring checks passed.');
