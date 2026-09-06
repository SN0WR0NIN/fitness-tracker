const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const vm = require('node:vm');

test('PWA manifest, actual service-worker offline fallback, and private-cache exclusions', async ({ browser, baseURL, request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.display).toBe('standalone');
  expect(body.icons.some((i) => i.sizes === '192x192')).toBe(true);
  expect(body.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  for (const icon of body.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const context = await browser.newContext({ baseURL, serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await page.goto('/install');
    await expect(page.getByRole('heading', { name: 'Add KG Active to your device' })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(async () => {
      await fetch('/api/config');
      await fetch('/api/account/notifications');
      await fetch('/dashboard?_rsc=private-test', { headers: { RSC: '1' } });
    });
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const requests = await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((req) => new URL(req.url).pathname)));
      return requests.flat();
    });
    expect(cached).toContain('/offline');
    expect(cached.some((path) => /^\/(api|admin|account|dashboard|auth)(\/|$)/.test(path))).toBe(false);
    await context.setOffline(true);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/offline|connection/i);
    await expect(page.locator('body')).not.toContainText('Focused member');
  } finally { await context.close(); }
});

test('installation prompt, installed detection and iPad guidance', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/install');
    await expect(page.getByRole('heading', { name: 'Add KG Active to your device' })).toBeVisible();
    await page.evaluate(() => {
      window.__promptCalls = 0;
      const event = new Event('beforeinstallprompt');
      event.prompt = async () => { window.__promptCalls++; };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await page.getByRole('button', { name: 'Install KG Active', exact: true }).click();
    expect(await page.evaluate(() => window.__promptCalls)).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(page.getByRole('heading', { name: 'KG Active is installed', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install KG Active', exact: true })).toHaveCount(0);
  } finally { await context.close(); }
  const ipad = await browser.newContext({ baseURL });
  try {
    await ipad.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    });
    const page = await ipad.newPage();
    await page.goto('/install');
    await expect(page.getByRole('heading', { name: 'iPhone / iPad' })).toBeVisible();
    await expect(page.getByText(/tap Share, then Add to Home Screen/)).toBeVisible();
  } finally { await ipad.close(); }
});

test('PWA updates wait for explicit confirmation and do not discard work on cancellation', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  try {
    await context.addInitScript(() => {
      window.__updateMessages = [];
      const registration = { waiting: { postMessage: (message) => window.__updateMessages.push(message) }, addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(navigator, 'serviceWorker', { value: { controller: {}, register: async () => registration, ready: Promise.resolve(registration), addEventListener() {}, removeEventListener() {} } });
    });
    const page = await context.newPage();
    await page.goto('/install');
    const update = page.getByRole('button', { name: 'Update and reload', exact: true }).first();
    await expect(update).toBeVisible();
    expect(await page.evaluate(() => window.__updateMessages)).toEqual([]);
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'unsaved-test'; input.value = 'Unsaved draft'; document.body.appendChild(input); });
    page.once('dialog', (dialog) => dialog.dismiss());
    await update.click();
    expect(await page.evaluate(() => window.__updateMessages)).toEqual([]);
    await expect(page.locator('#unsaved-test')).toHaveValue('Unsaved draft');
    page.once('dialog', (dialog) => dialog.accept());
    await update.click();
    expect(await page.evaluate(() => window.__updateMessages)).toEqual([{ type: 'SKIP_WAITING' }]);
  } finally { await context.close(); }
});

test('service-worker event policy excludes private payloads and rejects external notification targets', async () => {
  const listeners = {};
  const deleted = [];
  let skipped = 0;
  let navigated = '';
  const scope = {
    URL, Response, Promise,
    fetch: async () => new Response('network only'),
    caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => ['kg-stay-active-v2', 'unrelated-app-cache'], delete: async (name) => deleted.push(name), match: async () => new Response('Offline') },
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, listener) => { listeners[name] = listener; }, skipWaiting: () => { skipped++; }, clients: { claim: async () => {}, matchAll: async () => [], openWindow: async (target) => { navigated = target; } } },
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), scope);
  let waiting;
  listeners.install({ waitUntil: (promise) => { waiting = promise; } });
  await waiting;
  expect(skipped).toBe(0);
  listeners.message({ data: { type: 'SKIP_WAITING' } });
  expect(skipped).toBe(1);
  listeners.activate({ waitUntil: (promise) => { waiting = promise; } });
  await waiting;
  expect(deleted).toEqual(['kg-stay-active-v2']);
  for (const path of ['/api/account/settings', '/api/admin/export?type=backup', '/auth/login', '/dashboard?_rsc=secret', '/admin', '/account', '/proofs/private.png']) {
    let responded = false;
    listeners.fetch({ request: { method: 'GET', mode: 'cors', url: `https://example.test${path}` }, respondWith: () => { responded = true; } });
    expect(responded, path).toBe(false);
  }
  listeners.notificationclick({ notification: { close() {}, data: { url: 'https://external.example/phishing' } }, waitUntil: (promise) => { waiting = promise; } });
  await waiting;
  expect(navigated).toBe('/notifications');
});
