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
    const activities=s.owner.page.locator('details.profile-main-fold').filter({has:s.owner.page.getByText('My activities',{exact:true})});
    await activities.locator(':scope > summary').click();
    const dashboardActivity = s.owner.page.getByTestId('dashboard-activity').first();
    await expect(dashboardActivity).toBeVisible();
    await dashboardActivity.locator(':scope > summary').click();
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
    // Existing NextAuth JWTs must be revoked when sessionVersion changes.
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
    await s.admin.page.goto('/admin/operations');await expect(s.admin.page.getByRole('heading',{name:'Operations & analytics'})).toBeVisible();
    await s.admin.page.screenshot({path:'test-results/admin-operations-mobile.png',fullPage:true});
  } finally {await s.cleanup();}
});

test('v7 export retains ledger/history, rejects corrupt backups, and writes a synthetic restore fixture', async ({browser,baseURL,request})=>{
  const s=await accounts(browser,baseURL);
  try {
    const runSegments=[{kind:'WORK',distance:4,pace:4.5},{kind:'RECOVERY',distance:2,pace:9}];
    const intervalProofs=[await s.upload(s.owner),await s.upload(s.owner)];
    const a=await s.create(s.owner,intervalProofs[0],{distance:6,pace:6,runSegments,proofUrls:intervalProofs,companionUserIds:[s.other.id]});
    await body(await s.admin.api.post(`/api/admin/activities/${a.id}/approve`,{data:{}}));
    const cycle=await s.create(s.owner,await s.upload(s.owner),{category:'CYCLE',distance:20,pace:undefined,activityDate:'2026-09-03'});
    await body(await s.admin.api.patch(`/api/admin/activities/${cycle.id}`,{data:{basePointsOverride:9.67,totalPointsOverride:8.1}}));
    // The deployed ledger is exercised only against this disposable CI database.
    await body(await s.admin.api.post('/api/admin/control',{data:{action:'scores.recalculate',payload:{confirmation:'RECALCULATE'}}}));
    expect((await request.get('/api/admin/export?type=backup')).status()).toBe(401);
    expect((await s.owner.api.get('/api/admin/export?type=backup')).status()).toBe(403);
    const response=await s.admin.api.get('/api/admin/export?type=backup');const backup=await body(response);
    expect(response.headers()['cache-control']).toContain('no-store');expect(backup.version).toBe(7);
    expect(backup.pointsLogs.length).toBe(backup.activities.length);
    expect(backup.pointsLogs.find(p=>p.activityId===a.id).friendBonus).toBe(3);
    expect(backup.activities.find(row=>row.id===a.id).companionUserIds).toEqual([s.other.id]);
    expect(backup.activities.find(row=>row.id===a.id).runSegments).toEqual(runSegments);
    expect(backup.activities.find(row=>row.id===a.id).proofUrls).toEqual(intervalProofs);
    expect(backup.activities.find(row=>row.id===cycle.id)).toMatchObject({basePointsOverride:9.67,totalPointsOverride:8.1});
    expect(backup.activities.find(row=>row.id===cycle.id).cycleScoringVersion).toBe(2);
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

test('interval corrections preserve history and require an explicit steady-run conversion', async ({browser,baseURL})=>{
  const s=await accounts(browser,baseURL);
  try {
    const runSegments=[{kind:'WORK',distance:4,pace:4.5},{kind:'RECOVERY',distance:2,pace:9}];
    const proofUrl=await s.upload(s.owner);
    const recoveryProof=await s.upload(s.owner);
    const entry=await s.create(s.owner,proofUrl,{runSegments,distance:6,pace:6,proofUrls:[proofUrl,recoveryProof]});
    // An old client cannot silently remove interval scoring by editing totals.
    expect((await s.owner.api.patch(`/api/activities/${entry.id}`,{data:{distance:7}})).status()).toBe(400);
    expect((await s.db.activity.findUniqueOrThrow({where:{id:entry.id}})).runSegments).toEqual(runSegments);
    await body(await s.admin.api.post(`/api/admin/activities/${entry.id}/approve`,{data:{}}));
    const proposed={activityDate:'2026-09-02',category:'RUN',distance:6,pace:6,duration:40,companionUserId:null,proofUrl};
    expect((await s.owner.api.post('/api/corrections',{data:{activityId:entry.id,reason:'Change aggregate without segment details',proposed:{...proposed,distance:7}}})).status()).toBe(400);
    const request=await body(await s.owner.api.post('/api/corrections',{data:{activityId:entry.id,reason:'Correct duration while preserving intervals',proposed}}),201);
    let history=await body(await s.owner.api.get('/api/corrections'));
    let record=history.find(row=>row.id===request.id);
    expect(record.original.runSegments).toEqual(runSegments);
    expect(record.proposed.runSegments).toEqual(runSegments);
    await body(await s.admin.api.post('/api/admin/corrections',{data:{id:request.id,decision:'APPROVED',reason:'Verified duration and interval proof'}}));
    history=await body(await s.owner.api.get('/api/corrections'));record=history.find(row=>row.id===request.id);
    expect(record.applied.runSegments).toEqual(runSegments);
    const changedSegments=[{kind:'WORK',distance:3,pace:4.5},{kind:'RECOVERY',distance:1,pace:9.5}];
    const second=await body(await s.owner.api.post('/api/corrections',{data:{activityId:entry.id,reason:'Correct work and recovery distances',proposed:{...proposed,runSegments:changedSegments}}}),201);
    await body(await s.admin.api.post('/api/admin/corrections',{data:{id:second.id,decision:'APPROVED',reason:'Verified corrected segment distances'}}));
    const corrected=await s.db.activity.findUniqueOrThrow({where:{id:entry.id}});
    expect(corrected.runSegments).toEqual(changedSegments);expect(corrected.distance).toBe(4);expect(corrected.pace).toBe(5.75);expect(corrected.points).toBe(8.5);
    const third=await body(await s.owner.api.post('/api/corrections',{data:{activityId:entry.id,reason:'This workout was actually a steady run',proposed:{...proposed,distance:4,pace:5.75,runSegments:null}}}),201);
    await body(await s.admin.api.post('/api/admin/corrections',{data:{id:third.id,decision:'APPROVED',reason:'Verified steady-run conversion proof'}}));
    history=await body(await s.owner.api.get('/api/corrections'));record=history.find(row=>row.id===third.id);
    expect(record.original.runSegments).toEqual(changedSegments);expect(record.proposed.runSegments).toBeNull();expect(record.applied.runSegments).toBeNull();
    expect((await s.db.activity.findUniqueOrThrow({where:{id:entry.id}})).runSegments).toBeNull();
    // Another member cannot inspect the owner's interval correction snapshots.
    expect((await body(await s.other.api.get('/api/corrections'))).some(row=>row.activityId===entry.id)).toBe(false);
  } finally {await s.cleanup();}
});

test('interval proofs remain separate, owned and mandatory for edits and steady-to-interval corrections', async ({browser,baseURL})=>{
  const s=await accounts(browser,baseURL);
  try {
    const runSegments=[{kind:'WORK',distance:4,pace:4.5},{kind:'RECOVERY',distance:2,pace:9}];
    const work=await s.upload(s.owner), recovery=await s.upload(s.owner), foreign=await s.upload(s.other);
    const payload={activityDate:'2026-09-02',category:'RUN',distance:6,pace:6,runSegments};
    const before=await s.db.activity.count({where:{userId:s.owner.id}});
    for (const proofUrls of [[work],[work,work]]) {
      expect((await s.owner.api.post('/api/activities',{data:{...payload,proofUrls}})).status()).toBe(400);
    }
    expect((await s.owner.api.post('/api/activities',{data:{...payload,proofUrls:[work,foreign]}})).status()).toBe(403);
    expect(await s.db.activity.count({where:{userId:s.owner.id}})).toBe(before);
    const interval=await s.create(s.owner,work,{runSegments,distance:6,pace:6,proofUrls:[work,recovery]});
    expect(interval.proofUrls).toEqual([work,recovery]);expect(interval.points).toBe(13);
    for (const proofUrls of [[work],[work,work]]) expect((await s.owner.api.patch(`/api/activities/${interval.id}`,{data:{proofUrls}})).status()).toBe(400);
    const unchanged=await s.db.activity.findUniqueOrThrow({where:{id:interval.id}});
    expect(unchanged.proofUrls).toEqual([work,recovery]);expect(unchanged.runSegments).toEqual(runSegments);
    const steady=await s.create(s.owner,work,{distance:7,pace:6,activityDate:'2026-09-04'});
    await body(await s.admin.api.post(`/api/admin/activities/${steady.id}/approve`,{data:{}}));
    const proposed={activityDate:'2026-09-04',category:'RUN',distance:6,pace:6,runSegments,duration:null,companionUserId:null,proofUrl:work};
    const correction=()=>s.owner.api.post('/api/corrections',{data:{activityId:steady.id,reason:'Correct this steady entry into work and recovery segments',proposed}});
    expect((await correction()).status()).toBe(400);
    // A malformed legacy gallery with a repeated URL is still only one proof.
    await s.db.activity.update({where:{id:steady.id},data:{proofUrls:[work,work]}});
    expect((await correction()).status()).toBe(400);
    await s.db.activity.update({where:{id:steady.id},data:{proofUrls:[work,recovery]}});
    const approved=await body(await correction(),201);
    await body(await s.admin.api.post('/api/admin/corrections',{data:{id:approved.id,decision:'APPROVED',reason:'Verified separate owned work and recovery photos'}}));
    const corrected=await s.db.activity.findUniqueOrThrow({where:{id:steady.id}});
    expect(corrected.runSegments).toEqual(runSegments);expect(corrected.proofUrls).toEqual([work,recovery]);expect(corrected.points).toBe(13);
  } finally {await s.cleanup();}
});

test('new cycling submissions use version two while legacy rebuilds and corrections retain version one', async ({browser,baseURL})=>{
  const s=await accounts(browser,baseURL);
  try {
    const proof=await s.upload(s.owner);
    const old=await s.create(s.owner,proof,{category:'CYCLE',distance:20,pace:undefined});
    // Model an already-saved pre-release row in this synthetic database only.
    await s.db.activity.update({where:{id:old.id},data:{cycleScoringVersion:1,points:6.5}});
    await s.db.pointsLog.update({where:{activityId:old.id},data:{basePoints:6.67,friendBonus:0,totalPoints:6.5}});
    await body(await s.admin.api.post(`/api/admin/activities/${old.id}/approve`,{data:{}}));
    const legacyBefore=await s.db.activity.findUniqueOrThrow({where:{id:old.id}});
    expect(legacyBefore.cycleScoringVersion).toBe(1);expect(legacyBefore.points).toBe(6.5);
    const fresh=await s.create(s.owner,await s.upload(s.owner),{category:'CYCLE',distance:20,pace:1,activityDate:'2026-09-03',cycleScoringVersion:1});
    expect(fresh.cycleScoringVersion).toBe(2);expect(fresh.points).toBe(9.6);
    await body(await s.admin.api.post(`/api/admin/activities/${fresh.id}/approve`,{data:{}}));
    await body(await s.admin.api.post('/api/admin/control',{data:{action:'scores.recalculate',payload:{confirmation:'RECALCULATE'}}}));
    const legacyAfter=await s.db.activity.findUniqueOrThrow({where:{id:old.id}});
    expect(legacyAfter.cycleScoringVersion).toBe(1);expect(legacyAfter.points).toBe(legacyBefore.points);
    expect((await s.db.pointsLog.findUniqueOrThrow({where:{activityId:old.id}})).totalPoints).toBe(6.5);
    expect((await s.db.activity.findUniqueOrThrow({where:{id:fresh.id}})).points).toBe(9.6);
    const request=await body(await s.owner.api.post('/api/corrections',{data:{activityId:old.id,reason:'Correct the old ride distance without changing its scoring version',proposed:{activityDate:'2026-09-02',category:'CYCLE',distance:40,pace:null,duration:null,companionUserId:null,proofUrl:proof}}}),201);
    await body(await s.admin.api.post('/api/admin/corrections',{data:{id:request.id,decision:'APPROVED',reason:'Verified corrected distance on the original ride proof'}}));
    const corrected=await s.db.activity.findUniqueOrThrow({where:{id:old.id}});
    expect(corrected.cycleScoringVersion).toBe(1);expect(corrected.points).toBe(13);
    const history=await body(await s.owner.api.get('/api/corrections'));
    const saved=history.find(row=>row.id===request.id);
    for(const key of ['original','proposed','applied']) expect(saved[key].cycleScoringVersion).toBe(1);
    expect((await s.admin.api.patch(`/api/admin/activities/${old.id}`,{data:{totalPointsOverride:8.1}})).status()).toBe(400);
    await body(await s.admin.api.patch(`/api/admin/activities/${fresh.id}`,{data:{totalPointsOverride:8.1}}));
    expect((await s.db.activity.findUniqueOrThrow({where:{id:fresh.id}})).points).toBe(8.1);
  } finally {await s.cleanup();}
});

test('mobile interval form requires both Work and Recovery photos before submission', async ({browser,baseURL})=>{
  const s=await accounts(browser,baseURL);
  try {
    const page=s.owner.page;
    await page.goto('/activities/new');
    await page.getByRole('button',{name:'Interval run',exact:true}).click();
    await page.getByLabel('Date',{exact:true}).fill('2026-09-05');
    await page.getByPlaceholder('4.00',{exact:true}).fill('4');
    await page.getByPlaceholder('2.00',{exact:true}).fill('2');
    await page.getByPlaceholder('4:20',{exact:true}).fill('430');
    await page.getByPlaceholder('8:00',{exact:true}).fill('900');
    const submit=page.getByRole('button',{name:'Submit for review',exact:true});
    await expect(submit).toBeDisabled();
    await page.getByLabel('Choose work photo',{exact:true}).setInputFiles({name:'work.png',mimeType:'image/png',buffer:PNG});
    await expect(page.getByAltText('Work photo proof',{exact:true})).toBeVisible();
    await expect(submit).toBeDisabled();
    await page.getByLabel('Choose recovery photo',{exact:true}).setInputFiles({name:'recovery.png',mimeType:'image/png',buffer:PNG});
    await expect(page.getByAltText('Recovery photo proof',{exact:true})).toBeVisible();
    await expect(submit).toBeEnabled();
    await page.screenshot({path:'test-results/interval-separate-proofs-mobile.png',fullPage:true});
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/activities'&&r.request().method()==='POST');
    await submit.click();
    const created=await body(await response,201);
    expect(created.runSegments).toEqual([{kind:'WORK',distance:4,pace:4.5},{kind:'RECOVERY',distance:2,pace:9}]);
    expect(new Set(created.proofUrls).size).toBe(2);expect(created.points).toBe(13);
  } finally {await s.cleanup();}
});
