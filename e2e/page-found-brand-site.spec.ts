import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

/**
 * Brand-Site Specs leads with fender.com page found (the AI Readiness bubble's figure)
 * and opens every checked SKU behind it. The mock has 2 of 4 found: one false row and
 * one null flag are not found, and neither stores a reason.
 */

async function openAiReadiness(page: Page, canvas: Canvas) {
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

test("Brand-Site Specs shows the page-found hero and opens its checked SKUs", async ({ page }) => {
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  await openAiReadiness(page, canvas);
  await expect(canvas.activeTab).toContainText("Brand-Site Specs");

  const hero = page.locator("[data-machine-hero='page_found']");
  await expect(hero.locator("[data-hero-percent]")).toHaveText("50.0%");
  await expect(hero.locator("[data-hero-ratio]")).toHaveText("2 of 4");
  await expect(hero.locator("[data-citation-pie-disc]")).toBeVisible();
  await expect(hero.locator("span.ifai-term").first()).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /older spec read.*Findability/,
  );
  await expect(hero).not.toContainText(/older spec read|Findability/);

  await hero.getByRole("button", { name: "fender.com page found" }).click();
  const table = page.locator("#brand-site-page-found-skus");
  await expect(table).toHaveAttribute("data-page-found-table", "ready");
  await expect(table).toHaveAttribute("data-page-found-found", "2");
  await expect(table).toHaveAttribute("data-page-found-not-found", "2");
  await expect(table).toHaveAttribute("data-page-found-checked", "4");
  await expect(table).toHaveAttribute("data-page-found-matches-hero", "true");
  await expect(table.locator("[data-page-found-row]")).toHaveCount(4);

  const found = table.locator("[data-page-found-row='found']");
  await expect(found).toHaveCount(2);
  for (const link of await found.locator("a[data-page-found-link]").all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\/www\.fender\.com\//);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  const notFound = table.locator("[data-page-found-row='not_found']");
  await expect(notFound.locator("[data-page-found-reason]")).toHaveText([
    "Reason not recorded",
    "Reason not recorded",
  ]);

  await table.locator("[data-page-found-filter='not_found']").click();
  await expect(table.locator("[data-page-found-row]")).toHaveCount(2);
  await expect(page.locator("#machine-readability-pages")).toHaveCount(0);
});
