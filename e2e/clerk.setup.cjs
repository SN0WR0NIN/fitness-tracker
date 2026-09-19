const { test: setup } = require('@playwright/test');
const { clerkSetup } = require('@clerk/testing/playwright');
const { assertClerkTestEnvironment } = require('../scripts/e2e-environment.cjs');

// A setup project propagates the testing token to dependent test workers.
setup('initialize Clerk development testing token', async () => {
  assertClerkTestEnvironment();
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, dotenv: false });
});
