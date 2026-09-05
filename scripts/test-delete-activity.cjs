const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, f);
const { deleteOwnActivity } = require('../src/lib/delete-activity.ts');
async function main() {
  for (const category of ['RUN','CYCLE','SWIM','WALK_OR_HIKE','TROOP_GAMES']) {
    for (const status of ['APPROVED','PENDING','REJECTED']) {
      let row = { id:'a', userId:'owner', category, status, points:7.5, weekStart:new Date() };
      const writes = [];
      const tx = { $queryRaw: async () => row ? [row] : [], weeklyScore: { update: async (v) => writes.push(v) }, activity: { delete: async () => { row = null; } } };
      const db = { $transaction: async (fn) => fn(tx) };
      await assert.rejects(deleteOwnActivity(db,'a','other'), { status:403 });
      assert.equal(writes.length,0); assert.ok(row);
      await deleteOwnActivity(db,'a','owner');
      assert.equal(row,null); assert.equal(writes.length,status === 'APPROVED' ? 1 : 0);
      if(writes.length) assert.equal(writes[0].data.totalPoints.decrement,7.5);
      await assert.rejects(deleteOwnActivity(db,'a','owner'), { status:404 });
      assert.equal(writes.length,status === 'APPROVED' ? 1 : 0);
    }
  }
  let deleted = false;
  const db = { $transaction: async (fn) => fn({ $queryRaw: async () => [{userId:'owner',status:'APPROVED',category:'RUN'}], weeklyScore:{update:async()=>{throw Error('score failure');}},activity:{delete:async()=>{deleted=true;}} }) };
  await assert.rejects(deleteOwnActivity(db,'a','owner'), /score failure/); assert.equal(deleted,false);
  console.log('Deletion: owner checks, every status/category, repeat requests, and score failure passed.');
}
main().catch(e => { console.error(e); process.exitCode=1; });
