const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  projects: [
    { name: 'clerk-setup', testMatch: /clerk\.setup\.cjs/ },
    { name: 'e2e', testMatch: /.*\.spec\.cjs/, dependencies: ['clerk-setup'] },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
    // Traces contain Clerk session cookies/tokens; never upload them from a public repo.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
});
