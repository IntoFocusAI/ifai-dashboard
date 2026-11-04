import { expect, test } from "./fixtures";

/* Worker 21.4 / FDD R-08: the MAP tab has one explainer path. MAP is defined once, the
   coverage caveat is in the N of M tooltip, and channel caveats sit behind an asterisk. */

test("the MAP tab defines MAP once and keeps caveats in tooltips", async ({ canvas, page }) => {
  await canvas.openSpokeFromMap("Catalog Health");
  await canvas.openTab("MAP");
  const surface = page.locator(".drilldown-body .retail-surface");
  await expect(page.locator("[data-map-lead-ratio]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-map-notes-channels], [data-map-notes-not-stored]")).toBeVisible();

  await expect(surface.locator('.ifai-term[data-ifai-tooltip-title="MAP"]')).toHaveCount(1);
  await expect(page.locator('[data-map-lead-label] .ifai-term[data-ifai-tooltip-title="MAP"]')).toHaveCount(1);

  const ratioTip = page.locator('[data-map-lead-ratio] [data-figure-tip="map-ratio"]');
  await expect(ratioTip).toHaveAttribute("data-ifai-tooltip-desc", /listings with a stored MAP price/);
  await expect(ratioTip).not.toHaveAttribute("title", /.+/);

  // No caveat prose on screen; a partial channel count carries an asterisk and a tooltip.
  await expect(surface).not.toContainText("are missing from this count");
  await expect(surface).not.toContainText("not counted as zero");
  const walmart = page.locator('[data-map-channel="Walmart"]');
  if (await walmart.count()) {
    const tip = walmart.locator('[data-figure-tip="map-channel"]');
    await expect(tip).toHaveText(/below MAP\*$/);
    await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /no stored Walmart price/);

    await tip.hover();
    await expect(page.locator(".node-tooltip-definition")).toContainText("no stored Walmart price");
  }
});
