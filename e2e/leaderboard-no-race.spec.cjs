const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');

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
  const db = new PrismaClient();
  let seededScoreId = null;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const existingScore = await db.weeklyScore.findFirst({ where: { userId: 'e2e_member' } });
    if (!existingScore) {
      const score = await db.weeklyScore.create({
        data: {
          userId: 'e2e_member',
          columnId: 'e2e_column',
          weekStart: new Date('2026-12-27T00:00:00.000Z'),
          weekNumber: 18,
          totalPoints: 8,
          runPoints: 8,
        },
      });
      seededScoreId = score.id;
    }

    const page = await login(context, 'member-e2e@example.test');
    await page.goto('/leaderboard');
    await expect(page.getByText('Standings controls', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Individual', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Column', exact: true })).toBeVisible();
    await expect(page.getByText('Race view', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Momentum to Sunday' })).toHaveCount(0);
    await expect(page.getByText('Column momentum', { exact: true })).toHaveCount(0);

    const positionBar = page.getByLabel('Your position');
    const mobileDock = page.getByRole('navigation', { name: 'Mobile primary navigation' });
    await expect(positionBar).toBeVisible();
    for (const width of [390, 700]) {
      await page.setViewportSize({ width, height: 844 });
      const [positionBox, dockBox] = await Promise.all([
        positionBar.boundingBox(),
        mobileDock.boundingBox(),
      ]);
      expect(positionBox).not.toBeNull();
      expect(dockBox).not.toBeNull();
      expect(positionBox.y + positionBox.height).toBeLessThan(dockBox.y);
    }

    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(positionBar.getByText('Run pts', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Column', exact: true }).click();
    await expect(page.getByText(/members .* average/).first()).toBeVisible();
    await expect(positionBar).toHaveCount(0);
  } finally {
    await context.close();
    if (seededScoreId) await db.weeklyScore.delete({ where: { id: seededScoreId } });
    await db.$disconnect();
  }
});
