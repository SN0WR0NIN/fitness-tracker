#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const cache = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} }; cache.set(filename, mod);
  const nativeRequire = createRequire(filename);
  const req = (id) => {
    if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), `${id}.ts`));
    if (id === '@/lib/scoring') return load('src/lib/scoring.ts');
    if (id === '@/lib/correction-run-metrics') return load('src/lib/correction-run-metrics.ts');
    if (id === '@/lib/run-segment-schema') return load('src/lib/run-segment-schema.ts');
    if (id === '@/lib/activity-date') return { singaporeDate: date => date.toISOString().slice(0, 10), parseActivityDate: date => /^2026-09-\d\d$/.test(date) ? new Date(date) : null };
    if (id === '@/lib/friend-selection') return { activityFriendIds: activity => activity.companionUserIds || [] };
    if (id.startsWith('@/')) return {};
    return nativeRequire(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(req, mod, mod.exports);
  return mod.exports;
}
const { correctionRunMetrics } = load('src/lib/correction-run-metrics.ts');
const { calculateActivityPoints, summarizeRunSegments } = load('src/lib/scoring.ts');
const { correctionSnapshot, CorrectionValuesSchema } = load('src/lib/activity-corrections.ts');
const segments = [{kind:'WORK', distance:4, pace:4 + 20/60}, {kind:'RECOVERY', distance:2, pace:8}];
const original = { category:'RUN', ...summarizeRunSegments(segments), runSegments:segments };
const omitted = {category:original.category, distance:original.distance, pace:original.pace};
assert.deepEqual(correctionRunMetrics(original, omitted).runSegments, segments, 'legacy metadata-only edits preserve segments');
assert.throws(() => correctionRunMetrics(original, {...omitted,distance:7}), /Edit the interval segments/);
assert.throws(() => correctionRunMetrics(original, {...omitted,pace:6}), /Edit the interval segments/);
const changed = [{kind:'WORK',distance:3,pace:4.5}, {kind:'RECOVERY',distance:1,pace:9.5}];
const metrics = correctionRunMetrics(original, {...omitted, distance:999, pace:59, runSegments:changed});
assert.deepEqual(metrics, {...summarizeRunSegments(changed), runSegments:changed});
assert.equal(calculateActivityPoints({category:'RUN',...metrics}).totalPoints, 8.5);
assert.deepEqual(correctionRunMetrics(original, {...omitted,runSegments:null}).runSegments, [], 'only explicit null converts to steady');
assert.deepEqual(correctionRunMetrics(original, {...omitted,category:'CYCLE'}).runSegments, []);
assert.throws(() => correctionRunMetrics(original, {...omitted,category:'CYCLE',runSegments:segments}), /only for Run/);
for (const invalid of [[], segments.slice(0,1), [{kind:'WORK',distance:0,pace:4},segments[1]], [{...segments[0],pace:Infinity},segments[1]]]) {
  assert.throws(() => correctionRunMetrics(original, {...omitted,runSegments:invalid}));
}
const activity = {...original, occurredAt:new Date('2026-09-10T12:00:00Z'),updatedAt:new Date('2026-09-10T13:00:00Z'),duration:33,companionUserId:null,companionUserIds:[],completedWithFriend:false,proofUrl:null,points:13,weekNumber:2,companion:null};
const snapshot = correctionSnapshot(activity);
assert.deepEqual(snapshot.runSegments, segments);
assert.equal(snapshot.cycleScoringVersion,1);
assert.equal(correctionSnapshot({...activity,cycleScoringVersion:2}).cycleScoringVersion,2);
assert.deepEqual(JSON.parse(JSON.stringify(snapshot)).runSegments, segments, 'persisted original/proposed/applied history keeps segment details');
assert.equal(correctionSnapshot({...activity,runSegments:null}).runSegments,null);
const proposed = {activityDate:'2026-09-10', category:'RUN',distance:6,pace:6,duration:null,companionUserId:null,proofUrl:null,runSegments:segments};
assert.deepEqual(CorrectionValuesSchema.parse(proposed).runSegments, segments);
assert.equal(CorrectionValuesSchema.safeParse({...proposed,category:'CYCLE'}).success,false);
assert.equal(CorrectionValuesSchema.safeParse({...proposed,cycleScoringVersion:2}).success,false, 'participants cannot alter scoring versions');
assert.equal(CorrectionValuesSchema.safeParse({...proposed,runSegments:[]}).success,false);
assert.equal(CorrectionValuesSchema.safeParse({...proposed,runSegments:null}).success,true);
console.log('Correction interval tests passed: preservation, explicit conversion, derived scoring, validation and snapshot round-trip.');
