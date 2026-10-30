const { test, expect } = require('@playwright/test');
const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';

const MEMBER = 'member-e2e@example.test';
const ADMIN = 'admin-e2e@example.test';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=', 'base64');

async function login(context, email) {
  const page = await context.newPage();
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

test('member gets quick logging, focused activity history and richer profile', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await login(context, MEMBER);

  const upload = await page.request.post('/api/upload', {
    multipart: { file: { name: 'ux-proof.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(upload.status(), await upload.text()).toBe(200);
  const proofUrl = (await upload.json()).url;
  const create = await page.request.post('/api/activities', {
    data: { activityDate: '2026-09-08', category: 'RUN', distance: 4.321, pace: 6, proofUrl },
  });
  expect(create.status(), await create.text()).toBe(201);
  const activity = await create.json();
  const adminContext = await browser.newContext();
  const adminPage = await login(adminContext, ADMIN);
  const approve = await adminPage.request.post(`/api/admin/activities/${activity.id}/approve`, {
    data: { duplicateOverrideReason: 'Synthetic UX fixture is intentionally independent from earlier browser tests.' },
  });
  expect(approve.status(), await approve.text()).toBe(200);

  await page.goto('/activities/new');
  await expect(page.getByRole('heading', { name: 'Log an activity' })).toBeVisible();
  await expect(page.getByText('Live score preview')).toBeVisible();
  await expect(page.getByText('Four short steps. Your draft saves automatically.')).toBeVisible();

  await page.goto('/activities/history');
  await expect(page.getByRole('heading', { name: 'My activities' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Approved/ })).toBeVisible();
  const approved = page.locator('details').filter({ hasText: 'APPROVED' }).first();
  await approved.locator(':scope > summary').click();
  await expect(approved.getByText('Edit approved entry', { exact: true })).toBeVisible();

  await page.goto('/participants/e2e_member');
  await expect(page.locator('main p:visible').filter({ hasText: /^Top sport$/ }).first()).toBeVisible();
  await expect(page.locator('main p:visible').filter({ hasText: /^Buddy sessions$/ }).first()).toBeVisible();
  await expect(page.locator('main p:visible').filter({ hasText: /^Active weeks$/ }).first()).toBeVisible();
  await expect(page.getByText('Recent activities', { exact: true }).first()).toBeVisible();

  await adminContext.close();
  await context.close();
});

test('admin command centre presents one operational queue', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await login(context, ADMIN);
  await page.goto('/admin');
  await expect(page.getByRole('main').getByText("Today's queue", { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending activities').first()).toBeVisible();
  await expect(page.getByText('Corrections').first()).toBeVisible();
  await expect(page.getByText('Duplicates').first()).toBeVisible();
  await expect(page.getByText('Weeks to rebuild').first()).toBeVisible();
  await context.close();
});
