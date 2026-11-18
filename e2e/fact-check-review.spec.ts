import { expect, test, type Page } from "@playwright/test";
import { LIVE_READ_TIMEOUT } from "./figure-first-page";

/*
 * Worker 29.28 (Brian Magazu, 18 Nov 2026): a fact-check contradiction is raised outside Product
 * Fact Checks only as a review task, at normal priority, in Priorities, Action Items and the
 * Roadmap; each flagged answer links to its quote and its source fact. One template for every client.
 */

const CLIENTS = [
  { key: "fender", query: "" },
  { key: "ledlenser", query: "client=ledlenser&" },
];

function reviewTitle(count: number) {
  return count === 1
    ? "Review 1 AI answer that may contradict your product facts."
    : `Review ${count} AI answers that may contradict your product facts.`;
}

async function open(page: Page, baseURL: string | undefined, query: string, spoke: string, tab: string) {
  const host = new URL(baseURL ?? "http://localhost").hostname;
  await page.context().addCookies([{ name: "ifai_guest_fender", value: "1", domain: host, path: "/" }]);
  await page.goto(`/dashboard?${query}spoke=${spoke}&tab=${tab}`);
  const skipLogin = page.getByRole("button", { name: "Skip Login" });
  if (await skipLogin.isVisible().catch(() => false)) await skipLogin.click();
  await expect(page.locator(".drilldown-panel")).toBeVisible({ timeout: LIVE_READ_TIMEOUT });
}

/** Contradiction verdicts on Product Fact Checks, the tab the review task points to. */
async function flaggedOnTab(page: Page, baseURL: string | undefined, query: string) {
  await open(page, baseURL, query, "aeo", "product-fact-checks");
  const table = page.locator('.drilldown-panel [data-probe-state]');
  await expect(table.first()).toBeVisible({ timeout: LIVE_READ_TIMEOUT });
  // The tab lists every contradiction verdict as a card above the (paged) table.
  return page.locator(".drilldown-panel .action-card.critical", { hasText: "Contradiction found" }).count();
}

test.describe("fact-check contradictions are a review task", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const client of CLIENTS) {
    test(`${client.key}: Action Items, Roadmap and Priorities carry one review item with each answer's quote and fact`, async ({ page, baseURL }) => {
      const flagged = await flaggedOnTab(page, baseURL, client.query);
      test.info().annotations.push({ type: "flagged", description: String(flagged) });

      await open(page, baseURL, client.query, "suggestions", "urgent-interventions");
      const list = page.locator(".drilldown-panel [data-fix-list]");
      await expect(list.locator('[data-fix-kind="finding"]').first()).toBeVisible({ timeout: LIVE_READ_TIMEOUT });
      const row = list.locator('[data-fix-row="signal:fact_contradictions"]');
      if (flagged === 0) {
        await page.waitForTimeout(3_000);
        await expect(row).toHaveCount(0);
      } else {
        await expect(row).toHaveCount(1, { timeout: LIVE_READ_TIMEOUT });
        await expect(row.locator(".plan-cell-label")).toHaveText(reviewTitle(flagged));
        await expect(row.locator("[data-fix-status-label]")).toHaveAttribute("data-fix-status-word", "Recommended");
        const answers = row.locator("[data-plan-review]");
        await expect(answers).toHaveCount(flagged);
        await expect(answers.first().locator("[data-plan-review-quote]")).toHaveAttribute("data-ifai-evidence", /^sim:/);
        await expect(answers.first().locator("[data-plan-review-fact] a")).toHaveAttribute("href", /^https?:\/\//);
        // Normal priority: it never outranks a Critical finding.
        const words = await list.locator("[data-fix-row]").evaluateAll((rows) =>
          rows.map((r) => [r.getAttribute("data-fix-row"), r.querySelector("[data-fix-status-word]")?.getAttribute("data-fix-status-word")]),
        );
        const at = words.findIndex(([id]) => id === "signal:fact_contradictions");
        test.info().annotations.push({ type: "action-items", description: `row ${at + 1} of ${words.length}` });
        expect(words.slice(at + 1).some(([, word]) => word === "Critical"), JSON.stringify(words)).toBe(false);
      }

      await open(page, baseURL, client.query, "roadmap", "30-60-90-days");
      const plan = page.locator(".drilldown-panel [data-roadmap-plan]");
      await expect(plan.locator("[data-roadmap-phase]")).toHaveCount(3, { timeout: LIVE_READ_TIMEOUT });
      const item = plan.locator('[data-roadmap-item="signal:fact_contradictions"]');
      if (flagged === 0) {
        await expect(item).toHaveCount(0);
      } else {
        await expect(item).toHaveCount(1, { timeout: LIVE_READ_TIMEOUT });
        await expect(item.locator("[data-roadmap-item-label]")).toContainText(reviewTitle(flagged));
        await expect(plan.locator("[data-roadmap-phase]").nth(1).locator('[data-roadmap-item="signal:fact_contradictions"]')).toHaveCount(1);
        await expect(item.locator("[data-plan-review]")).toHaveCount(flagged);
      }

      await page.locator(".hdr-btn", { hasText: "Priorities" }).click();
      await expect(page.locator(".command-center")).toBeVisible();
      const priorities = page.locator(".cc-item");
      const review = priorities.filter({ hasText: "may contradict your product facts" });
      if (flagged === 0) {
        await expect(review).toHaveCount(0);
      } else {
        await expect(review).toHaveCount(1, { timeout: LIVE_READ_TIMEOUT });
        await expect(review).toContainText(reviewTitle(flagged));
        const titles = await priorities.allTextContents();
        const at = titles.findIndex((text) => text.includes("may contradict your product facts"));
        // After the Critical retail headline; never first.
        expect(at, titles.join(" | ")).toBeGreaterThan(0);
        test.info().annotations.push({ type: "priorities", description: `${at + 1} of ${titles.length}: ${titles.map((t) => t.slice(0, 50)).join(" | ")}` });
      }
      await expect(page.locator("body")).not.toContainText(/AI answers contradict a verified/);
    });
  }
});
