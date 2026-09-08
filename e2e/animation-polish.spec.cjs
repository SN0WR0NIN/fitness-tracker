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

test('core challenge screens expose lightweight animation hooks', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await login(context, 'member-e2e@example.test');

  await page.goto('/dashboard?activitySubmitted=true');
  const success = page.getByRole('status');
  await expect(success).toBeVisible();
  await expect(success).toHaveClass(/submission-celebration/);
  await expect(success.locator('.celebration-icon')).toHaveCount(1);
  await expect(page.locator('main.page-enter')).toBeVisible();

  await page.goto('/activities/new');
  await expect(page.getByText('Live score preview', { exact: true })).toBeVisible();
  await expect(page.locator('main.page-enter')).toBeVisible();
  await expect(page.locator('.motion-card').first()).toBeVisible();

  await page.goto('/leaderboard');
  await expect(page.locator('main.page-enter')).toBeVisible();
  await expect(page.getByText('Standings controls', { exact: true })).toBeVisible();

  await context.close();
});
