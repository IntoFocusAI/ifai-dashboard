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
  await expect(tip).toHaveText("1 of 3 listings below MAP*");
  await expect(tip).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /^1 listing carried by Walmart has no price in this read, so it is missing from this count and is not counted as zero\./,
  );
  await tip.hover();
  await expect(page.locator(".node-tooltip-definition")).toContainText("carried by Walmart has no price");
  // Amazon carries all six mock listings; one has no price.
  await expect(page.locator('[data-map-channel="Amazon"] [data-figure-tip="map-channel"]')).toHaveText("3 of 6 listings below MAP*");

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("the same N of carried line reads for the second client", async ({ page }) => {
  const { errors } = await openCatalogHealthCanvas(page);
  await page.goto("/dashboard?client=ledlenser&spoke=ecommerce&tab=map");
  await expect(page.locator("[data-map-notes-channels]")).toBeVisible();
  await expect(page.locator('[data-map-channel="Walmart"] [data-figure-tip="map-channel"]')).toHaveText("1 of 3 listings below MAP*");
  await expect(page.locator('[data-map-channel="Amazon"] [data-figure-tip="map-channel"]')).toHaveText("3 of 6 listings below MAP*");
  await expect(page.locator('[data-map-channel="Musician\'s Friend"]')).toHaveCount(0);
  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});
