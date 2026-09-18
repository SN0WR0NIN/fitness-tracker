const { test, expect, signIn } = require('./helpers/clerk.cjs');

const MEMBER = 'member-e2e@example.test';
const ADMIN = 'admin-e2e@example.test';

async function login(context, email) {
  return signIn(context, email);
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
  await expect(page.locator('main p:visible').filter({ hasText: /^Top sport$/ }).first()).toBeVisible();
  await expect(page.locator('main p:visible').filter({ hasText: /^Buddy sessions$/ }).first()).toBeVisible();
  await expect(page.locator('main p:visible').filter({ hasText: /^Active weeks$/ }).first()).toBeVisible();
  await expect(page.getByText('Recent activities', { exact: true }).first()).toBeVisible();

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
