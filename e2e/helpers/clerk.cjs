const { test: base, expect } = require('@playwright/test');
const { clerk, setupClerkTestingToken } = require('@clerk/testing/playwright');
const { createClerkClient } = require('@clerk/backend');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { assertClerkTestEnvironment } = require('../../scripts/e2e-environment.cjs');

let activeFixture;

const test = base.extend({
  clerkAccounts: [async ({ baseURL }, use) => {
    assertClerkTestEnvironment({ ...process.env, E2E_BASE_URL: baseURL });
    const fixture = {
      baseURL,
      db: new PrismaClient(),
      client: createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
      accounts: new Map(),
    };
    activeFixture = fixture;
    try {
      await use(fixture);
    } finally {
      activeFixture = undefined;
      const failures = [];
      for (const account of fixture.accounts.values()) {
        try {
          // Only IDs returned by this test's createUser call may be deleted.
          await fixture.client.users.deleteUser(account.identity.id);
        } catch (error) { failures.push(error); }
        try {
          // Most specs delete their local fixtures themselves. Restore only
          // this test's surviving seed row, never another linked identity.
          await fixture.db.user.updateMany({
            where: { id: account.local.id, email: account.email,
              OR: [{ clerkUserId: account.identity.id }, { clerkUserId: null }] },
            data: { email: account.local.email, clerkUserId: null,
              emailConfirmedAt: account.local.emailConfirmedAt },
          });
        } catch (error) { failures.push(error); }
      }
      await fixture.db.$disconnect();
      if (failures.length) throw new AggregateError(failures, 'Clerk E2E fixture cleanup failed');
    }
  }, { auto: true }],
});

async function signIn(pageOrContext, localEmail) {
  const fixture = activeFixture;
  if (!fixture) throw new Error('Import test from e2e/helpers/clerk.cjs before signing in.');
  let account = fixture.accounts.get(localEmail);
  if (!account) {
    const local = await fixture.db.user.findUniqueOrThrow({ where: { email: localEmail } });
    if (local.clerkUserId) throw new Error('Refusing to replace an existing Clerk identity in a fixture.');
    if (!local.email.endsWith('@example.test')) throw new Error('Only synthetic E2E accounts may sign in.');
    // Unique even across retries, concurrent branches and cancelled runs.
    // Clerk's test address suffix prevents delivery to a real mailbox.
    const email = `fitness-${randomUUID()}+clerk_test@example.com`;
    const identity = await fixture.client.users.createUser({
      emailAddress: [email], password: `E2E-${randomUUID()}-aA1!`,
      privateMetadata: { purpose: 'fitness-tracker-e2e' },
    });
    account = { local, identity, email };
    fixture.accounts.set(localEmail, account);
    // Do not pre-link clerkUserId: exercise the real verified-email migration
    // while preserving the local ID, role, scores and activity history.
    await fixture.db.user.update({ where: { id: local.id }, data: { email } });
  }
  const page = typeof pageOrContext.newPage === 'function' ? await pageOrContext.newPage() : pageOrContext;
  await setupClerkTestingToken({ page });
  await page.goto(`${fixture.baseURL}/auth/login`);
  await clerk.signIn({ page, emailAddress: account.email });
  await page.goto(`${fixture.baseURL}/dashboard`);
  await expect(page).toHaveURL(/\/dashboard/);
  const response = await page.request.get(`${fixture.baseURL}/api/auth/session`);
  expect(response.status()).toBe(200);
  expect((await response.json()).user).toMatchObject({ id: account.local.id, role: account.local.role });
  const linked = await fixture.db.user.findUniqueOrThrow({ where: { id: account.local.id } });
  expect(linked.clerkUserId).toBe(account.identity.id);
  return page;
}

async function signOut(page) {
  await clerk.signOut({ page });
  const response = await page.request.get('/api/auth/session');
  expect(response.status()).toBe(401);
}

module.exports = { test, expect, signIn, signOut };
