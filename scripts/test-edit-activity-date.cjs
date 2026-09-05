const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {editOwnActivityDate} = require('../src/lib/edit-activity-date.ts');
async function main() {
  let row, writes;
  const tx = {$queryRaw:async()=>row?[row]:[],weeklyScore:{update:async x=>writes.push(['remove',x]),upsert:async x=>writes.push(['add',x])},activity:{update:async({data})=>{writes.push(['activity',data]);return {...row,...data};}}};
  const db = {$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}};
  const start = new Date('2026-08-16T00:00:00Z');
  for (const category of ['RUN','CYCLE','SWIM','WALK_OR_HIKE','TROOP_GAMES']) {
    row={id:'a',userId:'u',columnId:'c',category,status:'APPROVED',points:11.5,occurredAt:new Date('2026-08-24T01:00:00Z'),weekStart:new Date('2026-08-23T00:00:00Z')}; writes=[];
    await assert.rejects(editOwnActivityDate(db,'a','other','2026-08-30',start),{status:403});assert.equal(writes.length,0);
    for(const bad of ['9999-01-01','2026-02-30','']) await assert.rejects(editOwnActivityDate(db,'a','u',bad,start),{status:400});
    const updated=await editOwnActivityDate(db,'a','u','2026-08-30',start);
    assert.equal(updated.points,11.5);assert.equal(updated.status,'APPROVED');assert.equal(updated.weekStart.toISOString(),'2026-08-30T00:00:00.000Z');
    assert.equal(writes[0][1].data.totalPoints.decrement,11.5);assert.equal(writes[1][1].create.totalPoints,11.5);
    writes=[];await editOwnActivityDate(db,'a','u','2026-08-25',start);assert.equal(writes.length,1);
    writes=[];await editOwnActivityDate(db,'a','u','2026-08-24',start);assert.equal(writes.length,0);
    row.status='REJECTED';await assert.rejects(editOwnActivityDate(db,'a','u','2026-08-30',start),{status:409});
  }
  row.status='APPROVED';tx.weeklyScore.upsert=async()=>{throw Error('score failure');};writes=[];
  await assert.rejects(editOwnActivityDate(db,'a','u','2026-08-30',start),/score failure/);assert.ok(!writes.some(x=>x[0]==='activity'));
  console.log('Approved date edits: ownership, state, validation, all categories, Sunday transfer, same-week/no-op and score failure checks passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
