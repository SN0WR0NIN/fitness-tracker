const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=', 'base64');

test('dashboard activities stay compact until the athlete opens one', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill('member-e2e@example.test');
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const upload = await page.request.post('/api/upload', {
    multipart: { file: { name: 'compact-proof.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(upload.status(), await upload.text()).toBe(200);
  const proofUrl = (await upload.json()).url;
  const created = await page.request.post('/api/activities', {
    data: { category: 'RUN', distance: 3, pace: 6, activityDate: '2026-09-02', proofUrl },
  });
  expect(created.status(), await created.text()).toBe(201);

  await page.goto('/dashboard');
  const card = page.getByTestId('dashboard-activity').first();
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('open', '');
  await expect(card.getByTestId('score-explanation')).not.toBeVisible();

  await card.locator(':scope > summary').click();
  await expect(card).toHaveAttribute('open', '');
  await expect(card.getByTestId('score-explanation')).toBeVisible();
  await expect(card.getByRole('button', { name: /Delete .* submission/ })).toBeVisible();
});
