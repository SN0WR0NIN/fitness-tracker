#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS regression runner */
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
    if (id.startsWith('.') || id.startsWith('@/')) {
      const dependency = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(filename), id);
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
const { calculateActivityPoints, DEFAULT_SCORING_RULES: rules, roundActivityScoreDown } = moduleFrom('src/lib/scoring.ts');
const { planDailyActivityScores } = moduleFrom('src/lib/daily-friend-bonus.ts');
const { explainScore } = moduleFrom('src/lib/score-explanation.ts');
const { prepareRow } = moduleFrom('src/lib/historical-import.ts');
const cases = [[0,0],[0.01,0],[10,3.3],[15,5],[19.99,6.6],[20,9.6],[39.99,16.3],[40,19.3],[59.99,25.9],[60,29],[79.99,35.6],[80,38.6],[100,48.3],[1000,483.3]];
for (const [distance,expected] of cases) {
  for (const pace of [undefined,1,99]) {
    const score=calculateActivityPoints({category:'CYCLE',distance,pace});
    assert.equal(score.totalPoints,expected,`distance ${distance}, pace ${pace}`);
    assert.equal(score.friendBonus,0);
    const friend=calculateActivityPoints({category:'CYCLE',distance,pace,completedWithFriend:true});
    assert.equal(friend.totalPoints,Math.round((expected+(distance>0?3:0))*10)/10);
  }
}
assert.equal(calculateActivityPoints({category:'CYCLE',distance:20,cycleScoringVersion:1}).totalPoints,6.5);
assert.equal(calculateActivityPoints({category:'CYCLE',distance:40,cycleScoringVersion:1}).totalPoints,13);
assert.equal(calculateActivityPoints({category:'RUN',distance:3.1,pace:6}).totalPoints,4.5);
assert.equal(calculateActivityPoints({category:'SWIM',distance:175}).totalPoints,1.5);
assert.equal(roundActivityScoreDown(9.69,'CYCLE',2),9.6);
assert.equal(roundActivityScoreDown(9.69,'CYCLE',1),9.5);
const start=new Date('2026-09-01T00:00:00Z');
const activity={id:'a',userId:'u',columnId:'c',category:'CYCLE',distance:20,pace:null,completedWithFriend:false,status:'APPROVED',occurredAt:start,createdAt:start};
assert.equal(planDailyActivityScores([activity],rules,start)[0].scoring.totalPoints,6.5,'missing version is legacy');
assert.equal(planDailyActivityScores([{...activity,cycleScoringVersion:1}],rules,start)[0].scoring.totalPoints,6.5);
assert.equal(planDailyActivityScores([{...activity,cycleScoringVersion:2}],rules,start)[0].scoring.totalPoints,9.6);
assert.equal(planDailyActivityScores([{...activity,distance:19.99,cycleScoringVersion:2}],rules,start)[0].scoring.totalPoints,6.6,'ledger floors raw value, not rounded display base');
assert.equal(planDailyActivityScores([{...activity,cycleScoringVersion:2,basePointsOverride:9.69}],rules,start)[0].scoring.totalPoints,9.6);
assert.equal(planDailyActivityScores([{...activity,cycleScoringVersion:2,totalPointsOverride:8.1}],rules,start)[0].scoring.totalPoints,8.1);
const pair=planDailyActivityScores([{...activity,completedWithFriend:true,cycleScoringVersion:2},{...activity,id:'b',completedWithFriend:true,cycleScoringVersion:2}],rules,start);
assert.equal(pair.reduce((sum,item)=>sum+item.scoring.friendBonus,0),3);
assert.deepEqual(pair.map(item=>item.scoring.totalPoints),[12.6,9.6]);
assert.equal(prepareRow({name:'Old',column:'A',category:'CYCLE',distance:20,occurredAt:start.toISOString()},rules,start).points,6.5,'historical imports stay legacy');
const explained={...activity,points:9.6,cycleScoringVersion:2,pointsLog:{basePoints:9.67,friendBonus:0,totalPoints:9.6}};
assert.match(explainScore(explained).calculation.join(' '),/1 complete 20 km blocks/);
assert.match(explainScore(explained).calculation.join(' '),/0.1-point/);
assert.match(explainScore({...explained,cycleScoringVersion:1}).calculation.join(' '),/Legacy cycling/);


assert.equal(calculateActivityPoints({category:'CYCLE',distance:20}, {...rules,cycleKmPerPoint:9}).totalPoints,9.6,'new rule always divides by3');
assert.equal(calculateActivityPoints({category:'CYCLE',distance:20,cycleScoringVersion:1}, {...rules,cycleKmPerPoint:9}).totalPoints,2,'legacy configured divisor preserved');
const interval={...activity,category:'RUN',distance:9,pace:6,runSegments:[{kind:'WORK',distance:1,pace:4},{kind:'RECOVERY',distance:7.332666666666667,pace:6}]};
assert.equal(calculateActivityPoints(interval).totalPoints,13);
assert.equal(planDailyActivityScores([interval],rules,start)[0].scoring.totalPoints,13,'interval floors raw combined score once');

// Exercise the real bulk writer and ledger against an in-memory transaction.
// Only external database/operating guards are doubled: no database is contacted.
async function testHistoricalWriter() {
  let writableChecks = 0;
  loadedModules.set(path.resolve('src/lib/prisma.ts'), {exports:{prisma:{}}});
  loadedModules.set(path.resolve('src/lib/operating-mode.ts'), {exports:{
    assertCompetitionWritable: async () => { writableChecks++; },
    FeatureError: class FeatureError extends Error {},
  }});
  loadedModules.set(path.resolve('src/lib/week-finalization.ts'), {exports:{
    assertActivityWeekWritable: async () => {},
  }});
  const { writeHistoricalImport } = moduleFrom('src/lib/historical-import-writer.ts');
  const inserted = [], logs = [], weekly = [];
  const tx = {
    user:{createMany:async()=>{}},
    activity:{
      createMany:async({data})=>{inserted.push(...data.map(row=>({...row,createdAt:start,pointsLog:null})));},
      findMany:async({where})=>inserted.filter(row=>row.userId===where.userId),
      update:async({where,data})=>Object.assign(inserted.find(row=>row.id===where.id),data),
    },
    weeklyScore:{findMany:async()=>[],upsert:async({create})=>weekly.push(create)},
    pointsLog:{upsert:async({create})=>logs.push(create)},
    $queryRaw:async()=>[{scoringRules:rules,startDate:start}],
    $executeRaw:async()=>1,
  };
  const imported=[20,40].map((distance,index)=>{
    const row={name:'Legacy Rider',column:'A',category:'CYCLE',distance,occurredAt:start.toISOString()};
    return {...row,...prepareRow(row,rules,start),id:`legacy-import-${index}`,userId:'legacy-u',columnId:'legacy-c',createParticipant:false};
  });
  await writeHistoricalImport(tx,imported,'reviewer');
  assert.equal(inserted.length,2);
  assert.ok(inserted.every(row=>row.cycleScoringVersion===1),'writer persists legacy version explicitly');
  assert.deepEqual(inserted.map(row=>row.points),[6.5,13],'actual reconciliation keeps legacy scores');
  assert.deepEqual(logs.map(row=>row.totalPoints),[6.5,13]);
  assert.equal(weekly[0].cyclePoints,19.5);
  assert.equal(writableChecks,1,'real ledger calls operating-mode guard');
  await writeHistoricalImport(tx,[],'reviewer');
  assert.equal(inserted.length,2,'empty import performs no writes');
  console.log('Cycling scoring checks passed: thresholds, precision, speed independence, friend cap, overrides, legacy rebuilds/imports, actual historical writer and explanations.');
}
testHistoricalWriter().catch(error=>{console.error(error);process.exitCode=1;});
