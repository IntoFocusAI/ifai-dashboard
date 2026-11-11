import { expect, test, type Locator } from "./fixtures";
import type { Page } from "@playwright/test";

/* Worker 18.5: a row set aside on a check is marked in place, listed in the
   check's history with who, why, and when, and reopens on the same row. */

async function setAsideFirst(table: Locator, reason: string, name: string, note = "") {
  const button = table.locator("[data-set-aside-open]").first();
  await expect(button).toBeVisible();
  const key = await button.getAttribute("data-set-aside-open");
  await button.click();
  const form = table.locator("[data-set-aside-form]");
  await form.locator("[data-set-aside-reason]").selectOption(reason);
  if (note) await form.locator("[data-set-aside-note]").fill(note);
  await form.locator("[data-set-aside-name]").fill(name);
  await form.locator("[data-set-aside-save]").click();
  return String(key);
}

test("an Amazon Specs listing can be set aside and reopened", async ({ canvas, page, setAsides }) => {
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await canvas.openTab("Amazon Specs");

  const table = page.locator("#spec-readiness-by-asin");
  const asin = await setAsideFirst(table, "discontinued", "Test Person");
  expect(asin).toMatch(/^[A-Z0-9]{10}$/);

  await expect(table.locator(`[data-set-aside-chip="${asin}"]`)).toHaveText("Set aside · Discontinued");
  expect(setAsides.calls[0].body).toMatchObject({ p_check_key: "amazon_specs", p_entity_key: asin });

  const history = page.locator('[data-set-aside-history="amazon_specs"]');
  await history.locator("summary").click();
  await expect(history).toContainText("Set aside by Test Person");
  await history.locator(`[data-set-aside-reopen="${asin}"]`).click();
  await history.locator("[data-reopen-save]").click();

  await expect(table.locator(`[data-set-aside-open="${asin}"]`)).toBeVisible();
  await expect(history.locator("summary")).toContainText("0 done · 0 set aside · 1 reopened");
  expect(setAsides.rows).toHaveLength(1);
});

test("a MAP approved exception needs a note and stays on the MAP check", async ({ canvas, page, setAsides }) => {
  await canvas.openPriority("Buy Box withheld");
  await canvas.openTab("MAP");
  const table = page.locator("table").filter({
    has: page.locator("[data-set-aside-open]"),
  }).first();

  const button = table.locator("[data-set-aside-open]").first();
  await button.click();
  const form = table.locator("[data-set-aside-form]");
  await form.locator("[data-set-aside-reason]").selectOption("approved_exception");
  await form.locator("[data-set-aside-name]").fill("Test Person");
  await form.locator("[data-set-aside-save]").click();
  await expect(form.locator(".set-aside-error")).toContainText("needs a note");
  expect(setAsides.calls).toHaveLength(0);

  await form.locator("[data-set-aside-note]").fill("Holiday promo approved by brand");
  await form.locator("[data-set-aside-save]").click();
  await expect(table.locator("[data-set-aside-chip]")).toHaveCount(1);
  expect(setAsides.rows.map((row) => row.check_key)).toEqual(["map_pricing"]);
});

test("an Amazon Specs listing can be marked done with just a name", async ({ canvas, page, setAsides }) => {
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await canvas.openTab("Amazon Specs");

  const table = page.locator("#spec-readiness-by-asin");
  const button = table.locator("[data-done-open]").first();
  const asin = String(await button.getAttribute("data-done-open"));
  await button.click();
  const form = table.locator("[data-done-form]");
  await expect(form.locator("[data-set-aside-reason]")).toHaveCount(0);
  await form.locator("[data-set-aside-name]").fill("Test Person");
  await form.locator("[data-done-save]").click();

  await expect(table.locator(`[data-set-aside-chip="${asin}"]`)).toHaveText("Done");
  expect(setAsides.calls[0]).toMatchObject({
    fn: "mark_issue_done",
    body: { p_check_key: "amazon_specs", p_entity_key: asin, p_name: "Test Person" },
  });
  const history = page.locator('[data-set-aside-history="amazon_specs"]');
  await expect(history.locator("summary")).toContainText("1 done · 0 set aside");
});

/* Worker 25.15: the set-aside tables and views are shared and client-keyed, so Ledlenser runs the
   same flow under its own key. */
test.describe("Ledlenser", () => {
  async function openLedlenserAmazonSpecs(page: Page, baseURL: string | undefined) {
    const host = new URL(baseURL ?? "http://localhost").hostname;
    // Ledlenser's site-type read is not in the database yet; it is not what this spec checks.
    await page.route("**/rest/v1/canvas_site_types*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.context().addCookies([{ name: "ifai_guest_ledlenser", value: "1", domain: host, path: "/" }]);
    await page.goto("/dashboard?client=ledlenser&spoke=specs&tab=amazon-specs");
    const skipLogin = page.getByRole("button", { name: "Skip Login" });
    if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
    return page.locator("#spec-readiness-by-asin");
  }

  test("an Amazon Specs listing can be set aside under the ledlenser key", async ({ page, baseURL, setAsides }) => {
    const table = await openLedlenserAmazonSpecs(page, baseURL);
    const asin = await setAsideFirst(table, "discontinued", "Test Person");
    expect(asin).toMatch(/^[A-Z0-9]{10}$/);
    await expect(table.locator(`[data-set-aside-chip="${asin}"]`)).toHaveText("Set aside · Discontinued");
    expect(setAsides.calls[0].body).toMatchObject({
      p_client_key: "ledlenser",
      p_check_key: "amazon_specs",
      p_entity_key: asin,
    });
  });

  test("an Unknown client. answer from the database is shown on the form", async ({ page, baseURL, setAsides, pageErrors }) => {
    await page.route("**/rest/v1/rpc/set_aside_issue", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unknown client.", code: "22023" }),
      }),
    );
    const table = await openLedlenserAmazonSpecs(page, baseURL);
    await setAsideFirst(table, "discontinued", "Test Person");
    await expect(table.locator("[data-set-aside-form] .set-aside-error")).toContainText(
      "not set up for set-asides yet",
    );
    expect(setAsides.rows).toHaveLength(0);
    // The 400 is the answer this test sends on purpose.
    pageErrors.splice(0, pageErrors.length, ...pageErrors.filter((line) => !line.includes("rpc/set_aside_issue")));
  });
});
