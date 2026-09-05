const { test, expect } = require('@playwright/test');

const PASSWORD = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';
const MEMBER = 'member-e2e@example.test';
const ADMIN = 'admin-e2e@example.test';
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlWRAAAAABJRU5ErkJggg==', 'base64');

async function login(context, email) {
  const page = await context.newPage();
  await page.goto('/auth/login');
  await page.getByPlaceholder('Your username or email').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

test('member to admin workflow stays correct and private', async ({ browser, request }) => {
  const memberContext = await browser.newContext();
  const memberPage = await login(memberContext, MEMBER);
  await expect(memberPage.getByText('E2E Member').first()).toBeVisible();

  const fakeImage = await memberPage.request.post('/api/upload', {
    multipart: { file: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not-a-png') } },
  });
  expect(fakeImage.status()).toBe(400);

  const upload = await memberPage.request.post('/api/upload', {
    multipart: { file: { name: 'proof.png', mimeType: 'image/png', buffer: PNG_1X1 } },
  });
  expect(upload.ok()).toBeTruthy();
  const { url: proofUrl } = await upload.json();
  expect(proofUrl).toMatch(/^https:\/\/example\.invalid\/e2e-proof\//);

  const outsideWindow = await memberPage.request.post('/api/activities', {
    data: { activityDate: '2026-08-31', category: 'RUN', distance: 5, pace: 6 },
  });
  expect(outsideWindow.status()).toBe(400);

  const create = await memberPage.request.post('/api/activities', {
    data: { activityDate: '2026-09-02', category: 'RUN', distance: 5, pace: 6, proofUrl },
  });
  expect(create.status()).toBe(201);
  const created = await create.json();
  expect(created.status).toBe('PENDING');

  const edit = await memberPage.request.patch(`/api/activities/${created.id}`, {
    data: { category: 'RUN', distance: 5.2, pace: 6, proofUrl },
  });
  expect(edit.ok()).toBeTruthy();
  const edited = await edit.json();
  expect(edited.distance).toBeCloseTo(5.2, 5);

  const memberCannotApprove = await memberPage.request.post(`/api/admin/activities/${created.id}/approve`, { data: {} });
  expect(memberCannotApprove.status()).toBe(403);

  const pendingPublic = await request.get('/api/activities?status=PENDING');
  expect(pendingPublic.status()).toBe(403);

  const adminContext = await browser.newContext();
  const adminPage = await login(adminContext, ADMIN);
  await adminPage.goto('/admin');
  await expect(adminPage.getByRole('heading', { name: 'Automated safety net' }).first()).toBeVisible();
  await expect(adminPage.getByText('Score reconciliation').first()).toBeVisible();

  const approve = await adminPage.request.post(`/api/admin/activities/${created.id}/approve`, { data: {} });
  expect(approve.ok()).toBeTruthy();
  const approved = await approve.json();
  expect(approved.status).toBe('APPROVED');
  expect(approved.points).toBeGreaterThan(0);

  const leaderboardResponse = await request.get('/api/leaderboard?type=individual');
  expect(leaderboardResponse.ok()).toBeTruthy();
  const leaderboardPayload = await leaderboardResponse.json();
  const memberStanding = leaderboardPayload.leaderboard.find((entry) => entry.userId === 'e2e_member');
  expect(memberStanding).toBeTruthy();
  expect(memberStanding.totalPoints).toBeCloseTo(approved.points, 5);
  expect(memberStanding.userEmail).toBeUndefined();

  const approvedPublic = await request.get('/api/activities?userId=e2e_member&status=APPROVED');
  expect(approvedPublic.ok()).toBeTruthy();
  const publicActivities = await approvedPublic.json();
  const publicCreated = publicActivities.find((activity) => activity.id === created.id);
  expect(publicCreated).toBeTruthy();
  expect(publicCreated.user.email).toBeUndefined();
  expect(publicCreated.proofUrl).toBe(proofUrl);

  await memberPage.goto('/participants/e2e_member');
  await expect(memberPage.getByText('E2E Member').first()).toBeVisible();

  const duplicateCreate = await memberPage.request.post('/api/activities', {
    data: { activityDate: '2026-09-02', category: 'RUN', distance: 5.2, pace: 6, proofUrl },
  });
  expect(duplicateCreate.status()).toBe(201);
  const duplicateActivity = await duplicateCreate.json();

  const duplicateBlocked = await adminPage.request.post(`/api/admin/activities/${duplicateActivity.id}/approve`, { data: {} });
  expect(duplicateBlocked.status()).toBe(409);

  const duplicateOverride = await adminPage.request.post(`/api/admin/activities/${duplicateActivity.id}/approve`, {
    data: { duplicateOverrideReason: 'E2E temporary approval for duplicate-centre reversal test' },
  });
  expect(duplicateOverride.ok()).toBeTruthy();
  const duplicateApproved = await duplicateOverride.json();
  expect(duplicateApproved.status).toBe('APPROVED');

  const doubledResponse = await request.get('/api/leaderboard?type=individual');
  const doubledPayload = await doubledResponse.json();
  const doubledStanding = doubledPayload.leaderboard.find((entry) => entry.userId === 'e2e_member');
  expect(doubledStanding.totalPoints).toBeCloseTo(approved.points + duplicateApproved.points, 5);

  await adminPage.goto('/admin/duplicates');
  await expect(adminPage.getByRole('heading', { name: 'Duplicate Review Centre' })).toBeVisible();
  await expect(adminPage.getByText('E2E Member').first()).toBeVisible();

  const markDuplicate = await adminPage.request.post('/api/admin/duplicates/decision', {
    data: {
      action: 'DUPLICATE',
      activityAId: created.id,
      activityBId: duplicateActivity.id,
      duplicateActivityId: duplicateActivity.id,
      note: 'E2E confirmed duplicate',
    },
  });
  expect(markDuplicate.ok()).toBeTruthy();

  const afterDuplicateResponse = await request.get('/api/leaderboard?type=individual');
  const afterDuplicatePayload = await afterDuplicateResponse.json();
  const afterDuplicateStanding = afterDuplicatePayload.leaderboard.find((entry) => entry.userId === 'e2e_member');
  expect(afterDuplicateStanding.totalPoints).toBeCloseTo(approved.points, 5);

  const approvedAfterDuplicate = await request.get('/api/activities?userId=e2e_member&status=APPROVED');
  const approvedAfterDuplicateRows = await approvedAfterDuplicate.json();
  expect(approvedAfterDuplicateRows.some((activity) => activity.id === duplicateActivity.id)).toBeFalsy();

  await adminPage.goto('/admin/duplicates');
  await adminPage.getByRole('button', { name: /Resolved/ }).click();
  await expect(adminPage.getByText('Duplicate resolved').first()).toBeVisible();

  const second = await memberPage.request.post('/api/activities', {
    data: { activityDate: '2026-09-03', category: 'CYCLE', distance: 12, proofUrl },
  });
  expect(second.status()).toBe(201);
  const secondActivity = await second.json();

  const reject = await adminPage.request.post(`/api/admin/activities/${secondActivity.id}/reject`, {
    data: { reason: 'E2E rejection reason' },
  });
  expect(reject.ok()).toBeTruthy();
  const rejected = await reject.json();
  expect(rejected.status).toBe('REJECTED');
  expect(rejected.rejectionReason).toBe('E2E rejection reason');

  const leaderboardAfterReject = await request.get('/api/leaderboard?type=individual');
  const leaderboardAfterPayload = await leaderboardAfterReject.json();
  const standingAfterReject = leaderboardAfterPayload.leaderboard.find((entry) => entry.userId === 'e2e_member');
  expect(standingAfterReject.totalPoints).toBeCloseTo(approved.points, 5);

  await memberPage.goto('/dashboard');
  await expect(memberPage.getByText('E2E Member').first()).toBeVisible();

  await adminContext.close();
  await memberContext.close();
});
