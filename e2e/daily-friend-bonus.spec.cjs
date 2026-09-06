const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

async function json(response, status = 200) {
  const text = await response.text(); expect(response.status(), text).toBe(status); return JSON.parse(text);
}
test('friend bonus is per athlete, Singapore day and sport across all review workflows', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || url.pathname !== '/fitness_tracker_e2e'
    || !['localhost','127.0.0.1'].includes(url.hostname) || !['localhost','127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Disposable localhost CI database/app required');
  const db = new PrismaClient(); const key = `daily_${randomUUID().replaceAll('-','')}`;
  const ids = []; const contexts = []; const accounts = {};
  try {
    const password = process.env.E2E_PASSWORD; if (!password) throw new Error('Test password required');
    const hash = await bcrypt.hash(password, 10);
    await db.column.create({ data: { id: key, name: key } });
    for (const role of ['member','friend','other','admin']) {
      const id = `${key}_${role}`; ids.push(id);
      const user = await db.user.create({ data: { id, name: `Daily ${role}`, email: `${id}@example.test`, password: hash, columnId: key, role: role === 'admin' ? 'ADMIN' : 'MEMBER' } });
      const context = await browser.newContext({ baseURL }); contexts.push(context);
      const csrf = await json(await context.request.get('/api/auth/csrf'));
      await json(await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: `${baseURL}/dashboard`, json: 'true' } }));
      expect((await json(await context.request.get('/api/auth/session'))).user.id).toBe(id);
      accounts[role] = { id, api: context.request };
    }
    const { member, friend, other, admin } = accounts;
    const bonus = async id => (await db.pointsLog.findUnique({ where: { activityId: id } })).friendBonus;
    const get = id => db.activity.findUnique({ where: { id } });
    const approve = async a => json(await admin.api.post(`/api/admin/activities/${a.id}/approve`, { data: {} }));
    const create = async (data = {}, approved = true) => {
      const a = await json(await member.api.post('/api/activities', { data: { activityDate: '2026-09-01', category: 'RUN', distance: 5, pace: 6, companionUserIds: [friend.id, other.id], ...data } }), 201);
      return approved ? approve(a) : a;
    };
    const run1 = await create(); const run2 = await create({ distance: 8 });
    expect(await bonus(run1.id)).toBe(3); expect(await bonus(run2.id)).toBe(0);
    const cycle = await create({ category: 'CYCLE', distance: 12, pace: undefined });
    const swim = await create({ category: 'SWIM', distance: 400, pace: undefined });
    const walk = await create({ category: 'WALK_OR_HIKE', distance: 6, pace: undefined });
    const games = await create({ category: 'TROOP_GAMES', distance: undefined, pace: undefined });
    expect(await bonus(games.id)).toBe(0); expect(games.points).toBe(5);
    expect((await Promise.all([run1,run2,cycle,swim,walk,games].map(a => bonus(a.id)))).reduce((a,b) => a+b, 0)).toBe(12);
    const short = await create({ category: 'WALK_OR_HIKE', distance: 2, pace: undefined });
    expect(short.points).toBe(0); expect(await bonus(short.id)).toBe(0);
    expect(await bonus((await create({ activityDate: '2026-09-02' })).id)).toBe(3);

    const available = await json(await member.api.get('/api/activities/friend-bonus?activityDate=2026-09-01&category=RUN'));
    expect(available).toMatchObject({ used: true, available: false, maxDailyBonus: 12 });
    await json(await member.api.get(`/api/activities/friend-bonus?activityDate=2026-09-01&category=RUN&userId=${friend.id}`),403);
    await json(await admin.api.post(`/api/admin/activities/${run1.id}/reject`, { data: { reason: 'Incorrect workout evidence for this entry.' } }));
    expect(await bonus(run1.id)).toBe(0); expect(await bonus(run2.id)).toBe(3);
    await approve(run1); expect(await bonus(run1.id)).toBe(3); expect(await bonus(run2.id)).toBe(0);
    await json(await admin.api.patch(`/api/admin/activities/${run1.id}`, { data: { companionUserIds: [] } }));
    expect(await bonus(run1.id)).toBe(0); expect(await bonus(run2.id)).toBe(3);
    await json(await admin.api.post(`/api/admin/activities/${run2.id}/reset`, { data: {} }));
    expect(await db.weeklyScore.findMany({ where: { userId: friend.id } })).toHaveLength(0);
    await approve(run2);

    const a = await create({ activityDate: '2026-09-03', distance: 7 }, false);
    const b = await create({ activityDate: '2026-09-03', distance: 10 }, false);
    await Promise.all([approve(a), approve(b)]);
    expect((await bonus(a.id)) + (await bonus(b.id))).toBe(3);
    await Promise.all([approve(a), approve(b)]);
    expect((await bonus(a.id)) + (await bonus(b.id))).toBe(3);

    // One UTC day, two Singapore days: each earns the cycling bonus.
    for (const [index, occurredAt] of ['2026-09-04T15:59:00Z','2026-09-04T16:01:00Z'].entries()) {
      const a = await create({ activityDate: '2026-09-04', category: 'CYCLE', distance: 20 + index * 8, pace: undefined }, false);
      await db.activity.update({ where: { id: a.id }, data: { occurredAt: new Date(occurredAt) } });
      await approve(a); expect(await bonus(a.id)).toBe(3);
    }
    const slow = await create({ pace: 10, distance: 9 });
    expect(slow.category).toBe('WALK_OR_HIKE'); expect(await bonus(slow.id)).toBe(0);

    const source = await get(cycle.id); const sourcePoints = source.points;
    const correction = await json(await member.api.post('/api/corrections', { data: {
      activityId: source.id, reason: 'Correct the date on this genuine cycling workout.',
      proposed: { activityDate: '2026-09-06', category: source.category, distance: source.distance, pace: source.pace,
        duration: source.duration, companionUserId: source.companionUserId, companionUserIds: source.companionUserIds, proofUrl: source.proofUrl },
    } }),201);
    expect((await get(source.id)).points).toBe(sourcePoints);
    const decision = await json(await admin.api.post('/api/admin/corrections', { data: { id: correction.id, decision: 'APPROVED', reason: 'Verified the Singapore activity date.' } }));
    expect(decision.applied.activityDate).toBe('2026-09-06'); expect(await bonus(source.id)).toBe(3);
    await json(await admin.api.post('/api/admin/corrections', { data: { id: correction.id, decision: 'APPROVED', reason: 'Repeated approval cannot apply again.' } }),409);
    const adminCreated = await json(await admin.api.post('/api/admin/activities/create', { data: {
      userId: member.id, activityDate: '2026-09-01', category: 'RUN', distance: 15, pace: 6,
      companionUserIds: [friend.id], approvalMode: 'APPROVED',
    } }),201);
    expect(await bonus(adminCreated.activity.id)).toBe(0);
    const approved = await db.activity.findMany({ where: { userId: member.id, status: 'APPROVED' }, include: { pointsLog: true } });
    const scores = await db.weeklyScore.findMany({ where: { userId: member.id } });
    for (const score of scores) {
      const week = approved.filter(a => a.weekStart.getTime() === score.weekStart.getTime());
      expect(score.totalPoints).toBeCloseTo(week.reduce((n,a) => n+a.points,0),8);
      for (const [category, field] of Object.entries({ RUN:'runPoints',CYCLE:'cyclePoints',SWIM:'swimPoints',WALK_OR_HIKE:'hikePoints',TROOP_GAMES:'troopGamePoints' }))
        expect(score[field]).toBeCloseTo(week.filter(a => a.category === category).reduce((n,a) => n+a.points,0),8);
    }
    const buckets = new Map();
    for (const a of approved) {
      const day = new Date(a.occurredAt.getTime()+8*3600000).toISOString().slice(0,10);
      const k = `${day}|${a.category}`;
      buckets.set(k,(buckets.get(k) || 0)+a.pointsLog.friendBonus);
    }
    expect([...buckets.values()].every(n => n <= 3)).toBe(true);
  } finally {
    for (const context of contexts) await context.close();
    await db.activity.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.column.deleteMany({ where: { id: key } });
    await db.$disconnect();
  }
});
