const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';

test('dashboard activities stay compact until the athlete opens one', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill('member-e2e@example.test');
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const card = page.getByTestId('dashboard-activity').first();
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('open', '');
  await expect(card.getByTestId('score-explanation')).not.toBeVisible();

  await card.locator('summary').click();
  await expect(card).toHaveAttribute('open', '');
  await expect(card.getByTestId('score-explanation')).toBeVisible();
  await expect(card.getByRole('button', { name: /Delete .* submission/ })).toBeVisible();
});
