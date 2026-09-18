#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const loadedModules = new Map();
function moduleFrom(file) {
  const filename = path.resolve(file);
  if (loadedModules.has(filename)) return loadedModules.get(filename).exports;
  const m = { exports: {} };
  loadedModules.set(filename, m);
  const sourceRequire = createRequire(filename);
  const localRequire = (id) => {
    // Resolve imports relative to the source module, not this test script.
    // Transpile sibling TypeScript too, e.g. score-explanation -> scoring.
    if (id.startsWith('.')) {
      const dependency = path.resolve(path.dirname(filename), id);
      const candidate = dependency.endsWith('.ts') ? dependency : `${dependency}.ts`;
      if (fs.existsSync(candidate)) return moduleFrom(candidate);
    }
    return sourceRequire(id);
  };
  try {
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    new Function('exports','require','module','__filename','__dirname',result.outputText)(m.exports,localRequire,m,filename,path.dirname(filename));
    return m.exports;
  } catch (error) {
    loadedModules.delete(filename);
    throw error;
  }
}
const { parseProofReference: parse, proofDisplayHref } = moduleFrom('src/lib/proof-reference.ts');
const { explainScore } = moduleFrom('src/lib/score-explanation.ts');
const { calculateActivityPoints, hasPositiveBaseScore, roundScoreDown } = moduleFrom('src/lib/scoring.ts');
const origin = 'https://fixture.supabase.co';
const valid = `${origin}/storage/v1/object/public/activity-proofs/owner/image.png`;
assert.equal(parse(valid,origin).path, 'owner/image.png');
for (const bad of [valid+'?token=x',valid+'#x',valid.replace('fixture.supabase.co','fixture.supabase.co.evil.test'),valid.replace('/owner/','/owner/%2e%2e/'),valid.replace('/owner/','/owner%2fother/'),'http://127.0.0.1/private','https://user:pass@fixture.supabase.co/storage/v1/object/public/activity-proofs/a/b']) assert.equal(parse(bad,origin),null);
assert.equal(parse('https://drive.google.com/file/d/fixtureID/view',origin).kind,'external');
assert.equal(parse('https://drive.google.com.evil.test/file/d/fixtureID/view',origin),null);
assert.equal(parse('https://example.invalid/e2e-proof/a/b',origin),null);
assert.ok(proofDisplayHref(valid).startsWith('/api/proofs?ref='));
assert.equal(roundScoreDown(7.99),7.5);
assert.equal(roundScoreDown(7.5),7.5);
assert.equal(roundScoreDown(7.01),7);
assert.equal(roundScoreDown(8),8);
assert.equal(roundScoreDown(0.99),0.5);
assert.equal(calculateActivityPoints({category:'CYCLE',distance:10}).totalPoints,3);
assert.equal(calculateActivityPoints({category:'CYCLE',distance:10,completedWithFriend:true}).totalPoints,6);
assert.equal(calculateActivityPoints({category:'SWIM',distance:175}).totalPoints,1.5);
assert.equal(calculateActivityPoints({category:'RUN',distance:3.1,pace:6}).totalPoints,4.5);
assert.equal(calculateActivityPoints({category:'RUN',distance:5,pace:9}).totalPoints,7.5);
assert.equal(calculateActivityPoints({category:'RUN',distance:5,pace:9.01}).basePoints,5);
assert.equal(calculateActivityPoints({category:'RUN',distance:5,pace:9.01}).totalPoints,5);
assert.equal(hasPositiveBaseScore({category:'RUN',distance:0.001,pace:6}),true);
assert.equal(calculateActivityPoints({category:'RUN',distance:0.001,pace:6}).totalPoints,0);
assert.equal(calculateActivityPoints({category:'RUN',distance:0.001,pace:6,completedWithFriend:true}).friendBonus,3);
assert.equal(calculateActivityPoints({category:'RUN',distance:0.001,pace:6,completedWithFriend:true}).totalPoints,3);
assert.equal(hasPositiveBaseScore({category:'WALK_OR_HIKE',distance:2}),false);
const base = { category:'RUN',status:'APPROVED',points:3.5,completedWithFriend:true,pointsLog:{basePoints:0,friendBonus:3,totalPoints:3.5} };
assert.match(explainScore(base).message, /\+3 friend bonus applied/);
assert.match(explainScore({...base,status:'PENDING'}).status,/not included/);
assert.match(explainScore({...base,status:'REJECTED',points:0.5,pointsLog:{basePoints:0,friendBonus:0,totalPoints:0.5}}).message,/No friend bonus/);
assert.match(explainScore({...base,points:7.5,pointsLog:{basePoints:7.5,friendBonus:0,totalPoints:7.5}}).message,/No friend bonus allocated/);
assert.equal(explainScore({...base,points:9}).breakdown,null);
const { assertDisposable } = require('./restore-operational-drill.cjs');
const env = { CI:'true',E2E_TEST_MODE:'1',DRILL_TARGET_DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:5432/fitness_tracker_restore_drill',DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:5432/fitness_tracker_e2e' };
assert.ok(assertDisposable(env,'--confirm-disposable'));
for (const bad of [{...env,CI:'false'},{...env,VERCEL:'1'},{...env,DRILL_TARGET_DATABASE_URL:env.DATABASE_URL},{...env,DRILL_TARGET_DATABASE_URL:env.DRILL_TARGET_DATABASE_URL.replace('127.0.0.1','production.example.com')},{...env,DRILL_TARGET_DATABASE_URL:env.DRILL_TARGET_DATABASE_URL+'?host=production.example.com'}]) assert.throws(()=>assertDisposable(bad,'--confirm-disposable'));
assert.throws(()=>assertDisposable(env,''));
const { pack, verify } = require('./media-archive.cjs');
const { assertClerkTestEnvironment, assertDisposableEnvironment } = require('./e2e-environment.cjs');
const clerkEnv = { ...env, DIRECT_URL: env.DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic', CLERK_SECRET_KEY: 'sk_test_synthetic' };
assert.doesNotThrow(() => assertClerkTestEnvironment(clerkEnv));
for (const bad of [{ ...clerkEnv, CI: 'false' }, { ...clerkEnv, VERCEL: '1' },
  { ...clerkEnv, E2E_TEST_MODE: '0' }, { ...clerkEnv, CLERK_SECRET_KEY: '' },
  { ...clerkEnv, CLERK_SECRET_KEY: 'sk_live_synthetic' },
  { ...clerkEnv, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_synthetic' },
  { ...clerkEnv, E2E_BASE_URL: 'https://production.example.com' },
  { ...clerkEnv, DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', 'production.example.com') },
  { ...clerkEnv, DIRECT_URL: env.DATABASE_URL.replace('fitness_tracker_e2e', 'production') },
  { ...clerkEnv, DIRECT_URL: env.DATABASE_URL + '?host=production.example.com' },
]) assert.throws(() => assertClerkTestEnvironment(bad));
assert.doesNotThrow(() => assertDisposableEnvironment(clerkEnv));
const directory = fs.mkdtempSync(path.join(os.tmpdir(),'kg-media-unit-'));
try {
  fs.mkdirSync(path.join(directory,'source/activity-proofs/u'),{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(directory,'source/activity-proofs/u/test.png'),Buffer.from('synthetic fixture bytes'),{mode:0o600});
  assert.equal(pack(path.join(directory,'source'),path.join(directory,'archive')).objects,1);
  assert.equal(verify(path.join(directory,'archive')).verified,true);
  assert.throws(()=>pack(path.join(directory,'source'),path.join(directory,'archive')));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory,'archive/manifest.json'),'utf8'));
  fs.writeFileSync(path.join(directory,'archive',manifest.objects[0].blob),'tampered');
  assert.throws(()=>verify(path.join(directory,'archive')));
  fs.symlinkSync('/etc/passwd',path.join(directory,'source/activity-proofs/u/link'));
  assert.throws(()=>pack(path.join(directory,'source'),path.join(directory,'archive-two')));
} finally { fs.rmSync(directory,{recursive:true,force:true}); }
console.log('Hardening unit checks passed: proof references, half-point round-down scoring, stored score explanations, disposable restore guards, object archive integrity.');
