const { test, expect, signIn } = require('./helpers/clerk.cjs');


async function login(context, email) {
  return signIn(context, email);
}

test('core challenge screens expose lightweight animation hooks', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await login(context, 'member-e2e@example.test');

  await page.goto('/dashboard?activitySubmitted=true');
  const success = page.locator('section.submission-celebration[role="status"]').first();
  await expect(success).toBeVisible();
  await expect(success).toHaveClass(/submission-celebration/);
  await expect(success.locator('.celebration-icon')).toHaveCount(1);
  await expect(page.locator('main.page-enter').first()).toBeVisible();

  await page.goto('/activities/new');
  await expect(page.getByText('Live score preview', { exact: true }).first()).toBeVisible();
  await expect(page.locator('main.page-enter').first()).toBeVisible();
  await expect(page.locator('.motion-card').first()).toBeVisible();

  await page.goto('/leaderboard');
  await expect(page.locator('main.page-enter').first()).toBeVisible();
  await expect(page.getByText('Standings controls', { exact: true }).first()).toBeVisible();

  await context.close();
});
