const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=', 'base64');
function disposable(baseURL) {
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || process.env.VERCEL || process.env.VERCEL_ENV
    || new URL(process.env.DATABASE_URL).hostname !== '127.0.0.1' || new URL(process.env.DATABASE_URL).pathname !== '/fitness_tracker_e2e'
    || new URL(baseURL).hostname !== '127.0.0.1') throw new Error('Disposable localhost fixtures only.');
}
async function body(response, expected = 200) { const text = await response.text(); expect(response.status(), text).toBe(expected); return JSON.parse(text); }
async function accounts(browser, baseURL) {
  disposable(baseURL); const db = new PrismaClient(); const key = `privacy_${randomUUID().replaceAll('-','')}`;
  const password = process.env.E2E_PASSWORD; const hash = await bcrypt.hash(password, 10); const contexts = []; const users = [];
  const column = await db.column.create({data:{name:key}}); const result = {db,column};
  for (const name of ['owner','other','admin']) {
    const user = await db.user.create({data:{id:`${key}_${name}`,name:`Privacy ${name}`,email:`${key}_${name}@example.test`,password:hash,role:name==='admin'?'ADMIN':'MEMBER',columnId:column.id}}); users.push(user.id);
    const context = await browser.newContext({baseURL,viewport:{width:390,height:844}});contexts.push(context);
    const csrf = await body(await context.request.get('/api/auth/csrf'));
    await body(await context.request.post('/api/auth/callback/credentials',{form:{csrfToken:csrf.csrfToken,email:user.email,password,callbackUrl:`${baseURL}/dashboard`,json:'true'}}));
    expect((await body(await context.request.get('/api/auth/session'))).user.id).toBe(user.id);
    result[name]={...user,context,api:context.request,page:await context.newPage()};
  }
  result.cleanup=async()=>{ for (const context of contexts) await context.close(); await db.activity.deleteMany({where:{userId:{in:users}}}); await db.user.deleteMany({where:{id:{in:users}}}); await db.column.delete({where:{id:column.id}});await db.$disconnect(); };
  result.upload=async account=>(await body(await account.api.post('/api/upload',{multipart:{file:{name:'proof.png',mimeType:'image/png',buffer:PNG}}}))).url;
  result.create=async(account,proofUrl,extra={})=>body(await account.api.post('/api/activities',{data:{category:'RUN',distance:5,pace:6,activityDate:'2026-09-02',proofUrl,...extra}}),201);
  return result;
}
const href = ref => `/api/proofs?ref=${encodeURIComponent(ref)}`;

test('proofs enforce owner/admin sessions, upload ownership, no public disclosure and revocation', async ({browser,baseURL,request})=>{
  const s=await accounts(browser,baseURL);
  try {
    const proof=await s.upload(s.owner); const otherProof=await s.upload(s.other);
    expect((await s.owner.api.get(href(proof))).status()).toBe(200); // own unattached draft
    expect((await s.other.api.get(href(proof))).status()).toBe(404);
    expect((await request.get(href(proof))).status()).toBe(401);
    const entry=await s.create(s.owner,proof);
    await body(await s.admin.api.post(`/api/admin/activities/${entry.id}/approve`,{data:{}}));
    for (const account of [s.owner,s.admin]) {
      const response=await account.api.get(href(proof)); expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toContain('private');expect(response.headers()['cache-control']).toContain('no-store');
      expect(response.headers()['cdn-cache-control']).toBe('no-store');expect(response.headers()['location']).toBeUndefined();
      expect(Buffer.compare(await response.body(),PNG)).toBe(0);
    }
    expect((await s.other.api.get(href(proof))).status()).toBe(404);
    expect((await s.owner.api.get(href(proof),{headers:{'sec-fetch-site':'cross-site'}})).status()).toBe(403);
    expect((await s.owner.api.get(href('https://127.0.0.1/admin'))).status()).toBe(404);
    expect((await s.other.api.post('/api/activities',{data:{category:'RUN',distance:7,pace:6,activityDate:'2026-09-03',proofUrl:proof}})).status()).toBe(403);
    const ownPending=await s.create(s.other,otherProof,{distance:7,activityDate:'2026-09-03'});
    expect((await s.other.api.patch(`/api/activities/${ownPending.id}`,{data:{proofUrl:proof}})).status()).toBe(403);
    // Owner cannot smuggle someone else's proof through a correction request.
    expect((await s.owner.api.post('/api/corrections',{data:{activityId:entry.id,reason:'Change proof with forbidden foreign upload',proposed:{activityDate:'2026-09-02',category:'RUN',distance:5,pace:6,duration:null,companionUserId:null,proofUrl:otherProof}}})).status()).toBe(403);
    const publicFeed=await request.get(`/api/activities?userId=${s.owner.id}`);expect(publicFeed.ok()).toBe(true);
    expect(await publicFeed.text()).not.toContain(proof);
    const profile=await request.get(`/participants/${s.owner.id}`);expect(profile.ok()).toBe(true);expect(await profile.text()).not.toContain(proof);
    await s.owner.page.goto('/dashboard');
    const dashboardActivity = s.owner.page.getByTestId('dashboard-activity').first();
    await expect(dashboardActivity).toBeVisible();
    await dashboardActivity.locator('summary').click();
    await expect(s.owner.page.getByTestId('score-explanation').filter({hasText:'Included in standings'}).first()).toBeVisible();
    // Hydration normalizes Next/Image src to an absolute URL; inspect the
    // parsed same-origin endpoint instead of requiring relative DOM text.
    const image=s.owner.page.getByRole('img',{name:'Run activity screenshot'}).first();
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    const imageUrl=new URL(await image.getAttribute('src'),baseURL);
    expect(imageUrl.origin).toBe(new URL(baseURL).origin);
    expect(imageUrl.pathname).toBe('/api/proofs');
    expect(imageUrl.searchParams.get('ref')).toBe(proof);
    await expect(image).toHaveJSProperty('complete',true);
    await expect.poll(()=>image.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
    await s.owner.page.screenshot({path:'test-results/private-proof-owner-mobile.png',fullPage:true});
    await s.admin.page.goto('/admin/activities');
    await expect(s.admin.page.getByTestId('score-explanation').first()).toBeVisible();
    await s.admin.page.screenshot({path:'test-results/score-explanations-admin-mobile.png',fullPage:true});
    // The formerly admin account's existing JWT must not retain privileges.
    await s.db.user.update({where:{id:s.admin.id},data:{role:'MEMBER'}});
    expect((await s.admin.api.get(href(proof))).status()).toBe(404);
    await s.db.user.update({where:{id:s.admin.id},data:{role:'ADMIN'}});
    await s.db.user.update({where:{id:s.owner.id},data:{sessionVersion:{increment:1}}});
    expect((await s.owner.api.get(href(proof))).status()).toBe(401);
    // Simulate legitimate account linking in isolated CI: old uploader loses
    // access once the activity now belongs to a different current account.
    const transferred=await s.create(s.other,otherProof,{distance:8,activityDate:'2026-09-04'});
    await s.db.activity.update({where:{id:transferred.id},data:{userId:s.admin.id}});
    // A second owned reference remains legitimate; transfer both to remove it.
    await s.db.activity.update({where:{id:ownPending.id},data:{userId:s.admin.id}});
    expect((await s.other.api.get(href(otherProof))).status()).toBe(404);
  } finally {await s.cleanup();}
});

test('external proof disclosure stays private and admin uploads attach to the target owner', async ({browser,baseURL,request})=>{
  const s=await accounts(browser,baseURL);
  try {
    const proof=await s.upload(s.admin);
    const created=await body(await s.admin.api.post('/api/admin/activities/create',{data:{userId:s.owner.id,activityDate:'2026-09-03',category:'RUN',distance:6,pace:6,proofUrl:proof}}),201);
    expect(created.activity.userId).toBe(s.owner.id);
    expect((await s.owner.api.get(href(proof))).status()).toBe(200);
    expect((await s.other.api.get(href(proof))).status()).toBe(404);
    const drive='https://drive.google.com/file/d/syntheticProofID123/view';
    await s.create(s.owner,drive,{distance:12,activityDate:'2026-09-04'});
    const allowed=await s.owner.api.get(href(drive),{maxRedirects:0});expect(allowed.status()).toBe(307);expect(allowed.headers().location).toMatch(/^https:\/\/drive.google.com\/thumbnail\?/);
    expect((await s.other.api.get(href(drive),{maxRedirects:0})).status()).toBe(404);
    expect((await request.get(href(drive),{maxRedirects:0})).status()).toBe(401);
    const operations=await s.admin.api.get('/admin/operations');expect(operations.ok()).toBe(true);expect(await operations.text()).toContain('Provider configuration not verified');
    await s.admin.page.goto('/admin/operations');await expect(s.admin.page.getByRole('heading',{name:'Operations & handover'})).toBeVisible();
    await s.admin.page.screenshot({path:'test-results/admin-operations-mobile.png',fullPage:true});
  } finally {await s.cleanup();}
});

test('v7 export retains ledger/history, rejects corrupt backups, and writes a synthetic restore fixture', async ({browser,baseURL,request})=>{
  const s=await accounts(browser,baseURL);
  try {
    const a=await s.create(s.owner,await s.upload(s.owner),{companionUserIds:[s.other.id]});
    await body(await s.admin.api.post(`/api/admin/activities/${a.id}/approve`,{data:{}}));
    // The deployed ledger is exercised only against this disposable CI database.
    await body(await s.admin.api.post('/api/admin/control',{data:{action:'scores.recalculate',payload:{confirmation:'RECALCULATE'}}}));
    expect((await request.get('/api/admin/export?type=backup')).status()).toBe(401);
    expect((await s.owner.api.get('/api/admin/export?type=backup')).status()).toBe(403);
    const response=await s.admin.api.get('/api/admin/export?type=backup');const backup=await body(response);
    expect(response.headers()['cache-control']).toContain('no-store');expect(backup.version).toBe(7);
    expect(backup.pointsLogs.length).toBe(backup.activities.length);
    expect(backup.pointsLogs.find(p=>p.activityId===a.id).friendBonus).toBe(3);
    expect(backup.activities.find(row=>row.id===a.id).companionUserIds).toEqual([s.other.id]);
    expect(backup.userAchievements.some(row=>row.user_id===s.owner.id)).toBe(true);
    const text=JSON.stringify(backup);expect(text).not.toContain('"password":');expect(text).not.toContain('stravaAccessToken');
    fs.writeFileSync('/tmp/kg-hardening-fixture.json',text,{mode:0o600});
    const checked=spawnSync(process.execPath,['scripts/validate-operational-backup.cjs','/tmp/kg-hardening-fixture.json'],{encoding:'utf8'});expect(checked.status,checked.stderr).toBe(0);
    const corrupt={...backup,pointsLogs:backup.pointsLogs.map((p,index)=>index? p:{...p,totalPoints:p.totalPoints+1})};
    fs.writeFileSync('/tmp/kg-hardening-invalid.json',JSON.stringify(corrupt),{mode:0o600});
    expect(spawnSync(process.execPath,['scripts/validate-operational-backup.cjs','/tmp/kg-hardening-invalid.json']).status).toBe(1);
    const missing={...backup,pointsLogs:[]};fs.writeFileSync('/tmp/kg-hardening-invalid.json',JSON.stringify(missing),{mode:0o600});
    expect(spawnSync(process.execPath,['scripts/validate-operational-backup.cjs','/tmp/kg-hardening-invalid.json']).status).toBe(1);
    // Read-only JSON exporter does not create a stored snapshot; scheduled v7
    // enrichment is exercised separately after installing its migration in CI.
  } finally {await s.cleanup();}
});
