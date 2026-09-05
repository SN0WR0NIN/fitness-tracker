const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const original=Module._load;Module._load=function(n,p,i){return original.call(this,n.startsWith('@/lib/')?require('node:path').resolve(__dirname,'../src/lib',n.slice(6)+'.ts'):n,p,i);};
const {getWeekStart,getWeekNumber}=require('../src/lib/scoring.ts');const {getWeeklyGoalIntelligence}=require('../src/lib/engagement.ts');const {recapWeek}=require('../src/lib/weekly-recap.ts');
for(const [date,week] of [['2026-09-01T00:00:00+08:00',1],['2026-09-05T23:59:59+08:00',1],['2026-09-06T00:00:00+08:00',2],['2026-09-12T23:59:59+08:00',2],['2026-09-13T00:00:00+08:00',3]])assert.equal(getWeekNumber(new Date(date)),week);
const start=getWeekStart(new Date('2026-09-01T00:00:00+08:00'));assert.equal(start.toISOString(),'2026-08-30T00:00:00.000Z');
const history=getWeeklyGoalIntelligence([{weekStart:start,weekNumber:3,totalPoints:41.5}],[],25,new Date('2026-09-05T08:00:00Z')).history;assert.equal(history.length,1);assert.equal(history[0].weekNumber,1);assert.equal(history[0].points,41.5);assert.match(history[0].dateRange,/1 Sept? – 5 Sept?/);
assert.equal(recapWeek(new Date('2026-09-03')).start.toISOString(),'2026-08-31T16:00:00.000Z');
console.log('Challenge boundaries, Singapore midnight, first partial week, corrected labels and decimal precision passed.');
