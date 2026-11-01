const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { assertDisposableEnvironment } = require('../../scripts/e2e-environment.cjs');

// Load unchanged auth modules against the synthetic CI database. Only this
// function's lexical fetch/process are replaced; neither the app server nor the
// test process receives a real mail key, a fetch override, or an auth bypass.
function resetFixture(prisma, { now = Date.now() } = {}) {
  assertDisposableEnvironment();
  assert.equal(process.env.NEXTAUTH_SECRET, 'e2e-nextauth-secret-only-for-ci');
  const emails = [];
  const modules = new Map();
  const root = path.resolve(__dirname, '../..');
  const allowed = new Set(['email-password-reset', 'password-reset', 'account-credentials']);
  const testProcess = { env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: 'http://127.0.0.1:3000',
    RESEND_API_KEY: 'e2e-captured-transport-not-a-real-key',
  } };
  class FixtureDate extends Date { static now() { return now; } }
  const captureMail = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${testProcess.env.RESEND_API_KEY}`);
    const email = JSON.parse(options.body);
    assert.deepEqual(email.to, ['reset-e2e@example.test']);
    emails.push(email);
    return { ok: true, json: async () => ({ id: 'synthetic-captured-email' }) };
  };
  function load(name) {
    assert.ok(allowed.has(name), `Unexpected auth fixture module: ${name}`);
    if (modules.has(name)) return modules.get(name).exports;
    const filename = path.join(root, 'src/lib', `${name}.ts`);
    const sourceRequire = createRequire(filename);
    const localRequire = id => {
      if (id === '@/lib/prisma' || id === './prisma') return { prisma };
      if (id.startsWith('@/lib/')) return load(id.slice('@/lib/'.length));
      if (id.startsWith('./')) return load(id.slice(2));
      assert.ok(['node:crypto', 'bcryptjs', 'zod'].includes(id), `Unexpected fixture dependency: ${id}`);
      return sourceRequire(id);
    };
    const loaded = { exports: {} };
    modules.set(name, loaded);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    new Function('exports', 'require', 'module', 'fetch', 'process', 'Date', compiled.outputText)(
      loaded.exports, localRequire, loaded, captureMail, testProcess, FixtureDate,
    );
    return loaded.exports;
  }
  return { emails, email: load('email-password-reset'), manual: load('password-reset') };
}

function resetLink(email) {
  const match = email.text.match(/https?:\/\/[^\s]+\/auth\/reset-password\?token=[^\s]+/);
  assert.ok(match, 'The real email helper must emit its reset link');
  return new URL(match[0]);
}

module.exports = { resetFixture, resetLink };
