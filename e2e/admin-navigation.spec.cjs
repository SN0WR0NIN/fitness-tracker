const { test, expect } = require("@playwright/test");

const PASSWORD = process.env.E2E_PASSWORD;
const ADMIN = "admin-e2e@example.test";

if (!PASSWORD) throw new Error("E2E_PASSWORD is required.");

async function adminLogin(page) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("Your username or email").fill(ADMIN);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function ensureOpen(details) {
  const isOpen = await details.evaluate((element) => element.open);
  if (!isOpen) await details.locator("summary").click();
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
    page.getByRole("heading", { name: "Command Centre 2.0" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Admin tools" }),
  ).toBeVisible();

  const activities = page
    .locator("details")
    .filter({ hasText: "Activities" })
    .first();
  const people = page
    .locator("details")
    .filter({ hasText: "People & access" })
    .first();
  const competition = page
    .locator("details")
    .filter({ hasText: "Competition" })
    .first();
  const system = page.locator("details").filter({ hasText: "System" }).first();

  await expect(activities.locator("summary")).toContainText("Activities");
  await expect(people.locator("summary")).toContainText("People & access");
  await expect(competition.locator("summary")).toContainText("Competition");
  await expect(system.locator("summary")).toContainText("System");

  await ensureOpen(activities);
  await expect(
    activities.getByRole("link", { name: /Create activity/ }),
  ).toBeVisible();
  await expect(
    activities.getByRole("link", { name: /Review pending/ }),
  ).toBeVisible();
  await expect(
    activities.getByRole("link", { name: /Duplicate review/ }),
  ).toBeVisible();

  await ensureOpen(people);
  await expect(
    people.getByRole("link", { name: /Manage users/ }),
  ).toBeVisible();
  await expect(
    people.getByRole("link", { name: /Password resets/ }),
  ).toBeVisible();

  await ensureOpen(competition);
  await expect(
    competition.getByRole("link", { name: /Weekly awards/ }),
  ).toBeVisible();
  await expect(
    competition.getByRole("link", { name: /Weekly recap/ }),
  ).toBeVisible();
  await expect(
    competition.getByRole("link", { name: /Public results/ }),
  ).toBeVisible();

  await ensureOpen(system);
  await expect(
    system.getByRole("link", { name: /Operations & analytics/ }),
  ).toBeVisible();
  await expect(
    system.getByRole("link", { name: /Settings & scoring/ }),
  ).toBeVisible();
  await expect(
    system.getByRole("link", { name: /Fresh backup now/ }),
  ).toBeVisible();

  const attention = page.getByRole("heading", { name: "Attention required" });
  const pendingStat = page
    .getByText("Pending review", { exact: true })
    .locator("..");
  const pendingValue = Number.parseInt(
    (await pendingStat.locator("p").last().textContent()) || "0",
    10,
  );
  if (pendingValue > 0) await expect(attention).toBeVisible();

  const systemHealth = page.locator("#system-health");
  await expect(systemHealth).toBeVisible();
  const activityFeed = page.getByRole("heading", {
    name: "Admin activity feed",
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
});
