import { expect, test, type Locator, type Page } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 21.4 / FDD R-12: a MAP listing set aside as "Approved exception" leaves every
   MAP violation figure; reopening it puts it back; a plain Done does not remove it.
   Reads answer from e2e/catalog-health-mock.ts; set-aside writes go to the in-memory
   mock (e2e/set-aside-mock.ts). */

let errors: string[] = [];
test.beforeEach(() => {
  errors = [];
});
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});

async function openCanvas(page: Page) {
  const opened = await openCatalogHealthCanvas(page);
  errors = opened.errors;
  return opened;
}

async function figure(page: Page) {
  const percent = page.locator("[data-map-lead-percent]");
  await expect(percent).toHaveAttribute("data-map-lead-numerator", /\d+/, { timeout: 20_000 });
  return {
    n: Number(await percent.getAttribute("data-map-lead-numerator")),
    m: Number(await percent.getAttribute("data-map-lead-denominator")),
  };
}

async function openMapTab(page: Page) {
  await page.goto("/dashboard?spoke=ecommerce&tab=map");
  await expect(page.locator(".drilldown-tab-btn.active")).toContainText("MAP");
}

/** A tab click sent while the panel is still settling can be dropped, so retry until it sticks. */
async function switchTab(canvas: { openTab: (t: string) => Promise<void> }, name: string, ready: Locator) {
  await expect(async () => {
    await canvas.openTab(name);
    await expect(ready).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

function mapTable(page: Page): Locator {
  return page.locator("[data-map-listings] table");
}

async function firstRowKey(table: Locator): Promise<string> {
  const button = table.locator("[data-set-aside-open]").first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  return String(await button.getAttribute("data-set-aside-open"));
}

test("an approved exception leaves the MAP figure and reopening puts it back", async ({ page }) => {
  const { canvas, setAsides } = await openCanvas(page);
  await openMapTab(page);
  const before = await figure(page);
  expect(before).toEqual({ n: 3, m: 5 });
  const table = mapTable(page);
  const asin = await firstRowKey(table);

  await table.locator(`[data-set-aside-open="${asin}"]`).click();
  const form = table.locator("[data-set-aside-form]");
  await form.locator("[data-set-aside-reason]").selectOption("approved_exception");
  await form.locator("[data-set-aside-note]").fill("Holiday promo approved by brand");
  await form.locator("[data-set-aside-name]").fill("Test Person");
  await form.locator("[data-set-aside-save]").click();
  await expect(table.locator(`[data-set-aside-chip="${asin}"]`)).toHaveText("Set aside · Approved exception");

  await expect(page.locator("[data-map-lead-percent]")).toHaveAttribute("data-map-lead-numerator", String(before.n - 1));
  await expect(page.locator("[data-map-lead-percent]")).toHaveAttribute("data-map-lead-denominator", String(before.m - 1));
  const ratio = page.locator("[data-map-lead-ratio]");
  await expect(ratio).toHaveText(/\*$/);
  await expect(ratio.locator("[data-ifai-tooltip-desc]")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /1 listing set aside as an approved exception is left out of this count\./,
  );
  // The row stays in the table with its chip.
  await expect(table.locator(`[data-set-aside-chip="${asin}"]`)).toBeVisible();
  expect(setAsides.rows.map((row) => row.check_key)).toEqual(["map_pricing"]);

  // Retail Overview reuses the same figure.
  const hero = page.locator('[data-retail-overview-hero="map_leakage"] [data-retail-hero-percent]');
  await switchTab(canvas, "Retail Overview", hero);
  await expect(hero).toHaveAttribute("data-retail-hero-numerator", String(before.n - 1));
  await expect(page.locator('[data-retail-overview-hero="map_leakage"] [data-retail-hero-ratio]')).toHaveText(/\*$/);

  // Reopen from the MAP history: the row is counted again.
  const history = page.locator('[data-set-aside-history="map_pricing"]');
  await switchTab(canvas, "MAP", history.locator("summary"));
  await history.locator("summary").click();
  await expect(history).toContainText("left out of the MAP figures above until it is reopened");
  await history.locator(`[data-set-aside-reopen="${asin}"]`).click();
  await history.locator("[data-set-aside-name]").fill("Test Person");
  await history.locator("[data-reopen-save]").click();
  await expect(page.locator("[data-map-lead-percent]")).toHaveAttribute("data-map-lead-numerator", String(before.n));
  await expect(page.locator("[data-map-lead-percent]")).toHaveAttribute("data-map-lead-denominator", String(before.m));
  await expect(page.locator("[data-map-lead-ratio]")).not.toHaveText(/\*$/);
});

test("a plain Done on a MAP row keeps it in the count", async ({ page }) => {
  await openCanvas(page);
  await openMapTab(page);
  const before = await figure(page);
  const table = mapTable(page);
  const button = table.locator("[data-done-open]").first();
  const asin = String(await button.getAttribute("data-done-open"));
  await button.click();
  const form = table.locator("[data-done-form]");
  await form.locator("[data-set-aside-name]").fill("Test Person");
  await form.locator("[data-done-save]").click();
  await expect(table.locator(`[data-set-aside-chip="${asin}"]`)).toHaveText("Done");

  await expect(page.locator("[data-map-lead-percent]")).toHaveAttribute("data-map-lead-numerator", String(before.n));
  await expect(page.locator("[data-map-lead-percent]")).toHaveAttribute("data-map-lead-denominator", String(before.m));
});
