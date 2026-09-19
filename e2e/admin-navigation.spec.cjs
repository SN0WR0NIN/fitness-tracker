const { test, expect, signIn } = require('./helpers/clerk.cjs');

const ADMIN = "admin-e2e@example.test";


async function adminLogin(page) {
  await signIn(page, ADMIN);
}

test("admin navigation exposes one Admin hub entry with grouped tools", async ({
  page,
}) => {
  await adminLogin(page);

  const nav = page.locator("nav").first();
  await expect(
    nav.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(1);
  await expect(
    nav.getByRole("link", { name: "Control", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Review", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);

  await nav.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Run the challenge from one place" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Everything grouped by job" }),
  ).toBeVisible();

  const activities = page.locator("#admin-review");
  const people = page.locator("#admin-participants");
  const competition = page.locator("#admin-competition");
  const reports = page.locator("#admin-reports");
  const system = page.locator("#admin-system");

  await expect(activities.getByRole("heading", { name: "Review" })).toBeVisible();
  await expect(people.getByRole("heading", { name: "Participants" })).toBeVisible();
  await expect(competition.getByRole("heading", { name: "Competition" })).toBeVisible();
  await expect(reports.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(system.getByRole("heading", { name: "System" })).toBeVisible();

  await expect(
    activities.getByRole("link", { name: /Create activity/ }),
  ).toBeVisible();
  await expect(
    activities.getByRole("link", { name: /Activity review/ }),
  ).toBeVisible();
  await expect(
    activities.getByRole("link", { name: /Duplicate review/ }),
  ).toBeVisible();

  await expect(
    people.getByRole("link", { name: /Manage participants/ }),
  ).toBeVisible();
  await expect(
    people.getByRole("link", { name: /Password resets/ }),
  ).toBeVisible();

  await expect(
    competition.getByRole("link", { name: /Weekly awards/ }),
  ).toBeVisible();
  await expect(
    competition.getByRole("link", { name: /Weekly recap/ }),
  ).toBeVisible();
  await expect(
    competition.getByRole("link", { name: /Public results/ }),
  ).toBeVisible();

  await expect(
    reports.getByRole("link", { name: /Operations & analytics/ }),
  ).toBeVisible();
  await expect(
    system.getByRole("link", { name: /Settings & scoring/ }),
  ).toBeVisible();
  await expect(
    reports.getByRole("link", { name: /Fresh backup now/ }),
  ).toBeVisible();

  const systemHealth = page.locator("#system-health");
  await expect(systemHealth).toBeVisible();
  const activityFeed = page.getByRole("heading", {
    name: "Recent admin activity",
  });
  await expect(activityFeed).toBeVisible();
  const feedBox = await activityFeed.boundingBox();
  const healthBox = await systemHealth.boundingBox();
  expect(feedBox && healthBox && healthBox.y > feedBox.y).toBeTruthy();

  await page.goto("/admin/operations");
  await expect(
    page.getByRole("heading", { name: "Operations & analytics" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operational analytics" }),
  ).toBeVisible();
  await expect(page.getByText("Upload failures · 7 days")).toBeVisible();

  const rebuild = await page.request.post("/api/admin/awards/generate", {
    data: { weekNumber: 1 },
  });
  expect(rebuild.status()).toBe(200);
  expect(await rebuild.json()).toMatchObject({
    ok: true,
    weekNumber: 1,
    resultKey: "e2e:1:true",
  });
});
