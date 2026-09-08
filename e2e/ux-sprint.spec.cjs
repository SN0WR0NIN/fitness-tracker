const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';
const MEMBER = 'member-e2e@example.test';
const ADMIN = 'admin-e2e@example.test';

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

  await page.goto('/activities/new');
  await expect(page.getByRole('heading', { name: 'Log an activity' })).toBeVisible();
  await expect(page.getByText('Live score preview')).toBeVisible();
  await expect(page.getByText('Four short steps. Your draft saves automatically.')).toBeVisible();

  await page.goto('/activities/history');
  await expect(page.getByRole('heading', { name: 'My activities' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Approved/ })).toBeVisible();
  const approved = page.locator('details').filter({ hasText: 'APPROVED' }).first();
  await approved.locator('summary').click();
  await expect(approved.getByText('Request correction', { exact: true })).toBeVisible();

  await page.goto('/participants/e2e_member');
  await expect(page.getByText('Top sport')).toBeVisible();
  await expect(page.getByText('Buddy sessions')).toBeVisible();
  await expect(page.getByText('Active weeks')).toBeVisible();
  await expect(page.getByText('Recent activities', { exact: true })).toBeVisible();

  await context.close();
});

test('admin command centre presents one operational queue', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await login(context, ADMIN);
  await page.goto('/admin');
  await expect(page.getByRole('main').getByText("Today's queue", { exact: true })).toBeVisible();
  await expect(page.getByText('Pending activities').first()).toBeVisible();
  await expect(page.getByText('Corrections').first()).toBeVisible();
  await expect(page.getByText('Duplicates').first()).toBeVisible();
  await expect(page.getByText('Weeks to rebuild').first()).toBeVisible();
  await context.close();
});
