const { test: base, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

// Never point these mutation tests at a preview or production database.
function assertDisposable(baseURL) {
  const db = new URL(process.env.DATABASE_URL || 'http://invalid');
  const app = new URL(baseURL);
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1'
      || !['localhost', '127.0.0.1'].includes(db.hostname)
      || db.pathname !== '/fitness_tracker_e2e'
      || !['localhost', '127.0.0.1'].includes(app.hostname)) {
    throw new Error('Focused controls tests require the disposable localhost CI database and app.');
  }
}
async function json(response, status = 200) {
  const body = await response.text();
  expect(response.status(), body).toBe(status);
  return JSON.parse(body);
}
const defaults = { activity_reviews: true, correction_updates: true, achievements: true, weekly_results: true, goal_reminders: true };
const fields = { RUN: 'runPoints', CYCLE: 'cyclePoints', SWIM: 'swimPoints', WALK_OR_HIKE: 'hikePoints', TROOP_GAMES: 'troopGamePoints' };

const test = base.extend({
  sandbox: async ({ browser, baseURL }, use) => {
    assertDisposable(baseURL);
    const db = new PrismaClient();
    const key = `focused_${randomUUID().replaceAll('-', '')}`;
    const contexts = [];
    const ids = [];
    const password = process.env.E2E_PASSWORD;
    if (!password) throw new Error('E2E_PASSWORD must be set');
    const hash = await bcrypt.hash(password, 10);
    const column = await db.column.create({ data: { id: `${key}_column`, name: key } });
    const accounts = {};
    try {
      for (const name of ['member', 'other', 'admin']) {
        const id = `${key}_${name}`;
        ids.push(id);
        const user = await db.user.create({ data: { id, name: `Focused ${name}`, email: `${id}@example.test`, password: hash, role: name === 'admin' ? 'ADMIN' : 'MEMBER', columnId: column.id } });
        const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
        contexts.push(context);
        const csrf = await json(await context.request.get('/api/auth/csrf'));
        await json(await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: `${baseURL}/dashboard`, json: 'true' } }));
        const session = await json(await context.request.get('/api/auth/session'));
        expect(session.user.id).toBe(id);
        accounts[name] = { id, context, api: context.request, page: await context.newPage() };
      }
      const create = async (data = {}, approve = true) => {
        const activity = await json(await accounts.member.api.post('/api/activities', { data: { activityDate: '2026-09-02', category: 'RUN', distance: 5, pace: 6, ...data } }), 201);
        return approve ? json(await accounts.admin.api.post(`/api/admin/activities/${activity.id}/approve`, { data: {} })) : activity;
      };
      const proposed = (activity, changes = {}) => ({ activityDate: new Date(new Date(activity.occurredAt).getTime() + 8 * 3600000).toISOString().slice(0, 10), category: activity.category, distance: activity.distance, pace: activity.pace, duration: activity.duration, companionUserId: activity.companionUserId, proofUrl: activity.proofUrl, ...changes });
      const requestCorrection = (activity, changes = {}) => accounts.member.api.post('/api/corrections', { data: { activityId: activity.id, reason: 'Correct the recorded workout details', proposed: proposed(activity, changes) } });
      const decide = (id, decision = 'APPROVED', extra = {}) => accounts.admin.api.post('/api/admin/corrections', { data: { id, decision, reason: 'Checked the supporting workout evidence', ...extra } });
      const setMode = async (mode) => {
        const state = await json(await accounts.admin.api.get('/api/admin/maintenance'));
        return json(await accounts.admin.api.post('/api/admin/maintenance', { data: { mode, message: 'Disposable CI maintenance test', confirmation: mode, expectedUpdatedAt: state.updatedAt } }));
      };
      await use({ db, key, column, ...accounts, create, proposed, requestCorrection, decide, setMode });
    } finally {
      // Cleanup is deliberately restricted by assertDisposable above. A failed
      // lock test must not poison the subsequent independent regression tests.
      await db.$executeRaw`UPDATE "ChallengeSetting" SET "readOnlyMode"=false,"maintenanceMode"=false,"updatedAt"=CURRENT_TIMESTAMP WHERE id='primary'`;
      for (const context of contexts) await context.close();
      await db.activity.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.column.delete({ where: { id: column.id } });
      await db.$disconnect();
    }
  },
});

async function reconcile(db, userId) {
  const activities = await db.activity.findMany({ where: { userId, status: 'APPROVED' } });
  const scores = await db.weeklyScore.findMany({ where: { userId } });
  for (const score of scores) {
    const entries = activities.filter((a) => a.weekStart.getTime() === score.weekStart.getTime());
    expect(score.totalPoints).toBeCloseTo(entries.reduce((sum, a) => sum + a.points, 0), 8);
    for (const [category, field] of Object.entries(fields)) {
      expect(score[field]).toBeGreaterThanOrEqual(0);
      expect(score[field]).toBeCloseTo(entries.filter((a) => a.category === category).reduce((sum, a) => sum + a.points, 0), 8);
    }
  }
  for (const activity of activities) expect(scores.some((s) => s.weekStart.getTime() === activity.weekStart.getTime())).toBe(true);
}

test('correction mobile workflow preserves points until reviewed and moves the correct week/category', async ({ sandbox: s }) => {
  const activity = await s.create();
  expect((await s.member.api.patch(`/api/activities/${activity.id}`, { data: { activityDate: '2026-09-06' } })).status()).toBe(409);
  expect((await s.other.api.post('/api/corrections', { data: { activityId: activity.id, reason: 'Attempt by another account', proposed: s.proposed(activity, { distance: 8 }) } })).status()).toBe(404);
  await s.member.page.goto(`/activities/${activity.id}/correction`);
  await s.member.page.getByLabel('Activity date (Singapore)').fill('2026-09-06');
  await s.member.page.getByLabel('Activity type', { exact: true }).selectOption('CYCLE');
  await s.member.page.getByLabel('Distance (km)', { exact: true }).fill('30');
  await s.member.page.getByLabel('Reason for correction').fill('The imported distance and date were incorrect.');
  await s.member.page.getByRole('button', { name: 'Send correction request' }).click();
  await expect(s.member.page.getByRole('link', { name: 'Track my request' })).toBeVisible();
  const requests = await json(await s.member.api.get('/api/corrections'));
  const correction = requests.find((r) => r.activityId === activity.id);
  expect(correction.status).toBe('OPEN');
  expect((await s.requestCorrection(activity, { distance: 9 })).status()).toBe(409);
  expect(await json(await s.other.api.get('/api/corrections'))).toEqual([]);
  expect((await s.member.api.post('/api/admin/corrections', { data: { id: correction.id, decision: 'APPROVED', reason: 'Owner tries approving self' } })).status()).toBe(403);
  const before = await s.db.activity.findUnique({ where: { id: activity.id } });
  expect(before.points).toBe(activity.points);
  expect(before.weekNumber).toBe(activity.weekNumber);
  await reconcile(s.db, s.member.id);
  await s.admin.page.goto('/admin/corrections');
  const card = s.admin.page.locator('article').filter({ hasText: activity.id });
  await expect(card.getByRole('heading', { name: 'Original approved entry' })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Proposed correction' })).toBeVisible();
  await card.getByLabel('Decision explanation').fill('Evidence confirms the revised cycling entry.');
  s.admin.page.once('dialog', (dialog) => dialog.accept());
  const decisionResponse = s.admin.page.waitForResponse((r) => r.url().endsWith('/api/admin/corrections') && r.request().method() === 'POST');
  await card.getByRole('button', { name: 'Approve correction', exact: true }).click();
  const result = await json(await decisionResponse);
  expect(result.status).toBe('APPROVED');
  expect(result.dirtyWeeks).toContain(1);
  const corrected = await s.db.activity.findUnique({ where: { id: activity.id } });
  expect(corrected).toMatchObject({ category: 'CYCLE', distance: 30, points: 10, weekNumber: 2, status: 'APPROVED', reviewedById: s.admin.id });
  await reconcile(s.db, s.member.id);
  const total = await s.db.weeklyScore.aggregate({ where: { userId: s.member.id }, _sum: { totalPoints: true } });
  expect(total._sum.totalPoints).toBe(10);
  const leaderboard = await json(await s.member.api.get('/api/leaderboard?type=individual'));
  expect(leaderboard.leaderboard.find((r) => r.userId === s.member.id).totalPoints).toBe(10);
  expect((await s.decide(correction.id)).status()).toBe(409);
});

test('corrections reject, cancel, fail stale approvals, and resist repeat/concurrent decisions', async ({ sandbox: s }) => {
  const activity = await s.create();
  const rejected = await json(await s.requestCorrection(activity, { distance: 7 }), 201);
  expect((await s.other.api.patch('/api/corrections', { data: { id: rejected.id, action: 'cancel' } })).status()).toBe(409);
  await json(await s.decide(rejected.id, 'REJECTED'));
  expect((await s.db.activity.findUnique({ where: { id: activity.id } })).points).toBe(activity.points);
  const cancelled = await json(await s.requestCorrection(activity, { distance: 8 }), 201);
  await json(await s.member.api.patch('/api/corrections', { data: { id: cancelled.id, action: 'cancel' } }));
  expect((await s.decide(cancelled.id)).status()).toBe(409);
  const stale = await json(await s.requestCorrection(activity, { distance: 9 }), 201);
  await json(await s.admin.api.patch(`/api/admin/activities/${activity.id}`, { data: { distance: 6 } }));
  const changed = await s.db.activity.findUnique({ where: { id: activity.id } });
  const staleResult = await json(await s.decide(stale.id), 409);
  expect(staleResult.status).toBe('STALE');
  expect((await s.db.activity.findUnique({ where: { id: activity.id } })).points).toBe(changed.points);
  const fresh = await json(await s.requestCorrection(changed, { distance: 10 }), 201);
  const outcomes = await Promise.all([s.decide(fresh.id), s.decide(fresh.id)]);
  expect(outcomes.map((r) => r.status()).sort()).toEqual([200, 409]);
  await reconcile(s.db, s.member.id);
});

test('corrections enforce challenge dates, real companions and duplicate review', async ({ sandbox: s }) => {
  const activity = await s.create();
  expect((await s.requestCorrection(activity, { activityDate: '2026-08-31' })).status()).toBe(400);
  expect((await s.requestCorrection(activity, { companionUserId: s.member.id })).status()).toBe(400);
  expect((await s.requestCorrection(activity, { companionUserId: 'missing-participant' })).status()).toBe(400);
  expect((await s.requestCorrection(activity, { proofUrl: 'javascript:alert(1)' })).status()).toBe(400);
  const candidate = await s.create({ distance: 10 });
  const correction = await json(await s.requestCorrection(activity, { distance: 10 }), 201);
  const blocked = await json(await s.decide(correction.id), 409);
  expect(blocked.details.matches.some((r) => r.id === candidate.id)).toBe(true);
  expect((await s.db.activity.findUnique({ where: { id: activity.id } })).distance).toBe(5);
  const approved = await json(await s.decide(correction.id, 'APPROVED', { duplicateOverrideReason: 'Evidence confirms these were two separate sessions.' }));
  expect(approved.status).toBe('APPROVED');
  await reconcile(s.db, s.member.id);
});

test('notification choices are account-isolated, survive a new session, and filter bell/full page', async ({ sandbox: s }) => {
  const activity = await s.create();
  const correction = await json(await s.requestCorrection(activity, { distance: 8 }), 201);
  await json(await s.decide(correction.id, 'REJECTED'));
  for (const kind of ['WEEKLY_RESULT', 'WEEKLY_AWARD', 'WEEKLY_GOAL', 'SECURITY']) {
    await s.db.$executeRaw`INSERT INTO app_internal.notification(id,user_id,kind,level,title,message,href,dedupe_key) VALUES (${randomUUID()}::uuid,${s.member.id},${kind},'info',${`Focused ${kind}`},'Test notification','/notifications',${`${s.key}:${kind}`})`;
  }
  await s.member.page.goto('/account/notifications');
  for (const checkbox of await s.member.page.getByRole('checkbox').all()) await checkbox.uncheck();
  await s.member.page.getByRole('button', { name: 'Save notification preferences' }).click();
  await expect(s.member.page.getByRole('status')).toContainText('saved');
  const expected = Object.fromEntries(Object.keys(defaults).map((key) => [key, false]));
  expect(await json(await s.member.api.get('/api/account/notifications'))).toEqual(expected);
  expect(await json(await s.other.api.get('/api/account/notifications'))).toEqual(defaults);
  expect((await s.member.api.post('/api/account/notifications', { data: { ...expected, userId: s.other.id } })).status()).toBe(400);
  expect((await s.member.api.post('/api/account/notifications', { data: expected, headers: { origin: 'https://untrusted.example' } })).status()).toBe(403);
  const newContext = await s.member.context.browser().newContext({ baseURL: s.member.page.url().split('/account/')[0], storageState: await s.member.context.storageState() });
  try { expect(await json(await newContext.request.get('/api/account/notifications'))).toEqual(expected); } finally { await newContext.close(); }
  const notifications = await json(await s.member.api.get('/api/notifications'));
  expect(notifications.map((n) => n.kind)).toEqual(['SECURITY']);
  await s.member.page.goto('/notifications');
  await expect(s.member.page.getByText('Focused SECURITY', { exact: true })).toBeVisible();
  await expect(s.member.page.getByText('Activity approved', { exact: true })).toHaveCount(0);
  await s.member.page.getByRole('button', { name: /^Notifications/ }).first().click();
  await expect(s.member.page.getByText('Activity approved', { exact: true })).toHaveCount(0);
  expect((await s.db.activity.findUnique({ where: { id: activity.id } })).status).toBe('APPROVED');
});

test('pause/read-only controls protect HTTP and database writes but preserve secure unlock', async ({ sandbox: s }) => {
  const pending = await s.create({}, false);
  expect((await s.member.api.get('/api/admin/maintenance')).status()).toBe(403);
  const previous = await json(await s.admin.api.get('/api/admin/maintenance'));
  expect((await s.admin.api.post('/api/admin/maintenance', { data: { mode: 'READ_ONLY', message: 'Test lock', confirmation: 'WRONG', expectedUpdatedAt: previous.updatedAt } })).status()).toBe(400);
  await s.setMode('PAUSED');
  expect((await s.member.api.post('/api/activities', { data: {} })).status()).toBe(423);
  expect((await s.member.api.post('/api/strava/sync')).status()).toBe(423);
  expect((await s.member.api.post('/api/upload')).status()).toBe(423);
  expect((await s.member.api.post('/api/corrections', { data: {} })).status()).toBe(423);
  await json(await s.admin.api.post(`/api/admin/activities/${pending.id}/approve`, { data: {} }));
  await s.setMode('READ_ONLY');
  for (const url of ['/api/activities', `/api/admin/activities/${pending.id}/approve`, '/api/admin/corrections', '/api/admin/control', '/api/admin/awards/generate', '/api/strava/sync']) {
    expect((await s.admin.api.post(url, { data: {} })).status(), url).toBe(423);
  }
  expect((await s.member.api.delete(`/api/activities/${pending.id}`)).status()).toBe(423);
  await expect(s.db.activity.update({ where: { id: pending.id }, data: { distance: 123 } })).rejects.toThrow(/COMPETITION_READ_ONLY/);
  await expect(s.db.$executeRawUnsafe('DELETE FROM "WeeklyScore" WHERE false')).rejects.toThrow(/COMPETITION_READ_ONLY/);
  await expect(s.db.$executeRawUnsafe('DELETE FROM app_internal.weekly_result WHERE false')).rejects.toThrow(/COMPETITION_READ_ONLY/);
  expect((await s.member.api.get('/api/activities')).status()).toBe(200);
  expect((await s.member.api.get('/api/account/notifications')).status()).toBe(200);
  expect((await s.admin.api.get('/api/admin/maintenance')).status()).toBe(200);
  expect((await s.admin.api.post('/api/admin/maintenance', { data: { mode: 'NORMAL', message: 'Outdated request', confirmation: 'NORMAL', expectedUpdatedAt: previous.updatedAt } })).status()).toBe(409);
  const unlocked = await s.setMode('NORMAL');
  expect(unlocked.mode).toBe('NORMAL');
  await json(await s.admin.api.patch(`/api/admin/activities/${pending.id}`, { data: { distance: 6 } }));
  await reconcile(s.db, s.member.id);
  const audit = await s.db.$queryRaw`SELECT details FROM "AdminAudit" WHERE "actorId"=${s.admin.id} AND action='MAINTENANCE_MODE_CHANGED'`;
  expect(audit.map((r) => r.details.mode)).toEqual(expect.arrayContaining(['PAUSED', 'READ_ONLY', 'NORMAL']));
});

test('achievement awards are approved-only, idempotent, reversible and silently backfilled', async ({ sandbox: s }) => {
  const activity = await s.create({ distance: 60, pace: 5.5 }, false);
  const badge = async (id) => (await s.db.$queryRaw`SELECT * FROM app_internal.user_achievement WHERE user_id=${s.member.id} AND achievement_id=${id}`)[0];
  expect((await badge('first-move')).unlocked).toBe(false);
  await json(await s.admin.api.post(`/api/admin/activities/${activity.id}/approve`, { data: {} }));
  expect((await badge('first-move')).unlocked).toBe(true);
  expect((await badge('points-100')).unlocked).toBe(true);
  const notificationCount = async () => (await s.db.$queryRaw`SELECT count(*)::int AS n FROM app_internal.notification WHERE user_id=${s.member.id} AND kind='ACHIEVEMENT'`)[0].n;
  const initial = await notificationCount();
  expect(initial).toBeGreaterThan(0);
  await s.db.$executeRaw`SELECT app_internal.refresh_user_achievements(${s.member.id},true)`;
  await s.db.$executeRaw`SELECT app_internal.refresh_user_achievements(${s.member.id},true)`;
  expect(await notificationCount()).toBe(initial);
  const current = await s.db.activity.findUnique({ where: { id: activity.id } });
  const correction = await json(await s.requestCorrection(current, { distance: 2 }), 201);
  await json(await s.decide(correction.id));
  expect((await badge('points-100')).unlocked).toBe(false);
  expect((await badge('points-100')).revoked_at).not.toBeNull();
  await json(await s.admin.api.post(`/api/admin/activities/${activity.id}/reject`, { data: { reason: 'Rejected test workout' } }));
  expect((await badge('first-move')).unlocked).toBe(false);
  expect(await notificationCount()).toBe(0);
  await json(await s.admin.api.post(`/api/admin/activities/${activity.id}/approve`, { data: {} }));
  expect((await badge('first-move')).unlocked).toBe(true);
  expect(await notificationCount()).toBe(0);
  // Exercise the migration's silent backfill option with a fresh history row.
  await s.db.$executeRaw`DELETE FROM app_internal.user_achievement WHERE user_id=${s.member.id}`;
  await s.db.$executeRaw`SELECT app_internal.refresh_user_achievements(${s.member.id},false)`;
  expect((await badge('first-move')).unlocked).toBe(true);
  expect(await notificationCount()).toBe(0);
  await reconcile(s.db, s.member.id);
});

test('new feature records and PointsLog are exported while the legacy v6 snapshot checksum validates', async ({ sandbox: s }, testInfo) => {
  const activity = await s.create();
  await json(await s.requestCorrection(activity, { distance: 8 }), 201);
  await json(await s.member.api.post('/api/account/notifications', { data: { ...defaults, achievements: false } }));
  expect((await s.member.api.get('/api/admin/export?type=backup')).status()).toBe(403);
  const backup = await json(await s.admin.api.get('/api/admin/export?type=backup'));
  expect(backup.version).toBe(7);
  expect(backup.activityCorrections.some((r) => r.user_id === s.member.id)).toBe(true);
  expect(backup.notificationPreferences.some((r) => r.user_id === s.member.id)).toBe(true);
  expect(backup.achievementDefinitions.length).toBeGreaterThanOrEqual(22);
  expect(backup.userAchievements.some((r) => r.user_id === s.member.id)).toBe(true);
  const file = testInfo.outputPath('focused-backup.json');
  fs.writeFileSync(file, JSON.stringify(backup));
  const checked = spawnSync(process.execPath, ['scripts/validate-operational-backup.cjs', file], { encoding: 'utf8' });
  expect(checked.status, checked.stderr).toBe(0);
  // Trigger path used by both scheduled backup insertion and its enrichment.
  const backupId = randomUUID();
  await s.db.$executeRaw`INSERT INTO app_internal.operational_backup(id,format,version,payload,checksum_sha256,counts) VALUES (${backupId}::uuid,'kg-stay-active-operational-backup',5,${JSON.stringify(backup)}::jsonb,'pending','{}'::jsonb)`;
  const rows = await s.db.$queryRaw`SELECT version,payload,counts,checksum_sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex') AS valid FROM app_internal.operational_backup WHERE id=${backupId}::uuid`;
  expect(rows[0].version).toBe(6);
  expect(rows[0].valid).toBe(true);
  expect(rows[0].counts.activityCorrections).toBeGreaterThan(0);
  const text = JSON.stringify(rows[0].payload);
  expect(text).not.toContain('stravaAccessToken');
  expect(text).not.toContain('"password":');
  const malformed = { ...backup, notificationPreferences: [{ user_id: 'unknown', ...defaults }] };
  fs.writeFileSync(file, JSON.stringify(malformed));
  expect(spawnSync(process.execPath, ['scripts/validate-operational-backup.cjs', file]).status).toBe(1);
});
