const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=', 'base64');
function assertDisposable(baseURL){const db=new URL(process.env.DATABASE_URL||'http://invalid'),app=new URL(baseURL);if(process.env.CI!=='true'||process.env.E2E_TEST_MODE!=='1'||db.pathname!=='/fitness_tracker_e2e'||!['localhost','127.0.0.1'].includes(db.hostname)||!['localhost','127.0.0.1'].includes(app.hostname))throw new Error('Disposable localhost CI required.');}
async function json(response,status=200){const text=await response.text();expect(response.status(),text).toBe(status);return JSON.parse(text);}
async function login(browser,baseURL,user,password){const context=await browser.newContext({baseURL,viewport:{width:390,height:844}});const csrf=await json(await context.request.get('/api/auth/csrf'));await json(await context.request.post('/api/auth/callback/credentials',{form:{csrfToken:csrf.csrfToken,email:user.email,password,callbackUrl:`${baseURL}/dashboard`,json:'true'}}));return context;}
async function upload(context,name){const response=await context.request.post('/api/upload',{multipart:{file:{name,mimeType:'image/png',buffer:PNG_1X1}}});expect(response.ok()).toBeTruthy();const data=await response.json();expect(data.url).toMatch(/^https:\/\/example\.invalid\/e2e-proof\//);return data.url;}

test('participants can attach multiple private proof photos and admins can vet all of them',async({browser,baseURL})=>{
  assertDisposable(baseURL);const db=new PrismaClient();const key=`multi_proof_${randomUUID().replaceAll('-','')}`;const password=process.env.E2E_PASSWORD;const contexts=[];if(!password)throw new Error('E2E_PASSWORD required');
  try{
    const column=await db.column.create({data:{id:`${key}_column`,name:key}});const hash=await bcrypt.hash(password,10);
    const member=await db.user.create({data:{id:`${key}_member`,name:'Multi Proof Member',email:`${key}_member@example.test`,password:hash,role:'MEMBER',columnId:column.id}});
    const stranger=await db.user.create({data:{id:`${key}_stranger`,name:'Other Member',email:`${key}_stranger@example.test`,password:hash,role:'MEMBER',columnId:column.id}});
    const admin=await db.user.create({data:{id:`${key}_admin`,name:'Multi Proof Admin',email:`${key}_admin@example.test`,password:hash,role:'ADMIN',columnId:column.id}});
    const memberContext=await login(browser,baseURL,member,password);contexts.push(memberContext);const strangerContext=await login(browser,baseURL,stranger,password);contexts.push(strangerContext);const adminContext=await login(browser,baseURL,admin,password);contexts.push(adminContext);
    const first=await upload(memberContext,'first.png'),second=await upload(memberContext,'second.png');
    const activity=await json(await memberContext.request.post('/api/activities',{data:{activityDate:'2026-09-02',category:'RUN',distance:5,pace:6,proofUrls:[first,second]}}),201);
    const stored=await db.activity.findUniqueOrThrow({where:{id:activity.id}});expect(stored.proofUrls).toEqual([first,second]);expect(stored.proofUrl).toBe(first);
    expect((await memberContext.request.get(`/api/proofs?ref=${encodeURIComponent(second)}`)).status()).toBe(200);
    expect((await strangerContext.request.get(`/api/proofs?ref=${encodeURIComponent(second)}`)).status()).toBe(404);
    expect((await adminContext.request.get(`/api/proofs?ref=${encodeURIComponent(second)}`)).status()).toBe(200);
    const tooMany=Array.from({length:6},(_,i)=>`https://example.invalid/e2e-proof/${member.id}/${i}.png`);
    expect((await memberContext.request.post('/api/activities',{data:{activityDate:'2026-09-03',category:'RUN',distance:4,pace:6,proofUrls:tooMany}})).status()).toBe(400);
    await json(await adminContext.request.post(`/api/admin/activities/${activity.id}/approve`,{data:{}}));
    const adminRows=await json(await adminContext.request.get('/api/admin/activities?status=ALL'));const adminActivity=adminRows.find(row=>row.id===activity.id);expect(adminActivity.proofUrls).toEqual([first,second]);
    const publicRows=await json(await memberContext.request.get(`/api/activities?userId=${member.id}`));const publicActivity=publicRows.find(row=>row.id===activity.id);expect(publicActivity).toBeTruthy();expect(publicActivity).not.toHaveProperty('proofUrl');expect(publicActivity).not.toHaveProperty('proofUrls');
    const page=await adminContext.newPage();await page.goto('/admin/score-overrides');const card=page.locator(`article[data-score-activity-id="${activity.id}"]`);await expect(card.getByRole('button',{name:"View Multi Proof Member's proof 1"})).toBeVisible();await expect(card.getByRole('button',{name:"View Multi Proof Member's proof 2"})).toBeVisible();
    const history=await memberContext.newPage();await history.goto('/activities/history');await history.locator(`details`).filter({hasText:'Run'}).first().click();await expect(history.getByRole('button',{name:/Enlarge Run activity screenshot 1/})).toBeVisible();await expect(history.getByRole('button',{name:/Enlarge Run activity screenshot 2/})).toBeVisible();
  } finally {for(const context of contexts)await context.close();await db.activity.deleteMany({where:{userId:{startsWith:key}}});await db.user.deleteMany({where:{id:{startsWith:key}}});await db.column.deleteMany({where:{id:`${key}_column`}});await db.$disconnect();}
});
