const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

async function json(response, status = 200) {
  const text = await response.text();
  expect(response.status(), text).toBe(status);
  return JSON.parse(text);
}

async function withFixture(browser, baseURL, work) {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || url.pathname !== '/fitness_tracker_e2e'
    || !['localhost', '127.0.0.1'].includes(url.hostname)
    || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Disposable localhost CI app/database required.');
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Synthetic test password required.');
  const db = new PrismaClient();
  const key = `daily_release_${randomUUID().replaceAll('-', '')}`;
  const ids = [];
  const contexts = [];
  const accounts = {};
  try {
    await db.column.create({ data: { id: key, name: key } });
    const hash = await bcrypt.hash(password, 10);
    for (const role of ['member', 'friend', 'admin']) {
      const id = `${key}_${role}`;
      const user = await db.user.create({ data: {
        id, name: `${key} ${role}`, email: `${id}@example.test`, password: hash,
        role: role === 'admin' ? 'ADMIN' : 'MEMBER', columnId: key,
      } });
      ids.push(id);
      const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
      contexts.push(context);
      const csrf = await json(await context.request.get('/api/auth/csrf'));
      await json(await context.request.post('/api/auth/callback/credentials', { form: {
        csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: `${baseURL}/dashboard`, json: 'true',
      } }));
      expect((await json(await context.request.get('/api/auth/session'))).user.id).toBe(id);
      accounts[role] = { ...user, context, api: context.request };
    }
    const create = async (data = {}, approve = true) => {
      const activity = await json(await accounts.member.api.post('/api/activities', { data: {
        activityDate: '2026-09-02', category: 'RUN', distance: 5, pace: 6,
        companionUserIds: [accounts.friend.id], ...data,
      } }), 201);
      return approve ? json(await accounts.admin.api.post(`/api/admin/activities/${activity.id}/approve`, { data: {} })) : activity;
    };
    await work({ db, accounts, create, key });
  } finally {
    for (const context of contexts) await context.close();
    try {
      await db.activity.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.column.deleteMany({ where: { id: key } });
    } finally { await db.$disconnect(); }
  }
}

test('small positive workouts use the same friend eligibility in estimates and final allocation', async ({ browser, baseURL }) => {
  await withFixture(browser, baseURL, async ({ db, accounts, create }) => {
    for (const [category, distance, larger] of [['RUN', 0.001, 5], ['CYCLE', 0.01, 12], ['SWIM', 0.1, 400]]) {
      const tiny = await create({ category, distance, pace: category === 'RUN' ? 6 : undefined }, false);
      const log = await db.pointsLog.findUniqueOrThrow({ where: { activityId: tiny.id } });
      expect(log.basePoints).toBe(0); // Display rounding must not remove eligibility.
      expect(log.friendBonus).toBe(3);
      expect(tiny.points).toBe(3); // Friend bonus applies first, then the final total rounds down to the lower half-point.
      const path = `/api/activities/friend-bonus?activityDate=2026-09-02&category=${category}`;
      expect(await json(await accounts.member.api.get(path))).toMatchObject({ used: false, pending: true, available: false });
      await json(await accounts.admin.api.post(`/api/admin/activities/${tiny.id}/approve`, { data: {} }));
      const availability = await accounts.member.api.get(path);
      expect(availability.headers()['cache-control']).toContain('no-store');
      expect(await json(availability)).toMatchObject({ used: true, available: false, maxDailyBonus: 12 });
      const next = await create({ category, distance: larger, pace: category === 'RUN' ? 6 : undefined });
      expect((await db.pointsLog.findUniqueOrThrow({ where: { activityId: next.id } })).friendBonus).toBe(0);
    }
    const shortWalk = await create({ category: 'WALK_OR_HIKE', distance: 2, pace: undefined });
    expect(shortWalk.points).toBe(0);
    expect(await json(await accounts.member.api.get('/api/activities/friend-bonus?activityDate=2026-09-02&category=WALK_OR_HIKE')))
      .toMatchObject({ used: false, pending: false, available: true });
    const validWalk = await create({ category: 'WALK_OR_HIKE', distance: 5, pace: undefined });
    expect((await db.pointsLog.findUniqueOrThrow({ where: { activityId: validWalk.id } })).friendBonus).toBe(3);
    const approved = await db.activity.findMany({ where: { userId: accounts.member.id, status: 'APPROVED' }, include: { pointsLog: true } });
    expect(approved.reduce((n, activity) => n + activity.pointsLog.friendBonus, 0)).toBe(12);
    const scores = await db.weeklyScore.findMany({ where: { userId: accounts.member.id } });
    expect(scores.reduce((n, score) => n + score.totalPoints, 0)).toBe(approved.reduce((n, activity) => n + activity.points, 0));
  });
});

test('admin review refreshes sibling bonuses and safely recovers when the post-save read fails', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  await withFixture(browser, baseURL, async ({ db, accounts, create, key }) => {
    const first = await create({ distance: 5 });
    const second = await create({ distance: 8 });
    const third = await create({ distance: 12 });
    await json(await accounts.member.api.get('/api/admin/activities?status=ALL'), 403);
    await json(await accounts.admin.api.get('/api/admin/activities?status=unknown'), 400);
    const list = await accounts.admin.api.get('/api/admin/activities?status=ALL');
    expect(list.headers()['cache-control']).toContain('no-store');
    expect((await json(list)).filter(a => a.user.id === accounts.member.id)).toHaveLength(3);

    const page = await accounts.admin.context.newPage();
    await page.goto('/admin/activities');
    // Next also creates an empty route-announcer alert outside main. Check
    // the actual review panel, while still rejecting duplicate visible panels.
    const main = page.locator('main:visible');
    await expect(main).toHaveCount(1);
    await main.getByRole('button', { name: /^All \d/ }).click();
    await main.getByPlaceholder('Search athlete or column').fill(key);
    const row = id => main.locator(`article[data-activity-id="${id}"]:visible`);
    const points = (id, value) => expect(row(id).getByTestId('activity-points')).toHaveText(value);
    await points(first.id, '10.5');
    await points(second.id, '12.0');
    await points(third.id, '18.0');

    await row(first.id).getByRole('button', { name: 'Reject', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reject activity' });
    await dialog.getByRole('textbox').fill('Incorrect evidence for this particular workout.');
    await dialog.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
    await expect(row(first.id)).toContainText('REJECTED');
    await points(first.id, '7.5');
    await points(second.id, '15.0'); // Different card gains the bonus without a page reload.

    let failNextRead = true;
    await page.route('**/api/admin/activities?status=ALL', async route => {
      if (failNextRead) {
        failNextRead = false;
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Synthetic read failure"}' });
      } else await route.continue();
    });
    let edits = 0;
    page.on('request', request => {
      if (request.method() === 'PATCH' && new URL(request.url()).pathname === `/api/admin/activities/${second.id}`) edits++;
    });
    await row(second.id).getByRole('button', { name: 'Correct details', exact: true }).click();
    await row(second.id).getByRole('combobox', { name: 'Friend entry type' }).selectOption('');
    await row(second.id).getByRole('button', { name: 'Save correction', exact: true }).click();
    await expect(main.getByRole('alert')).toContainText('Your correction was saved, but latest scores could not be loaded');
    await points(second.id, '—');
    await points(third.id, '—');
    await expect(row(third.id).getByRole('button', { name: 'Reset', exact: true })).toBeDisabled();
    expect((await db.activity.findUniqueOrThrow({ where: { id: second.id } })).points).toBe(12);
    expect((await db.activity.findUniqueOrThrow({ where: { id: third.id } })).points).toBe(21);
    await main.getByRole('button', { name: 'Refresh scores', exact: true }).click();
    await points(second.id, '12.0');
    await points(third.id, '21.0');
    expect(edits).toBe(1); // Retrying the read must not replay the successful mutation.
    await expect(main.getByRole('alert')).toHaveCount(0);

    await row(third.id).getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(row(third.id)).toContainText('PENDING');
    await row(first.id).getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(row(first.id)).toContainText('APPROVED');
    await points(first.id, '10.5');
    await points(second.id, '12.0');
    await points(third.id, '18.0'); // The approved activity now takes priority over the pending estimate.
    const approved = await db.activity.findMany({ where: { userId: accounts.member.id, status: 'APPROVED' } });
    const scores = await db.weeklyScore.findMany({ where: { userId: accounts.member.id } });
    expect(scores.reduce((n, score) => n + score.totalPoints, 0)).toBe(22.5);
    expect(approved.reduce((n, activity) => n + activity.points, 0)).toBe(22.5);
  });
});
