const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

function assertDisposable(baseURL) {
  const db = new URL(process.env.DATABASE_URL || 'http://invalid');
  const app = new URL(baseURL);
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1'
      || db.pathname !== '/fitness_tracker_e2e'
      || !['localhost', '127.0.0.1'].includes(db.hostname)
      || !['localhost', '127.0.0.1'].includes(app.hostname)) throw new Error('Disposable localhost CI required.');
}
async function json(response, status = 200) {
  const text = await response.text(); expect(response.status(), text).toBe(status); return JSON.parse(text);
}
async function login(browser, baseURL, user, password) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const csrf = await json(await context.request.get('/api/auth/csrf'));
  await json(await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: `${baseURL}/dashboard`, json: 'true' } }));
  return context;
}

test('admins can vet proof, distance and pace and persist or clear score overrides', async ({ browser, baseURL }) => {
  assertDisposable(baseURL); const db = new PrismaClient(); const key = `score_override_${randomUUID().replaceAll('-', '')}`; const password = process.env.E2E_PASSWORD; const contexts = []; if (!password) throw new Error('E2E_PASSWORD required');
  try {
    const column = await db.column.create({ data: { id: `${key}_column`, name: key } }); const hash = await bcrypt.hash(password, 10);
    const member = await db.user.create({ data: { id: `${key}_member`, name: 'Score Override Member', email: `${key}_member@example.test`, password: hash, role: 'MEMBER', columnId: column.id } });
    const admin = await db.user.create({ data: { id: `${key}_admin`, name: 'Score Override Admin', email: `${key}_admin@example.test`, password: hash, role: 'ADMIN', columnId: column.id } });
    const memberContext = await login(browser, baseURL, member, password); contexts.push(memberContext); const adminContext = await login(browser, baseURL, admin, password); contexts.push(adminContext);
    const activity = await json(await memberContext.request.post('/api/activities', { data: { activityDate: '2026-09-02', category: 'RUN', distance: 5, pace: 6 } }), 201);
    const proofUrl = `https://example.invalid/e2e-proof/${member.id}/${key}.png`; await db.activity.update({ where: { id: activity.id }, data: { proofUrl } });
    await json(await adminContext.request.post(`/api/admin/activities/${activity.id}/approve`, { data: {} })); expect((await db.activity.findUniqueOrThrow({ where: { id: activity.id } })).points).toBe(7.5);
    expect((await memberContext.request.patch(`/api/admin/activities/${activity.id}`, { data: { basePointsOverride: 8.25 } })).status()).toBe(403);
    await json(await adminContext.request.patch(`/api/admin/activities/${activity.id}`, { data: { basePointsOverride: 8.25, totalPointsOverride: null } }));
    let saved = await db.activity.findUniqueOrThrow({ where: { id: activity.id }, include: { pointsLog: true } }); expect(saved.basePointsOverride).toBe(8.25); expect(saved.totalPointsOverride).toBeNull(); expect(saved.pointsLog.basePoints).toBe(8.25); expect(saved.points).toBe(8);
    expect((await adminContext.request.patch(`/api/admin/activities/${activity.id}`, { data: { totalPointsOverride: 9.25 } })).status()).toBe(400);
    await json(await adminContext.request.patch(`/api/admin/activities/${activity.id}`, { data: { totalPointsOverride: 9.5 } })); await json(await adminContext.request.patch(`/api/admin/activities/${activity.id}`, { data: { distance: 6 } }));
    saved = await db.activity.findUniqueOrThrow({ where: { id: activity.id }, include: { pointsLog: true } }); expect(saved).toMatchObject({ distance: 6, pace: 6, basePointsOverride: 8.25, totalPointsOverride: 9.5, points: 9.5 }); expect(saved.pointsLog).toMatchObject({ basePoints: 8.25, totalPoints: 9.5 }); expect((await db.weeklyScore.findFirstOrThrow({ where: { userId: member.id } })).totalPoints).toBe(9.5);
    const page = await adminContext.newPage(); await page.goto('/admin/score-overrides'); const card = page.locator(`article[data-score-activity-id="${activity.id}"]`); await expect(card).toContainText('ADMIN OVERRIDE'); await expect(card.locator('[data-vetting-distance]')).toHaveText('6.00 km'); await expect(card.locator('[data-vetting-pace]')).toHaveText('6:00 /km');
    const proofButton = card.getByRole('button', { name: "View Score Override Member's proof 1" }); await expect(proofButton).toBeVisible(); await expect(proofButton.locator('img')).toHaveAttribute('src', /\/api\/proofs\?ref=/); await proofButton.click(); await expect(page.getByRole('dialog', { name: 'Activity proof preview' })).toBeVisible(); await expect(page.getByAltText('Activity proof enlarged')).toBeVisible(); await page.getByRole('button', { name: 'Close proof preview' }).click(); await expect(page.getByRole('dialog', { name: 'Activity proof preview' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Edit score' }).click(); await expect(card.getByLabel('Base Points override')).toHaveValue('8.25'); await expect(card.getByLabel('Points Total override')).toHaveValue('9.5');
    await json(await adminContext.request.patch(`/api/admin/activities/${activity.id}`, { data: { basePointsOverride: null, totalPointsOverride: null } })); saved = await db.activity.findUniqueOrThrow({ where: { id: activity.id }, include: { pointsLog: true } }); expect(saved.basePointsOverride).toBeNull(); expect(saved.totalPointsOverride).toBeNull(); expect(saved.points).toBe(9); expect(saved.pointsLog.basePoints).toBe(9);
  } finally { for (const context of contexts) await context.close(); await db.activity.deleteMany({ where: { userId: { startsWith: key } } }); await db.user.deleteMany({ where: { id: { startsWith: key } } }); await db.column.deleteMany({ where: { id: `${key}_column` } }); await db.$disconnect(); }
});
