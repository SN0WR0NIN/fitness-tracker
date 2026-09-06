const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD;
const ADMIN = 'admin-e2e@example.test';

if (!PASSWORD) throw new Error('E2E_PASSWORD is required.');

async function adminLogin(page) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(ADMIN);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('admin navigation exposes one Admin hub entry', async ({ page }) => {
  await adminLogin(page);

  const nav = page.locator('nav').first();
  await expect(nav.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Control', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Review', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);

  await nav.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Command Centre 2.0' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create activity' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review queue' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Password resets/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage users' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible();
});
