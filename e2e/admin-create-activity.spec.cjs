const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');

const PASSWORD = process.env.E2E_PASSWORD;
const ADMIN = 'admin-e2e@example.test';
const TARGET_USER_ID = 'e2e_reset_member';
const prisma = new PrismaClient();

if (!PASSWORD) throw new Error('E2E_PASSWORD is required.');

async function adminLogin(page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(ADMIN);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.beforeEach(async () => {
  await prisma.activity.deleteMany({ where: { userId: TARGET_USER_ID } });
  await prisma.weeklyScore.deleteMany({ where: { userId: TARGET_USER_ID } });
});

test.afterAll(async () => prisma.$disconnect());

test('admin can create pending and approved activities for a participant', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/activities/new');
  await expect(page.getByRole('heading', { name: 'Create activity for participant' })).toBeVisible();

  await page.getByLabel('Participant').selectOption(TARGET_USER_ID);
  await page.getByLabel('Activity date').fill('2026-09-04');
  await page.getByLabel('Activity type').selectOption('TROOP_GAMES');
  await page.getByRole('button', { name: 'Create pending activity' }).click();
  await expect(page.getByText('Pending activity created')).toBeVisible();

  const pending = await prisma.activity.findFirst({ where: { userId: TARGET_USER_ID, category: 'TROOP_GAMES' }, orderBy: { createdAt: 'desc' } });
  expect(pending).toBeTruthy();
  expect(pending.status).toBe('PENDING');
  expect(pending.columnId).toBe('e2e_column');

  await page.getByRole('button', { name: 'Add another' }).click();
  await page.getByLabel('Activity date').fill('2026-09-05');
  await page.getByLabel('Activity type').selectOption('CYCLE');
  await page.getByLabel('Distance (km)').fill('10');
  await page.getByLabel('Create & Approve').check();
  await page.getByRole('button', { name: 'Create & approve' }).click();
  await expect(page.getByText('Approved activity created')).toBeVisible();

  const approved = await prisma.activity.findFirst({ where: { userId: TARGET_USER_ID, category: 'CYCLE', status: 'APPROVED' }, orderBy: { createdAt: 'desc' } });
  expect(approved).toBeTruthy();
  expect(approved.reviewedById).toBe('e2e_admin');
  expect(approved.points).toBeGreaterThan(0);

  const score = await prisma.weeklyScore.findFirst({ where: { userId: TARGET_USER_ID } });
  expect(score).toBeTruthy();
  expect(score.totalPoints).toBeCloseTo(approved.points, 5);
  expect(score.cyclePoints).toBeCloseTo(approved.points, 5);
});
