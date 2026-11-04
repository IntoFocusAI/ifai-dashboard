import { expect, test } from "@playwright/test";
import { openCatalogHealthCanvas } from "./catalog-health-mock";

/* Worker 21.4 / FDD X-03: the Catalog Governance notes do not say what the spec figure
   leaves out. The unchecked-listings caveat sits in the figure's tooltip. The mock has
   three checked spec readings (one missing a field) and one unchecked. */

test("the spec coverage caveat is in the figure tooltip, not on screen", async ({ page }) => {
  const { errors } = await openCatalogHealthCanvas(page);
  await page.goto("/dashboard?spoke=ecommerce&tab=catalog-governance");
  await expect(page.locator(".drilldown-tab-btn.active")).toContainText("Catalog Governance");

  const hero = page.locator("[data-catalog-spec-hero]");
  const tip = hero.locator('[data-figure-tip="spec-coverage"]');
  await expect(tip).toHaveText("2 of 3");
  await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /1 listing was not checked\. Unchecked listings are missing from this count/);
  await expect(tip).not.toHaveAttribute("title", /.+/);
  await tip.hover();
  await expect(page.locator(".node-tooltip-definition")).toContainText("not counted as zero");

  const surface = page.locator(".drilldown-body");
  await expect(page.locator("[data-catalog-governance-notes] .retail-missing")).toHaveCount(0);
  await expect(surface).not.toContainText("Unchecked listings are missing from this count");
  await expect(surface).not.toContainText("not counted as zero");

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});
