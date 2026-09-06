const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function assertDisposable(baseURL) {
  const db = new URL(process.env.DATABASE_URL || 'http://invalid');
  const app = new URL(baseURL);
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || db.pathname !== '/fitness_tracker_e2e' || !['127.0.0.1','localhost'].includes(db.hostname) || !['127.0.0.1','localhost'].includes(app.hostname)) throw new Error('Only the disposable localhost CI app/database may run these mutation tests.');
}
async function json(response, status = 200) {
  const text = await response.text();
  expect(response.status(), text).toBe(status);
  return JSON.parse(text);
}
async function login(browser, baseURL, user, password) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(10000);
  const csrf = await json(await context.request.get('/api/auth/csrf'));
  await json(await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: `${baseURL}/dashboard`, json: 'true' } }));
  expect((await json(await context.request.get('/api/auth/session'))).user.id).toBe(user.id);
  return context;
}
function values(activity, changes = {}) {
  return { activityDate: new Date(new Date(activity.occurredAt).getTime() + 8 * 3600000).toISOString().slice(0,10), category: activity.category, distance: activity.distance, pace: activity.pace, duration: activity.duration, companionUserId: activity.companionUserId, companionUserIds: activity.companionUserIds, proofUrl: activity.proofUrl, ...changes };
}

test('multiple friends persist across member/admin forms, corrections, scoring and backups', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  assertDisposable(baseURL);
  const db = new PrismaClient();
  const key = `friends_${randomUUID().replaceAll('-','')}`;
  const ids = [];
  const contexts = [];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'kg-friend-test-'));
  const column = await db.column.create({ data: { id: `${key}_column`, name: key } });
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Synthetic test password is required');
  let backupId;
  try {
    const accounts = {};
    const hash = await bcrypt.hash(password,10);
    for (const name of ['member','friend1','friend2','friend3','admin']) {
      const id = `${key}_${name}`; ids.push(id);
      accounts[name] = await db.user.create({ data: { id, name: `Group ${name}`, email: `${id}@example.test`, password: hash, role: name==='admin'?'ADMIN':'MEMBER', columnId: column.id } });
    }
    const member = await login(browser,baseURL,accounts.member,password); contexts.push(member);
    const admin = await login(browser,baseURL,accounts.admin,password); contexts.push(admin);
    const page = await member.newPage();
    const friendIds = [accounts.friend1.id,accounts.friend2.id];
    const [settings] = await db.$queryRaw`SELECT "scoringRules" FROM "ChallengeSetting" WHERE id='primary'`;
    const bonus = settings.scoringRules.friendBonus;
    const solo = await json(await member.request.post('/api/activities', { data: { activityDate:'2026-09-01',category:'RUN',distance:5,pace:6 } }),201);
    const one = await json(await member.request.post('/api/activities', { data: { activityDate:'2026-09-02',category:'RUN',distance:5,pace:6,companionUserId:friendIds[0] } }),201);
    expect(one.companionUserIds).toEqual([friendIds[0]]);
    expect(one.points-solo.points).toBeCloseTo(bonus,8);

    await page.goto('/activities/new');
    await page.getByLabel(/^Activity date/).fill('2026-09-03');
    await page.getByPlaceholder('e.g. 5.00').fill('5');
    await page.getByPlaceholder('e.g. 6:30').fill('6');
    await page.getByRole('checkbox',{name:'I completed this with friends',exact:true}).check();
    const picker = page.getByRole('group',{name:'Friends',exact:true});
    await picker.getByLabel('Search friends',{exact:true}).fill('Group friend1');
    await picker.getByRole('checkbox',{name:'Group friend1',exact:true}).check();
    await picker.getByLabel('Search friends',{exact:true}).fill('Group friend2');
    await picker.getByRole('checkbox',{name:'Group friend2',exact:true}).check();
    await picker.getByLabel('Search friends',{exact:true}).fill('');
    await expect(picker).toContainText('2 friends selected');
    await expect(picker.getByRole('checkbox',{name:'Group member',exact:true})).toHaveCount(0);
    await page.reload();
    await expect(picker.getByRole('checkbox',{name:'Group friend1',exact:true})).toBeChecked();
    await expect(picker.getByRole('checkbox',{name:'Group friend2',exact:true})).toBeChecked();
    await picker.getByRole('button',{name:'Remove Group friend1',exact:true}).click();
    await expect(picker).toContainText('1 friend selected');
    await picker.getByRole('checkbox',{name:'Group friend1',exact:true}).check();
    const submitted = page.waitForResponse(r => new URL(r.url()).pathname==='/api/activities' && r.request().method()==='POST');
    await page.getByRole('button',{name:'Submit for review',exact:true}).click();
    let group = await json(await submitted,201);
    await expect(page).toHaveURL(/\/dashboard/);
    expect(group.companionUserIds).toEqual([...friendIds].sort());
    expect(group.companion).toBe('Group friend1, Group friend2');
    expect(group.points).toBeCloseTo(one.points,8);
    expect(await db.activity.count({where:{userId:{in:friendIds}}})).toBe(0);
    expect(await db.weeklyScore.count({where:{userId:{in:friendIds}}})).toBe(0);

    const beforeInvalid = await db.activity.count({where:{userId:accounts.member.id}});
    for (const companionUserIds of [[accounts.member.id],['missing-friend'],[accounts.admin.id],Array(101).fill(friendIds[0])]) {
      await json(await member.request.post('/api/activities',{data:{activityDate:'2026-09-04',category:'RUN',distance:5,pace:6,companionUserIds}}),400);
    }
    expect(await db.activity.count({where:{userId:accounts.member.id}})).toBe(beforeInvalid);
    const deduped = await json(await member.request.post('/api/activities',{data:{activityDate:'2026-09-04',category:'RUN',distance:5,pace:6,companionUserIds:[...friendIds,friendIds[0]]}}),201);
    expect(deduped.companionUserIds).toEqual([...friendIds].sort());
    expect(deduped.points).toBeCloseTo(one.points,8);

    // Pending changes preserve the whole set, and clearing removes one bonus.
    group = await json(await member.request.patch(`/api/activities/${group.id}`,{data:{distance:5.5}}));
    expect(group.companionUserIds).toEqual([...friendIds].sort());
    group = await json(await admin.request.post(`/api/admin/activities/${group.id}/approve`,{data:{}}));
    group = await json(await admin.request.patch(`/api/admin/activities/${group.id}`,{data:{distance:5.75}}));
    expect(group.companionUserIds).toEqual([...friendIds].sort());
    const approvedPoints = group.points;

    await page.goto(`/activities/${group.id}/correction`);
    const correctionPicker = page.getByRole('group',{name:'Friends',exact:true});
    await expect(correctionPicker.getByRole('checkbox',{name:'Group friend1',exact:true})).toBeChecked();
    await expect(correctionPicker.getByRole('checkbox',{name:'Group friend2',exact:true})).toBeChecked();
    await correctionPicker.getByLabel('Search friends',{exact:true}).fill('Group friend3');
    await correctionPicker.getByRole('checkbox',{name:'Group friend3',exact:true}).check();
    await page.getByLabel('Reason for correction').fill('A third registered friend also joined this workout.');
    const requested = page.waitForResponse(r => new URL(r.url()).pathname==='/api/corrections' && r.request().method()==='POST');
    await page.getByRole('button',{name:'Send correction request',exact:true}).click();
    const correction = await json(await requested,201);
    expect((await db.activity.findUnique({where:{id:group.id}})).companionUserIds).toHaveLength(2);
    expect((await db.activity.findUnique({where:{id:group.id}})).points).toBe(approvedPoints);
    const decision = await json(await admin.request.post('/api/admin/corrections',{data:{id:correction.id,decision:'APPROVED',reason:'Verified all three friends against the workout evidence.'}}));
    expect(decision.applied.companionUserIds).toHaveLength(3);
    expect(decision.applied.points).toBe(approvedPoints);
    await json(await admin.request.post('/api/admin/corrections',{data:{id:correction.id,decision:'APPROVED',reason:'Repeated decision should never apply the points twice.'}}),409);
    group = await db.activity.findUnique({where:{id:group.id}});
    await json(await member.request.post('/api/corrections',{data:{activityId:group.id,reason:'Only ordering changed, which is not an actual correction.',proposed:values(group,{companionUserIds:[...group.companionUserIds].reverse()})}}),400);
    const clearing = await json(await member.request.post('/api/corrections',{data:{activityId:group.id,reason:'This entry should be recorded as a solo workout.',proposed:values(group,{companionUserId:null,companionUserIds:[]})}}),201);
    const cleared = await json(await admin.request.post('/api/admin/corrections',{data:{id:clearing.id,decision:'APPROVED',reason:'Verified this was a solo workout.'}}));
    expect(cleared.applied.points).toBeCloseTo(approvedPoints-bonus,8);
    expect(cleared.applied.companionUserIds).toEqual([]);

    // The admin picker excludes the selected participant, not merely the admin.
    const adminPage = await admin.newPage();
    await adminPage.goto('/admin/activities/new');
    await adminPage.getByRole('combobox').first().selectOption(accounts.member.id);
    const adminPicker = adminPage.getByRole('group',{name:'Friends',exact:true});
    await adminPicker.getByLabel('Search friends',{exact:true}).fill('Group friend1');
    await adminPicker.getByRole('checkbox',{name:'Group friend1',exact:true}).check();
    await adminPicker.getByLabel('Search friends',{exact:true}).fill('Group friend2');
    await adminPicker.getByRole('checkbox',{name:'Group friend2',exact:true}).check();
    await adminPage.getByRole('combobox').first().selectOption(accounts.friend1.id);
    await expect(adminPicker).toContainText('1 friend selected');
    await adminPicker.getByLabel('Search friends',{exact:true}).fill('');
    await expect(adminPicker.getByRole('checkbox',{name:'Group friend1',exact:true})).toHaveCount(0);
    await adminPage.getByRole('combobox').first().selectOption(accounts.member.id);
    await adminPicker.getByRole('checkbox',{name:'Group friend1',exact:true}).check();
    await adminPage.getByLabel('Activity date',{exact:true}).fill('2026-09-05');
    await adminPage.getByLabel('Distance (km)',{exact:true}).fill('3');
    await adminPage.getByPlaceholder('6:30 or 6.5').fill('6');
    const adminSubmitted = adminPage.waitForResponse(r => new URL(r.url()).pathname==='/api/admin/activities/create' && r.request().method()==='POST');
    await adminPage.locator('form button:not([type])').click();
    const adminCreated = await json(await adminSubmitted,201);
    expect(adminCreated.activity.userId).toBe(accounts.member.id);
    expect(adminCreated.activity.companionUserIds).toEqual([...friendIds].sort());
    await json(await admin.request.post(`/api/admin/activities/${adminCreated.activity.id}/approve`,{data:{}}));
    await expect(db.user.delete({where:{id:accounts.friend2.id}})).rejects.toThrow();
    expect(await db.user.findUnique({where:{id:accounts.friend2.id}})).not.toBeNull();

    const approved = await db.activity.findMany({where:{userId:accounts.member.id,status:'APPROVED'}});
    const scores = await db.weeklyScore.findMany({where:{userId:accounts.member.id}});
    expect(scores.reduce((n,s)=>n+s.totalPoints,0)).toBeCloseTo(approved.reduce((n,a)=>n+a.points,0),8);
    const social = await db.$queryRaw`SELECT current_value FROM app_internal.user_achievement WHERE user_id=${accounts.member.id} AND achievement_id='team-player'`;
    expect(social[0].current_value).toBe(approved.filter(a=>a.completedWithFriend&&a.companionUserId).length);
    expect(await db.weeklyScore.count({where:{userId:{in:[...friendIds,accounts.friend3.id,accounts.admin.id]}}})).toBe(0);

    const backup = await json(await admin.request.get('/api/admin/export?type=backup'));
    expect(backup.activities.find(a=>a.id===adminCreated.activity.id).companionUserIds).toHaveLength(2);
    const file = path.join(temp,'backup.json');
    fs.writeFileSync(file,JSON.stringify(backup),{mode:0o600});
    const valid = spawnSync(process.execPath,['scripts/validate-operational-backup.cjs',file],{encoding:'utf8'});
    expect(valid.status,valid.stderr).toBe(0);
    backupId = randomUUID();
    await db.$executeRaw`INSERT INTO app_internal.operational_backup(id,format,version,payload,checksum_sha256,counts) VALUES (${backupId}::uuid,'kg-stay-active-operational-backup',6,${JSON.stringify(backup)}::jsonb,'pending','{}'::jsonb)`;
    const [snapshot] = await db.$queryRaw`SELECT payload,checksum_sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex') AS valid FROM app_internal.operational_backup WHERE id=${backupId}::uuid`;
    expect(snapshot.valid).toBe(true);
    expect(snapshot.payload.activities.find(a=>a.id===adminCreated.activity.id).companionUserIds).toHaveLength(2);
    const invalid = structuredClone(backup); invalid.activities.find(a=>a.id===adminCreated.activity.id).companionUserIds=[accounts.member.id];
    fs.writeFileSync(file,JSON.stringify(invalid));
    expect(spawnSync(process.execPath,['scripts/validate-operational-backup.cjs',file]).status).toBe(1);
  } finally {
    for (const context of contexts) await context.close();
    if (backupId) await db.$executeRaw`DELETE FROM app_internal.operational_backup WHERE id=${backupId}::uuid`;
    await db.activity.deleteMany({where:{userId:{in:ids}}});
    await db.user.deleteMany({where:{id:{in:ids}}});
    await db.column.delete({where:{id:column.id}});
    await db.$disconnect();
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
