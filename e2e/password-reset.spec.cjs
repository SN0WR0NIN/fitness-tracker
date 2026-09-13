const { test, expect } = require('@playwright/test');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';
const NEW_PASSWORD = 'E2E-new-Password-456!';
const ADMIN = 'admin-e2e@example.test';
const RESET_EMAIL = 'reset-e2e@example.test';
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
  await prisma.$executeRawUnsafe(`DELETE FROM app_internal.password_reset_test_delivery WHERE email='reset-e2e@example.test'`);
  await prisma.$executeRawUnsafe(`DELETE FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member'`);
  await prisma.user.update({
    where: { id: 'e2e_reset_member' },
    data: {
      password: hash,
      emailConfirmedAt: new Date(),
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      loginAttempts: 0,
      loginWindowStartedAt: null,
      sessionVersion: 0,
    },
  });
});

test.afterAll(async () => prisma.$disconnect());

test('forgot password emails a one-time link that changes the password once', async ({ browser, page, request }) => {
  const unknownResponse = await request.post('/api/account/forgot-password', { data: { email: 'not-a-real-e2e-user@example.test' } });
  const validResponse = await request.post('/api/account/forgot-password', { data: { email: RESET_EMAIL } });
  expect(unknownResponse.ok()).toBeTruthy();
  expect(validResponse.ok()).toBeTruthy();
  expect(await validResponse.json()).toEqual(await unknownResponse.json());

  await expect.poll(async () => {
    const rows = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member' AND email_sent_at IS NOT NULL`);
    return rows[0].count;
  }).toBe(1);
  const requestRows = await prisma.$queryRawUnsafe(`SELECT id,status,token_hash,email_sent_at FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member'`);
  expect(requestRows).toHaveLength(1);
  expect(requestRows[0].status).toBe('ISSUED');
  expect(requestRows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(requestRows[0].email_sent_at).toBeTruthy();

  const deliveryRows = await prisma.$queryRawUnsafe(`SELECT token,reset_url FROM app_internal.password_reset_test_delivery WHERE request_id=$1::uuid`, requestRows[0].id);
  expect(deliveryRows).toHaveLength(1);
  expect(deliveryRows[0].token).not.toBe(requestRows[0].token_hash);
  expect(deliveryRows[0].reset_url).toContain('/auth/reset-password?token=');

  const unchangedUser = await prisma.user.findUnique({ where: { id: 'e2e_reset_member' }, select: { mustChangePassword: true, sessionVersion: true } });
  expect(unchangedUser.mustChangePassword).toBeFalsy();
  expect(unchangedUser.sessionVersion).toBe(0);

  const existingPasswordContext = await browser.newContext();
  const existingPasswordPage = await existingPasswordContext.newPage();
  await loginWith(existingPasswordPage, RESET_LOGIN, PASSWORD);
  await expect(existingPasswordPage).toHaveURL(/\/dashboard/);
  await existingPasswordContext.close();

  await page.goto(deliveryRows[0].reset_url);
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
  const newPasswordFields = page.locator('input[autocomplete="new-password"]');
  await newPasswordFields.nth(0).fill(NEW_PASSWORD);
  await newPasswordFields.nth(1).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Password reset complete. Log in with your new password.')).toBeVisible();

  const completedRows = await prisma.$queryRawUnsafe(`SELECT status,completed_at FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member' ORDER BY created_at DESC LIMIT 1`);
  expect(completedRows[0].status).toBe('COMPLETED');
  expect(completedRows[0].completed_at).toBeTruthy();

  const reuse = await request.post('/api/account/reset-password', {
    data: { token: deliveryRows[0].token, newPassword: 'Another-E2E-Password-789!' },
  });
  expect(reuse.status()).toBe(400);
  await page.goto(deliveryRows[0].reset_url);
  await expect(page.getByText('This reset link is invalid, expired, or has already been used.')).toBeVisible();

  await loginWith(page, RESET_LOGIN, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('E2E Reset Member').first()).toBeVisible();
});

test('an admin can send the same reset email from participant accounts', async ({ page }) => {
  await loginWith(page, ADMIN, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/admin/accounts');
  const account = page.locator('article').filter({ hasText: 'E2E Reset Member' }).first();
  await expect(account.getByText(RESET_EMAIL)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await account.getByRole('button', { name: 'Send password reset' }).click();
  await expect(page.getByText(`Password reset email sent to ${RESET_EMAIL}.`)).toBeVisible();

  const deliveries = await prisma.$queryRawUnsafe(`SELECT token FROM app_internal.password_reset_test_delivery WHERE email=$1`, RESET_EMAIL);
  expect(deliveries).toHaveLength(1);
  await page.goto('/admin/password-resets');
  await expect(page.getByRole('heading', { name: 'Password reset emails' })).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'E2E Reset Member' }).getByText('Email sent')).toBeVisible();
});
