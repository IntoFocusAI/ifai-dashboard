import { expect, test, type Page } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 24.3 / FDD R-09: the MAP Leakage tab shows MAP exposure. Violations are N of M, each
   listing shows its price gap, its SmartScout estimated monthly units, and its discounted
   retail value (Amazon gap times units), labeled analyst estimate and never lost revenue. A
   listing without units is awaiting inputs, never $0. An approved exception leaves the total
   (R-12). Reads answer from e2e/catalog-health-mock.ts: $100 x 5 + $50 x 2 = $600 a month,
   2 of 3 listings estimated. */

let errors: string[] = [];
test.beforeEach(() => {
  errors = [];
});
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});

async function openMapLeakage(page: Page, slug = "map-leakage") {
  const opened = await openCatalogHealthCanvas(page);
  errors = opened.errors;
  await page.goto(`/dashboard?spoke=ecommerce&tab=${slug}`);
  await expect(page.locator(".drilldown-tab-btn.active")).toHaveText(/^MAP Leakage/);
  await expect(page.locator('[data-map-exposure="ready"]')).toBeVisible({ timeout: 20_000 });
  return opened;
}

test("MAP Leakage shows discounted retail value as an analyst estimate with its coverage", async ({ page }) => {
  await openMapLeakage(page);
  const card = page.locator("[data-map-exposure]");
  await expect(card).toContainText("Discounted retail value");
  await expect(card.locator("[data-map-exposure-estimate]")).toHaveText("analyst estimate");
  await expect(card.locator("[data-map-exposure-value]")).toHaveText("$600.00* a month");
  await expect(card.locator("[data-map-exposure-units]")).toHaveText("SmartScout · 7 est. monthly units");
  await expect(card.locator("[data-map-exposure-coverage]")).toHaveText(
    "Covers 2 of 3 listings below MAP. 1 is awaiting inputs.",
  );

  // The formula, the source, and the awaiting-inputs breakdown sit in the tag's custom tooltip.
  const tag = card.locator("[data-map-exposure-estimate]");
  await expect(tag).toHaveAttribute("data-ifai-tooltip-desc", /price gap below MAP on Amazon times its SmartScout/);
  await expect(tag).toHaveAttribute("data-ifai-tooltip-desc", /1 is awaiting inputs and is not counted as \$0/);
  await expect(tag).not.toHaveAttribute("title", /.+/);
  // X-25: the partial total carries an asterisk whose tooltip names how many listings are left out.
  const partial = card.locator('[data-figure-tip="map-exposure-partial"]');
  await expect(partial).toHaveText("*");
  await expect(partial).toHaveAttribute("data-ifai-tooltip-desc", /^1 of 3 listings below MAP are awaiting inputs and not counted as \$0\./);

  // Violations stay N of M beside it, with the status mark and word.
  await expect(page.locator('[data-map-lead-ratio] [data-figure-tip="map-ratio"]')).toHaveText("3 of 5");
  await expect(page.locator("[data-map-lead] [data-status]")).toHaveText("Poor");

  // Never lost revenue, and no duration.
  const surface = page.locator(".drilldown-body .retail-surface");
  await expect(surface).not.toContainText(/lost revenue/i);
  await expect(surface).not.toContainText(/duration/i);
});

test("each listing shows units and value, and a listing without units is awaiting inputs", async ({ page }) => {
  await openMapLeakage(page);
  const table = page.locator("[data-map-listings] table");
  await expect(table.locator('th[data-col-id="units"]')).toContainText("Est. monthly units");
  await expect(table.locator('th[data-col-id="units"] [data-source]')).toHaveText("SmartScout");
  await expect(table.locator('th[data-col-id="exposure"]')).toContainText("Discounted retail value a month");
  await expect(table.locator('th[data-col-id="exposure"] [data-source]')).toHaveText("analyst estimate");
  await expect(table.locator("th")).not.toContainText(["Duration"]);

  // Largest estimate first, then the listing awaiting inputs.
  const rows = table.locator("tbody tr:has(.asin-chip)");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("B00MAP0001");
  await expect(rows.nth(0).locator("[data-map-units]")).toHaveText("5");
  const first = rows.nth(0).locator('[data-figure-tip="map-exposure-row"]');
  await expect(first).toHaveText("$500.00");
  await expect(first).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /\$100\.00 below MAP on Amazon × 5 estimated monthly units \(SmartScout\) = \$500\.00 a month/,
  );
  await expect(rows.nth(1)).toContainText("B00MAP0002");
  await expect(rows.nth(1).locator('[data-figure-tip="map-exposure-row"]')).toHaveText("$100.00");

  const awaiting = rows.nth(2);
  await expect(awaiting).toContainText("B00MAP0003");
  await expect(awaiting.locator("[data-map-units]")).toHaveText("");
  await expect(awaiting.locator('[data-map-exposure-cell="awaiting"]')).toHaveText("Awaiting inputs");
  await expect(awaiting.locator('[data-figure-tip="map-exposure-row"]')).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /SmartScout has no record of this listing/,
  );
  await expect(table.locator("[data-map-exposure-cell]")).not.toContainText(["$0.00"]);

  // X-33: every column sorts, the Status column included.
  await table.locator('th[data-col-id="setaside"] .ifai-sort-btn').click();
  await expect(table.locator('th[data-col-id="setaside"]')).toHaveAttribute("aria-sort", "ascending");
  await table.locator('th[data-col-id="exposure"] .ifai-sort-btn').click();
  await expect(rows.nth(0)).toContainText("B00MAP0002");
});

test("an approved exception leaves the discounted retail value", async ({ page }) => {
  await openMapLeakage(page);
  const card = page.locator("[data-map-exposure]");
  const table = page.locator("[data-map-listings] table");
  await table.locator('[data-set-aside-open="B00MAP0001"]').click();
  const form = table.locator("[data-set-aside-form]");
  await form.locator("[data-set-aside-reason]").selectOption("approved_exception");
  await form.locator("[data-set-aside-note]").fill("Holiday promo approved by brand");
  await form.locator("[data-set-aside-name]").fill("Test Person");
  await form.locator("[data-set-aside-save]").click();
  await expect(table.locator('[data-set-aside-chip="B00MAP0001"]')).toHaveText("Set aside · Approved exception");

  await expect(card.locator("[data-map-exposure-value]")).toHaveText("$100.00* a month");
  await expect(card.locator("[data-map-exposure-coverage]")).toHaveText(
    "Covers 1 of 2 listings below MAP. 1 is awaiting inputs.",
  );
  await expect(card.locator("[data-map-exposure-estimate]")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /1 listing set aside as an approved exception is left out of this count\./,
  );
});

test("a link copied before the rename still opens MAP Leakage", async ({ page }) => {
  await openMapLeakage(page, "map");
  await expect(page.locator("[data-map-lead]")).toBeVisible();
});
