const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('bounded scoring retries recognize Prisma wrapped SQLSTATEs without retrying unrelated errors', () => {
  const source = readFileSync(path.join(__dirname, '../src/lib/scoring-conflicts.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exported = {};
  vm.runInNewContext(outputText, { exports: exported });
  const check = exported.isRetryableScoringConflict;
  expect(check({ code: 'P2034' })).toBe(true);
  for (const state of ['40001', '40P01']) {
    expect(check({ code: 'P2010', meta: { code: state } })).toBe(true);
    const wrapped = new Error(`ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "${state}", message: "deadlock detected", severity: "ERROR" }), transient: false })`);
    wrapped.name = 'PrismaClientUnknownRequestError';
    expect(check(wrapped)).toBe(true);
  }
  for (const unrelated of [null, undefined, '40P01', { code: 'P2002' }, { code: 'P2028' },
    { code: 'P2010', meta: { code: '23514' } }, new Error('deadlock detected'),
    new Error('PostgresError { code: "40P01" }'),
    { name: 'PrismaClientUnknownRequestError', message: 'PostgresError { code: "23503" }' }]) {
    expect(check(unrelated)).toBe(false);
  }
});
