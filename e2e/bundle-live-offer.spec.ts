import { expect, test } from "@playwright/test";
import { CATALOG_ROWS, openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 21.4 / FDD R-13: the splintered-bundles figure counts only bundles with a live
   offer. The mock has five bundles: three with a live offer (two unnested), one with no
   active offer, one with no offer reading. Reads answer from e2e/catalog-health-mock.ts. */

const RATIO = "2 of 3 bundles with a live offer";

test("Catalog Governance shows the live-offer bundle set with the rule in its tooltip", async ({ page }) => {
  const { errors } = await openCatalogHealthCanvas(page);
  await page.goto("/dashboard?spoke=ecommerce&tab=catalog-governance");
  await expect(page.locator(".drilldown-tab-btn.active")).toContainText("Catalog Governance");

  const lead = page.locator("[data-catalog-governance-lead]");
  await expect(lead.locator(".ai-lead-figure")).toHaveText("66.7%");
  const tip = lead.locator('[data-figure-tip="bundle-population"]');
  await expect(tip).toHaveText(RATIO);
  await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /offer for sale on it, with or without the Buy Box/);
  await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /5 monitored listings are flagged as bundles/);
  await expect(tip).not.toHaveAttribute("title", /.+/);
  await tip.hover();
  await expect(page.locator(".node-tooltip-definition")).toContainText("with or without the Buy Box");

  const table = page.locator("#catalog-governance-splintered-table");
  await expect(table).toContainText("B00BUN0001");
  await expect(table).toContainText("B00BUN0002");
  await expect(table).not.toContainText("B00BUN0003");
  await expect(table).not.toContainText("B00BUN0004");
  await expect(table).not.toContainText("B00BUN0005");

  await page.goto("/dashboard?spoke=ecommerce&tab=retail-overview");
  await expect(page.locator('[data-retail-overview-hero="unnested_bundles"] [data-retail-hero-ratio]')).toHaveText(RATIO);

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("Splintered Listings carries the stale asterisk when a live bundle's catalog check is older than 2 days (X-25)", async ({ page }) => {
  const { errors } = await openCatalogHealthCanvas(page);
  const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const rows = CATALOG_ROWS.map((row) => (row.asin === "B00BUN0002" ? { ...row, catalog_checked_at: old } : row));
  await page.route("**/rest/v1/canvas_retail_listings?*", async (route) => {
    const select = new URL(route.request().url()).searchParams.get("select") ?? "";
    if (!select.includes("catalog_checked_at")) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": `0-${rows.length - 1}/${rows.length}`,
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
      },
      body: JSON.stringify(rows),
    });
  });
  await page.goto("/dashboard?spoke=ecommerce&tab=catalog-governance");
  const mark = page.locator('[data-catalog-governance-lead] [data-figure-tip="bundle-hero-stale"]');
  await expect(mark).toHaveText("*");
  await expect(mark).toHaveAttribute("data-ifai-tooltip-desc", /1 of 3 listings has no catalog check in 2 days\./);
  await expect(mark).toHaveAttribute("data-ifai-tooltip-desc", /Last check: /);

  await page.goto("/dashboard?spoke=ecommerce&tab=retail-overview");
  await expect(page.locator('[data-retail-overview-hero="unnested_bundles"] .partial-figure-mark')).toHaveText("*");
  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});
