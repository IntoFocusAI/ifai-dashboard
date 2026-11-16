import { expect, test } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

/**
 * Proves the three spec surfaces with a mocked canvas API.
 * Amazon Specs shows the ASIN table without a fender.com found column.
 * Brand-Site Specs counts fender.com pages, lists the page with no spec block, and not the full ASIN table.
 * Catalog Governance shows the unnested-bundle table, hides the spec-field table,
 * and its Specs complete count opens Amazon Specs.
 */

test("spec tables live on one surface each", async ({ page }) => {
  const seen = await mockCanvasRead(page);

  const canvas = new Canvas(page);
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(canvas.activeTab).toContainText("Brand-Site Specs");
  await canvas.openTab("Amazon Specs");

  const catalog = page.locator("#spec-readiness-by-asin");
  await expect(catalog).toBeVisible();
  await expect(catalog).toContainText("B00MISSING");
  await expect(catalog).toContainText("B00FOUND01");
  await expect(catalog).toContainText("B00NULLFLG");
  await expect(catalog.getByRole("columnheader", { name: "fender.com found" })).toHaveCount(0);
  await expect(catalog.getByText("No", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Top missing Amazon fields")).toBeVisible();
  await expect(page.locator("[data-spec-filter]")).toHaveCount(0);
  await expect(page.locator("[data-ai-readiness-hero]")).toHaveCount(1);
  await expect(page.locator("[data-ai-readiness-hero='amazon_completeness']")).toBeVisible();

  await canvas.openTab("Brand-Site Specs");
  const missingHero = page.locator("[data-machine-hero='missing_specs']");
  await expect(missingHero.locator("[data-hero-percent]")).toHaveText(/^50\.0%\*?$/);
  await expect(missingHero).toContainText("1 of 2");
  await expect(
    page.locator("[data-machine-hero='product_basics'] [data-hero-percent]"),
  ).toHaveText("100.0%");
  const pages = page.locator("#machine-readability-pages");
  await expect(pages).toBeVisible();
  await expect(pages.locator("[data-machine-page-count]")).toHaveAttribute("data-machine-page-count", "1");
  await expect(pages).toContainText("fender.com/en-US/found");
  await expect(pages).toContainText("B00FOUND01");
  await expect(pages).toContainText("Spec block");
  await expect(pages).not.toContainText("fender.com/en-US/clear");
  await expect(pages).not.toContainText("B00MISSING");
  await expect(page.locator("#spec-readiness-by-asin")).toHaveCount(0);
  await expect(page.getByText("Top missing Amazon fields")).toHaveCount(0);
  await expect(page.getByText("Top missing schema fields")).toHaveCount(0);
  await expect(page.locator("[data-ai-readiness-hero='amazon_completeness']")).toHaveCount(0);

  await canvas.openSpokeFromMap("Catalog Health");
  await canvas.openTab("Catalog Governance");
  await expect(page.locator("[data-catalog-governance-lead]")).toBeVisible();
  await expect(page.locator("[data-catalog-governance-notes]")).toBeVisible();
  await expect(page.getByText("Twin Amp Bundle")).toBeVisible();
  await expect(page.getByText("Missing Amazon spec fields")).toHaveCount(0);
  await expect(page.locator("#catalog-specs")).toHaveCount(0);

  const specsComplete = page.locator("[data-spec-open='amazon-specs']");
  await expect(specsComplete).toBeVisible();
  await expect(specsComplete).toContainText("Specs complete");
  await specsComplete.click();
  await expect(canvas.activeTab).toContainText("Amazon Specs");
  await expect(page.locator("#spec-readiness-by-asin")).toBeVisible();
  await expect(page.locator("#spec-readiness-by-asin")).toContainText("B00MISSING");

  expect(seen.some((entry) => entry.includes("canvas_spec_readiness"))).toBe(true);
});
