const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';

async function login(context, email) {
  const page = await context.newPage();
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

test('leaderboard race view exposes weekly momentum, projection and compact density', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await login(context, 'member-e2e@example.test');
  await page.goto('/leaderboard');

  await expect(page.getByText('Race view', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Momentum to Sunday' })).toBeVisible();
  await expect(page.getByText('Since week start', { exact: true })).toBeVisible();
  await expect(page.getByText('Today vs week start', { exact: true })).toBeVisible();
  await expect(page.getByText('Column momentum', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Detailed rows' })).toBeVisible();

  await page.getByRole('button', { name: 'Detailed rows' }).click();
  await expect(page.getByRole('button', { name: 'Compact rows' })).toBeVisible();

  await page.getByRole('button', { name: 'Column', exact: true }).click();
  await expect(page.getByText('Projected Sunday order', { exact: true })).toBeVisible();
  await expect(page.getByText('Column momentum', { exact: true })).toBeVisible();

  await context.close();
});
