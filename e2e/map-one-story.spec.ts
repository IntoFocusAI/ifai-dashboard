import { expect, test } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 21.4 / FDD R-08: the MAP tab has one explainer path. MAP is defined once, the
   coverage caveat is in the N of M tooltip, and channel caveats sit behind an asterisk.
   Reads answer from e2e/catalog-health-mock.ts. */

test("the MAP tab defines MAP once and keeps caveats in tooltips", async ({ page }) => {
  const { errors } = await openCatalogHealthCanvas(page);
  await page.goto("/dashboard?spoke=ecommerce&tab=map");
  await expect(page.locator(".drilldown-tab-btn.active")).toContainText("MAP");
  const surface = page.locator(".drilldown-body .retail-surface");
  await expect(page.locator("[data-map-lead-ratio]")).toBeVisible();
  await expect(page.locator("[data-map-notes-channels]")).toBeVisible();

  await expect(surface.locator('.ifai-term[data-ifai-tooltip-title="MAP"]')).toHaveCount(1);
  await expect(page.locator('[data-map-lead-label] .ifai-term[data-ifai-tooltip-title="MAP"]')).toHaveCount(1);

  const ratioTip = page.locator('[data-map-lead-ratio] [data-figure-tip="map-ratio"]');
  await expect(ratioTip).toHaveText("3 of 5");
  await expect(ratioTip).toHaveAttribute("data-ifai-tooltip-desc", /listings with a stored MAP price/);
  await expect(ratioTip).not.toHaveAttribute("title", /.+/);

  // No caveat prose on screen; a partial channel count carries an asterisk and a tooltip.
  await expect(surface).not.toContainText("are missing from this count");
  await expect(surface).not.toContainText("not counted as zero");
  const tip = page.locator('[data-map-channel="Walmart"] [data-figure-tip="map-channel"]');
  await expect(tip).toHaveText(/below MAP\*$/);
  await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /no stored Walmart price/);
  await tip.hover();
  await expect(page.locator(".node-tooltip-definition")).toContainText("no stored Walmart price");

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});
