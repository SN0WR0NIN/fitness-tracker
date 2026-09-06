const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

test.describe.configure({ retries: 0 });
async function json(response, status = 200) {
  const text = await response.text();
  expect(response.status(), text).toBe(status);
  return JSON.parse(text);
}

async function withFixture(browser, baseURL, work) {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1'
    || url.pathname !== '/fitness_tracker_e2e' || !['localhost', '127.0.0.1'].includes(url.hostname)
    || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
    throw new Error('Only a disposable localhost CI database and application may run these tests.');
  }
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Synthetic test password required.');
  const db = new PrismaClient();
  const key = `bonus_badge_${randomUUID().replaceAll('-', '')}`;
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
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      const csrf = await json(await context.request.get('/api/auth/csrf'));
      await json(await context.request.post('/api/auth/callback/credentials', { form: {
        csrfToken: csrf.csrfToken, email: user.email, password,
        callbackUrl: `${baseURL}/dashboard`, json: 'true',
      } }));
      expect((await json(await context.request.get('/api/auth/session'))).user.id).toBe(id);
      accounts[role] = { ...user, api: context.request };
    }
    const { member, friend, admin } = accounts;
    const create = async (data = {}, userId = member.id) => {
      const result = await json(await admin.api.post('/api/admin/activities/create', { data: {
        userId, activityDate: '2026-09-02', category: 'RUN', distance: 18, pace: 6,
        companionUserIds: [friend.id], approvalMode: 'APPROVED', ...data,
      } }), 201);
      expect(result.activity.status).toBe('APPROVED');
      return result.activity;
    };
    const badge = async () => (await db.$queryRaw`
      SELECT current_value, unlocked, first_earned_at, notified_at, revoked_at
      FROM app_internal.user_achievement
      WHERE user_id=${member.id} AND season_key='2026-09-01' AND achievement_id='points-100'
    `)[0];
    const alerts = () => db.$queryRaw`
      SELECT id::text FROM app_internal.notification
      WHERE user_id=${member.id} AND kind='ACHIEVEMENT' AND metadata->>'achievementId'='points-100'
    `;
    const total = async () => {
      const activities = await db.activity.findMany({ where: { userId: member.id, status: 'APPROVED' } });
      const scores = await db.weeklyScore.findMany({ where: { userId: member.id } });
      const points = activities.reduce((n, a) => n + a.points, 0);
      expect(scores.reduce((n, s) => n + s.totalPoints, 0)).toBe(points);
      return points;
    };
    const neverEarned = async () => {
      expect(await total()).toBe(99);
      expect(await badge()).toMatchObject({ current_value: 99, unlocked: false,
        first_earned_at: null, notified_at: null, revoked_at: null });
      expect(await alerts()).toHaveLength(0);
    };
    const earnForReal = async () => {
      const activity = await create({ activityDate: '2026-09-03', category: 'SWIM',
        distance: 100, pace: undefined, companionUserIds: [] });
      expect(await total()).toBe(100);
      expect((await badge()).unlocked).toBe(true);
      expect((await badge()).first_earned_at).not.toBeNull();
      expect((await badge()).notified_at).not.toBeNull();
      expect(await alerts()).toHaveLength(1);
      await json(await admin.api.post(`/api/admin/activities/${activity.id}/approve`, { data: {} }));
      await db.$queryRaw`SELECT app_internal.refresh_user_achievements(${member.id},true)`;
      expect(await alerts()).toHaveLength(1);
    };
    await work({ db, key, ids, accounts, create, badge, alerts, total, neverEarned, earnForReal });
  } finally {
    for (const context of contexts) await context.close();
    try {
      await db.activity.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.column.deleteMany({ where: { id: key } });
    } finally { await db.$disconnect(); }
  }
}

async function filler(create, distance = 54) {
  return create({ activityDate: '2026-09-01', category: 'WALK_OR_HIKE', distance,
    pace: undefined, companionUserIds: [] });
}

test('approved corrections do not consume an unearned achievement notification while transferring the bonus', async ({ browser, baseURL }) => {
  await withFixture(browser, baseURL, async ({ accounts, create, neverEarned, earnForReal }) => {
    await filler(create);
    const original = await create({ companionUserIds: [] }); // 27 points; earlier than the bonus carrier.
    await create({ distance: 10 }); // 15 + 3 points, final total 99.
    await neverEarned();
    const correction = await json(await accounts.member.api.post('/api/corrections', { data: {
      activityId: original.id, reason: 'Add the verified friend who joined this earlier workout.',
      proposed: { activityDate: '2026-09-02', category: original.category, distance: original.distance,
        pace: original.pace, duration: original.duration, proofUrl: original.proofUrl,
        companionUserId: accounts.friend.id, companionUserIds: [accounts.friend.id] },
    } }), 201);
    await neverEarned(); // Merely requesting a correction must not alter achievements either.
    await json(await accounts.admin.api.post('/api/admin/corrections', { data: {
      id: correction.id, decision: 'APPROVED', reason: 'Verified the companion against the workout proof.',
    } }));
    await neverEarned(); // An intermediate 102 is not an earned 100-point badge.
    await earnForReal(); // A later genuine 100 must still deliver its first alert.
  });
});

test('historical imports evaluate achievements after the same-day bonus is reconciled', async ({ browser, baseURL }) => {
  await withFixture(browser, baseURL, async ({ key, accounts, create, neverEarned, earnForReal }) => {
    await filler(create);
    await create(); // 54 + 27 + 3 = 84 before importing.
    const row = { name: accounts.member.name, column: key, occurredAt: '2026-09-02T12:00:00+08:00',
      category: 'RUN', distance: 10, pace: 6, companion: accounts.friend.name };
    const participantKey = `${row.name.toLowerCase()}|${key.toLowerCase()}`;
    const data = { rows: [row], mappings: { [participantKey]: { userId: accounts.member.id, columnId: key } }, skip: [] };
    const preview = await json(await accounts.admin.api.post('/api/admin/import', { data }));
    expect(preview.preview[0].possibleDuplicate).toBe(false);
    expect((await json(await accounts.admin.api.post('/api/admin/import', { data: {
      ...data, commit: true, previewHash: preview.previewHash,
    } }))).imported).toBe(1);
    await neverEarned(); // Per-entry import temporarily proposes 102, but only 99 is committed.
    await earnForReal();
  });
});

test('linking an unclaimed participant cannot record a transient milestone on the destination', async ({ browser, baseURL }) => {
  await withFixture(browser, baseURL, async ({ db, key, ids, accounts, create, neverEarned, earnForReal }) => {
    await filler(create);
    await create(); // Destination 84.
    const sourceId = `historical_${key}`;
    await db.user.create({ data: { id: sourceId, name: `${key} unclaimed`,
      email: `${sourceId}@participants.invalid`, password: '!UNCLAIMED', role: 'MEMBER', columnId: key } });
    ids.push(sourceId);
    await create({ distance: 10 }, sourceId); // Source 18; combining accounts must remove one +3.
    expect((await json(await accounts.admin.api.post('/api/admin/import/link', { data: {
      sourceId, targetId: accounts.member.id,
    } }))).linked).toBe(true);
    expect(await db.user.findUnique({ where: { id: sourceId } })).toBeNull();
    await neverEarned();
    await earnForReal();
  });
});

test('a still-earned badge keeps its original notification through a bonus transfer and rollback', async ({ browser, baseURL }) => {
  await withFixture(browser, baseURL, async ({ db, accounts, create, badge, alerts, total }) => {
    await filler(create, 55);
    const carrier = await create(); // 55 + 30 = 85.
    await create({ distance: 10 }); // 85 + 15 = 100; one genuine unlock.
    expect(await total()).toBe(100);
    const originalBadge = await badge();
    const originalAlerts = await alerts();
    expect(originalAlerts).toHaveLength(1);
    await json(await accounts.admin.api.patch(`/api/admin/activities/${carrier.id}`, { data: { companionUserIds: [] } }));
    expect(await total()).toBe(100); // Bonus moves to the other approved run, not a real revocation.
    expect(await badge()).toEqual(originalBadge);
    expect(await alerts()).toEqual(originalAlerts);
    await expect(db.$transaction(async tx => {
      await tx.activity.update({ where: { id: carrier.id }, data: { points: 0 } });
      throw new Error('ROLLBACK_SYNTHETIC_ACHIEVEMENT_CHECK');
    })).rejects.toThrow('ROLLBACK_SYNTHETIC_ACHIEVEMENT_CHECK');
    expect(await badge()).toEqual(originalBadge);
    expect(await alerts()).toEqual(originalAlerts);
    expect(await total()).toBe(100);
  });
});
