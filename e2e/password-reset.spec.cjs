const { test, expect } = require('@playwright/test');
const { setupClerkTestingToken, clerk } = require('@clerk/testing/playwright');

test('retired local credentials and recovery endpoints cannot authenticate or reset accounts', async ({ request }) => {
  for (const path of ['/api/auth/callback/credentials', '/api/auth/signup', '/api/account/setup',
    '/api/account/forgot-password', '/api/account/reset-password']) {
    const response = await request.post(path, { data: { identifier: 'e2e-reset', password: 'retired-local-password' } });
    expect(response.status(), path).toBe(410);
    expect((await response.json()).error).toContain('Clerk');
  }
  expect((await request.get('/api/auth/csrf')).status()).toBe(410);
  expect((await request.get('/api/auth/session')).status()).toBe(401);
  const known = await request.post('/api/account/forgot-password', { data: { identifier: 'e2e-reset' } });
  const unknown = await request.post('/api/account/forgot-password', { data: { identifier: 'unknown-e2e-user' } });
  expect(await known.json()).toEqual(await unknown.json());
});

test('Clerk sign-in and nested recovery routes render without a catch-all routing error', async ({ page }) => {
  await setupClerkTestingToken({ page });
  const response = await page.goto('/auth/login');
  expect(response.status()).toBe(200);
  await clerk.loaded({ page });
  await expect(page.locator('input[name="identifier"]')).toBeVisible();
  // Reloading a Clerk step must reach the login page, not a Next.js 404.
  const nested = await page.goto('/auth/login/factor-one');
  expect(nested.status()).toBe(200);
  await clerk.loaded({ page });
  await expect(page.locator('.cl-signIn-root')).toBeVisible();
});
