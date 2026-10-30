const { test, expect } = require('@playwright/test');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { assertDisposableEnvironment } = require('../scripts/e2e-environment.cjs');
const { resetFixture, resetLink } = require('./helpers/reset-fixture.cjs');

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
  assertDisposableEnvironment();
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

test('email recovery preserves generic responses and completes a real signed link once', async ({ browser, request, baseURL }) => {
  const unknownResponse = await request.post('/api/account/forgot-password', { data: { identifier: 'not-a-real-e2e-user' } });
  const validResponse = await request.post('/api/account/forgot-password', { data: { identifier: RESET_LOGIN } });
  expect(unknownResponse.status()).toBe(200);
  expect(validResponse.status()).toBe(200);
  expect(validResponse.headers()['cache-control']).toContain('no-store');
  expect(await validResponse.json()).toEqual(await unknownResponse.json());
  // The recovered live endpoint sends email links, not manual queue requests.
  // CI intentionally has no mail provider secret. Capture only the actual
  // helper's transport in-process; complete its token through the real app.
  expect(await prisma.$queryRawUnsafe(`SELECT id FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member'`)).toHaveLength(0);
  const fixture = resetFixture(prisma);
  await fixture.email.requestEmailPasswordReset('not-a-real-e2e-user', baseURL);
  expect(fixture.emails).toHaveLength(0);
  await fixture.email.requestEmailPasswordReset(RESET_LOGIN, baseURL);
  expect(fixture.emails).toHaveLength(1);
  expect(fixture.emails[0].subject).toBe('Reset your KG Stay Active password');
  const link = resetLink(fixture.emails[0]);
  expect(link.origin).toBe(new URL(baseURL).origin);
  expect(link.pathname).toBe('/auth/reset-password');
  const token = link.searchParams.get('token');
  expect(token.length).toBeGreaterThan(20);
  const before = await prisma.user.findUniqueOrThrow({ where: { id: 'e2e_reset_member' } });

  const oldContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const oldPage = await oldContext.newPage();
    await loginWith(oldPage, RESET_LOGIN, PASSWORD);
    await expect(oldPage).toHaveURL(/\/dashboard/);
    expect((await (await oldContext.request.get(`${baseURL}/api/auth/session`)).json()).user.id).toBe(before.id);

    const expiredFixture = resetFixture(prisma, { now: Date.now() - 2 * 60 * 60 * 1000 });
    await expiredFixture.email.requestEmailPasswordReset(RESET_LOGIN, baseURL);
    const expiredToken = resetLink(expiredFixture.emails[0]).searchParams.get('token');
    const tamperedToken = `${token[0] === 'a' ? 'b' : 'a'}${token.slice(1)}`;
    for (const invalid of [expiredToken, tamperedToken]) {
      const rejected = await request.post('/api/account/reset-password', { data: { token: invalid, newPassword: NEW_PASSWORD } });
      expect(rejected.status()).toBe(400);
      expect(rejected.headers()['cache-control']).toContain('no-store');
    }
    const samePassword = await request.post('/api/account/reset-password', { data: { token, newPassword: PASSWORD } });
    expect(samePassword.status()).toBe(400);
    expect((await samePassword.json()).error).toContain('different from your current password');
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
    expect(unchanged.password).toBe(before.password);
    expect(unchanged.sessionVersion).toBe(before.sessionVersion);

    const memberPage = await memberContext.newPage();
    await memberPage.goto('/auth/reset-password');
    await expect(memberPage.getByRole('status')).toContainText('invalid or incomplete');
    await expect(memberPage.locator('input[autocomplete="new-password"]')).toHaveCount(0);
    await memberPage.goto(link.href);
    const newPasswordFields = memberPage.locator('input[autocomplete="new-password"]');
    await newPasswordFields.nth(0).fill(NEW_PASSWORD);
    await newPasswordFields.nth(1).fill(NEW_PASSWORD);
    await memberPage.getByRole('button', { name: 'Update password' }).click();
    await expect(memberPage.getByText('Password reset complete. Log in with your new password.')).toBeVisible();
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
    expect(await bcrypt.compare(NEW_PASSWORD, changed.password)).toBe(true);
    expect(changed.sessionVersion).toBe(before.sessionVersion + 1);
    expect(changed.mustChangePassword).toBe(false);
    expect(changed.temporaryPasswordExpiresAt).toBeNull();
    // An existing NextAuth cookie must lose its identity after reset.
    expect((await (await oldContext.request.get(`${baseURL}/api/auth/session`)).json()).user).toBeUndefined();
    const reuse = await request.post('/api/account/reset-password', {
      data: { token, newPassword: 'Another-E2E-Password-789!' },
    });
    expect(reuse.status()).toBe(400);
    await loginWith(memberPage, RESET_LOGIN, PASSWORD);
    await expect(memberPage.getByText(/Invalid credentials, expired temporary password/)).toBeVisible();
    await expect(memberPage).toHaveURL(/\/auth\/login/);
    await loginWith(memberPage, RESET_LOGIN, NEW_PASSWORD);
    await expect(memberPage).toHaveURL(/\/dashboard/);
    await expect(memberPage.getByText('E2E Reset Member').first()).toBeVisible();
  } finally {
    await oldContext.close();
    await memberContext.close();
  }
});

test('legacy manual issuance UI and completion helper retain their account protections', async ({ browser, baseURL }) => {
  // The email-only public route no longer creates this legacy queue. Exercise
  // existing manual issuance/backend protections without pretending its old
  // temporary-password completion form is still the current recovery UI.
  const fixture = resetFixture(prisma);
  await fixture.manual.requestPasswordReset(RESET_LOGIN);
  const requestRows = await prisma.$queryRawUnsafe(`SELECT id, status FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member'`);
  expect(requestRows).toHaveLength(1);
  expect(requestRows[0].status).toBe('OPEN');
  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
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
    const issuedUser = await prisma.user.findUniqueOrThrow({ where: { id: 'e2e_reset_member' } });
    expect(issuedUser.mustChangePassword).toBe(true);
    expect(issuedUser.sessionVersion).toBeGreaterThan(0);
    expect(await bcrypt.compare(temporaryPassword, issuedUser.password)).toBe(true);

    const memberPage = await memberContext.newPage();
    await loginWith(memberPage, RESET_LOGIN, temporaryPassword);
    await expect(memberPage).toHaveURL(/\/auth\/reset-password/);
    expect((await (await memberContext.request.get(`${baseURL}/api/auth/session`)).json()).user).toBeUndefined();
    // Directly test the preserved backend helper, not the replaced public API.
    await fixture.manual.completePasswordReset(RESET_LOGIN, temporaryPassword, NEW_PASSWORD);
    const completedRows = await prisma.$queryRawUnsafe(`SELECT status, completed_at FROM app_internal.password_reset_request WHERE user_id='e2e_reset_member' ORDER BY created_at DESC LIMIT 1`);
    expect(completedRows[0].status).toBe('COMPLETED');
    expect(completedRows[0].completed_at).toBeTruthy();
    await expect(fixture.manual.completePasswordReset(RESET_LOGIN, temporaryPassword, 'Another-E2E-Password-789!')).rejects.toThrow('INVALID_RESET_CREDENTIALS');
    await loginWith(memberPage, RESET_LOGIN, NEW_PASSWORD);
    await expect(memberPage).toHaveURL(/\/dashboard/);
    await expect(memberPage.getByText('E2E Reset Member').first()).toBeVisible();
    await adminPage.goto('/admin/password-resets');
    await adminPage.getByRole('button', { name: 'History' }).click();
    await expect(adminPage.locator('article').filter({ hasText: 'E2E Reset Member' }).getByText('Completed')).toBeVisible();
  } finally {
    await memberContext.close();
    await adminContext.close();
  }
});
