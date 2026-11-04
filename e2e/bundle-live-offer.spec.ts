import { expect, test } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

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
  await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /5 listings in the retail read are flagged as bundles/);
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
