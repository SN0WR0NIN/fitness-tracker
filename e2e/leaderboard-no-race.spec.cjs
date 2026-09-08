const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';

async function login(context, email) {
  const page = await context.newPage();
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(email);
  await page.locator('input[type=\"password\"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

test('leaderboard keeps standings controls without race view', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await login(context, 'member-e2e@example.test');
  await page.goto('/leaderboard');
  await expect(page.getByText('Standings controls', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Individual', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Column', exact: true })).toBeVisible();
  await expect(page.getByText('Race view', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Momentum to Sunday' })).toHaveCount(0);
  await expect(page.getByText('Column momentum', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Column', exact: true }).click();
  await expect(page.getByText(/members .* average/).first()).toBeVisible();
  await context.close();
});
