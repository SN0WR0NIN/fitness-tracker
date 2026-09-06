const { test, expect } = require('@playwright/test');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';
const NEW_PASSWORD = 'E2E-new-Password-456!';
const ADMIN = 'admin-e2e@example.test';
const RESET_LOGIN = 'e2e-reset';
const prisma = new PrismaClient();

async function loginWith(page, identifier, password) {
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(identifier);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

test.beforeEach(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.$executeRawUnsafe(`DELETE FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member'`);
  await prisma.$executeRawUnsafe(`DELETE FROM app_internal.notification WHERE kind='ACCOUNT_RESET_REQUEST' AND metadata->>'participantId'='e2e_reset_member'`);
  await prisma.user.update({
    where: { id: 'e2e_reset_member' },
    data: {
      password: hash,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      loginAttempts: 0,
      loginWindowStartedAt: null,
      sessionVersion: 0,
    },
  });
});

test.afterAll(async () => prisma.$disconnect());

test('forgot password request can be safely administered and completed once', async ({ browser, request }) => {
  const unknownResponse = await request.post('/api/account/forgot-password', { data: { identifier: 'not-a-real-e2e-user' } });
  const validResponse = await request.post('/api/account/forgot-password', { data: { identifier: RESET_LOGIN } });
  expect(unknownResponse.ok()).toBeTruthy();
  expect(validResponse.ok()).toBeTruthy();
  const unknownPayload = await unknownResponse.json();
  const validPayload = await validResponse.json();
  expect(validPayload.message).toBe(unknownPayload.message);

  const requestRows = await prisma.$queryRawUnsafe(`SELECT id, status FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member'`);
  expect(requestRows).toHaveLength(1);
  expect(requestRows[0].status).toBe('OPEN');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginWith(adminPage, ADMIN, PASSWORD);
  await expect(adminPage).toHaveURL(/\/dashboard/);
  await adminPage.goto('/admin/password-resets');
  await expect(adminPage.getByRole('heading', { name: 'Password reset requests' })).toBeVisible();
  const resetCard = adminPage.locator('article').filter({ hasText: 'E2E Reset Member' }).first();
  await expect(resetCard).toBeVisible();
  await resetCard.getByRole('button', { name: 'Issue reset' }).click();
  const credentialBox = adminPage.locator('section').filter({ hasText: 'Temporary reset credentials — shown once' }).first();
  await expect(credentialBox).toBeVisible();
  const codes = credentialBox.locator('code');
  expect(await codes.nth(0).textContent()).toBe(RESET_LOGIN);
  const temporaryPassword = (await codes.nth(1).textContent()) || '';
  expect(temporaryPassword.length).toBeGreaterThan(10);

  const issuedUser = await prisma.user.findUnique({ where: { id: 'e2e_reset_member' }, select: { mustChangePassword: true, sessionVersion: true } });
  expect(issuedUser.mustChangePassword).toBeTruthy();
  expect(issuedUser.sessionVersion).toBeGreaterThan(0);

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await loginWith(memberPage, RESET_LOGIN, temporaryPassword);
  await expect(memberPage).toHaveURL(/\/auth\/reset-password/);

  await memberPage.getByLabel('Temporary reset password', { exact: true }).fill(temporaryPassword);
  const newPasswordFields = memberPage.locator('input[autocomplete="new-password"]');
  await newPasswordFields.nth(0).fill(NEW_PASSWORD);
  await newPasswordFields.nth(1).fill(NEW_PASSWORD);
  await memberPage.getByRole('button', { name: 'Set new password' }).click();
  await expect(memberPage.getByText('Password reset complete. Log in with your new password.')).toBeVisible();

  const completedRows = await prisma.$queryRawUnsafe(`SELECT status, completed_at FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member' ORDER BY created_at DESC LIMIT 1`);
  expect(completedRows[0].status).toBe('COMPLETED');
  expect(completedRows[0].completed_at).toBeTruthy();

  const reuse = await request.post('/api/account/reset-password', {
    data: { identifier: RESET_LOGIN, temporaryPassword, newPassword: 'Another-E2E-Password-789!' },
  });
  expect(reuse.status()).toBe(400);

  await loginWith(memberPage, RESET_LOGIN, NEW_PASSWORD);
  await expect(memberPage).toHaveURL(/\/dashboard/);
  await expect(memberPage.getByText('E2E Reset Member').first()).toBeVisible();

  await adminPage.goto('/admin/password-resets');
  await adminPage.getByRole('button', { name: 'History' }).click();
  await expect(adminPage.locator('article').filter({ hasText: 'E2E Reset Member' }).getByText('Completed')).toBeVisible();

  await memberContext.close();
  await adminContext.close();
});
