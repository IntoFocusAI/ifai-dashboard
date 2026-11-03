import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

/**
 * Brand-Site Specs leads with fender.com page found (the AI Readiness bubble's figure)
 * and opens every checked SKU behind it. The mock has 2 of 4 found: one false row and
 * one null flag are not found, and neither stores a reason. Findability has a row for
 * the false one only.
 */

const FINDABILITY = [
  { asin: "B00MISSING", title: "Missing Page Guitar", latest_state: "completed_not_found", counts_as_completed_not_found: true },
  { asin: "B00FOUND01", title: "Found Strat", latest_state: "official_family_page", counts_as_confirmed: true },
];

async function openAiReadiness(page: Page, canvas: Canvas) {
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

test("Brand-Site Specs shows the page-found hero and opens its checked SKUs", async ({ page }) => {
  await mockCanvasRead(page, { findability: FINDABILITY });
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
  await expect(notFound).toHaveCount(2);
  const noPage = table.locator("[data-page-found-row='not_found'][data-asin='B00MISSING']");
  await expect(noPage.locator("[data-page-found-reason]")).toHaveAttribute("data-page-found-reason", "No Defensible Page");
  await expect(noPage.locator("[data-page-found-findability='completed_not_found']")).toHaveText(
    /^Findability:\s*No Defensible Page$/,
  );
  const term = noPage.locator("[data-page-found-findability] span.ifai-term");
  await expect(term).toHaveAttribute("data-ifai-tooltip-title", "No Defensible Page");
  await expect(term).toHaveAttribute("data-ifai-tooltip-desc", /finished looking and did not accept a page/);
  await expect(term).not.toHaveAttribute("title");
  const noRow = table.locator("[data-page-found-row='not_found'][data-asin='B00NULLFLG']");
  await expect(noRow.locator("[data-page-found-reason]")).toHaveText("Reason not recorded");

  const header = table.locator("th span.ifai-term", { hasText: "fender.com page or reason" });
  await expect(header).toHaveAttribute("data-ifai-tooltip-desc", /separate official-page check/);
  await expect(table.locator("tbody")).not.toContainText("separate official-page check");

  await table.locator("[data-page-found-filter='not_found']").click();
  await expect(table.locator("[data-page-found-row]")).toHaveCount(2);
  const reasons = table.locator("[data-page-found-reason-filter]");
  await expect(reasons).toHaveText(["All reasons 2", "No Defensible Page 1", "Reason not recorded 1"]);
  await table.locator("[data-page-found-reason-filter='No Defensible Page']").click();
  await expect(table.locator("[data-page-found-row]")).toHaveCount(1);
  await expect(table.locator("[data-page-found-row]")).toHaveAttribute("data-asin", "B00MISSING");
  await table.locator("[data-page-found-reason-filter='all']").click();
  await expect(table.locator("[data-page-found-row]")).toHaveCount(2);
  await expect(table).toHaveAttribute("data-page-found-not-found", "2");
  await expect(hero.locator("[data-hero-ratio]")).toHaveText("2 of 4");
  await expect(page.locator("#machine-readability-pages")).toHaveCount(0);
});

test("the AI Readiness bubble's page-found figure opens Brand-Site Specs at that hero", async ({ page }) => {
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  await canvas.open();
  const bubble = page.locator("[data-graph-node-id='spoke-specs']");
  await expect(bubble).toContainText("fender.com page found");
  await expect(bubble).toContainText("50.0%");

  await openAiReadiness(page, canvas);
  await expect(canvas.activeTab).toContainText("Brand-Site Specs");
  const hero = page.locator("#brand-site-page-found[data-machine-hero='page_found']");
  await expect(hero).toBeInViewport();
  await expect(hero.locator("[data-hero-percent]")).toHaveText("50.0%");

  // Already on Brand-Site Specs and scrolled away: the bubble still lands on the hero.
  await hero.getByRole("button", { name: "fender.com page found" }).click();
  await page.locator("#brand-site-page-found-skus").scrollIntoViewIfNeeded();
  await page.locator(".drilldown-body").evaluate((body) => {
    body.scrollTop = body.scrollHeight;
  });
  await expect(hero).not.toBeInViewport({ ratio: 0.5 });
  await page.locator("[data-graph-node-id='spoke-specs']").click({ force: true });
  await expect(canvas.activeTab).toContainText("Brand-Site Specs");
  await expect(hero).toBeInViewport({ ratio: 1 });
});
