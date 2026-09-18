const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function assertDisposableEnvironment(env = process.env) {
  const app = new URL(env.E2E_BASE_URL || 'http://127.0.0.1:3000');
  const urls = [env.DATABASE_URL, env.DIRECT_URL].map(value => new URL(value || 'http://invalid'));
  if (env.CI !== 'true' || env.E2E_TEST_MODE !== '1' || env.VERCEL || env.VERCEL_ENV
      || app.protocol !== 'http:' || !LOCAL_HOSTS.has(app.hostname)
      || urls.some(url => !['postgres:', 'postgresql:'].includes(url.protocol)
        || !LOCAL_HOSTS.has(url.hostname) || url.pathname !== '/fitness_tracker_e2e'
        || [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public'))) {
    throw new Error('E2E requires the disposable localhost fitness_tracker_e2e database and app.');
  }
}

function assertClerkTestEnvironment(env = process.env) {
  assertDisposableEnvironment(env);
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
      || !env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
    throw new Error('Configure E2E_CLERK_PUBLISHABLE_KEY and E2E_CLERK_SECRET_KEY GitHub Actions secrets from a dedicated Clerk DEVELOPMENT instance. Production keys are forbidden.');
  }
}

module.exports = { assertDisposableEnvironment, assertClerkTestEnvironment };
if (require.main === module) assertClerkTestEnvironment();
