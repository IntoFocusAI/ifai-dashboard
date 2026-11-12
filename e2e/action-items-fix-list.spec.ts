import { expect, test, type Page } from "@playwright/test";
import { LIVE_READ_TIMEOUT, openSpokeTab } from "./figure-first-page";

let pageErrors: string[] = [];

const STATUS_RANK: Record<string, number> = { Critical: 0, "At risk": 1, "On track": 2, "No reading": 3 };

async function openUrgentInterventions(page: Page, baseURL: string | undefined) {
  pageErrors = await openSpokeTab(page, baseURL, "suggestions", "urgent-interventions");
  const findings = page.locator('.drilldown-panel [data-fix-list] [data-fix-kind="finding"]');
  await expect(findings).toHaveCount(5);
  await expect(findings.first().locator("[data-fix-ratio]")).toBeVisible({ timeout: LIVE_READ_TIMEOUT });
  return findings;
}

test.describe("Action Items opens on the prioritized fix list", () => {
  test.describe.configure({ timeout: 120_000 });
  test.afterEach(() => {
    expect(pageErrors, `unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });

  test("Urgent Interventions leads with a full-width ranked list and no hero card", async ({ page, baseURL }) => {
    const rows = await openUrgentInterventions(page, baseURL);
    const panel = page.locator(".drilldown-panel");
    await expect(panel.locator("[data-action-items-lead], [data-citation-pie-disc]")).toHaveCount(0);

    const list = panel.locator("[data-fix-list]");
    await expect
      .poll(async () => {
        const [listBox, bodyBox] = await Promise.all([
          list.boundingBox(),
          panel.locator(".drilldown-body").boundingBox(),
        ]);
        return listBox && bodyBox ? listBox.width / bodyBox.width : 0;
      })
      .toBeGreaterThan(0.9);
    const listTop = (await list.boundingBox())!.y;
    await expect(rows.first()).toBeInViewport();
    expect(listTop).toBeLessThan(page.viewportSize()!.height / 2);

    await expect(rows.locator("[data-fix-rank]")).toHaveText(["1", "2", "3", "4", "5"]);
    const statuses = await rows.locator("[data-fix-status-label]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-fix-status-word") ?? ""),
    );
    const ranks = statuses.map((status) => STATUS_RANK[status.trim()]);
    expect(ranks.every((rank) => rank != null), statuses.join(", ")).toBe(true);
    expect([...ranks].sort((a, b) => a! - b!)).toEqual(ranks);

    // The AI finding reads the map's population, which can arrive after the retail rows.
    await expect(rows.locator("[data-fix-percent]", { hasText: "Loading" })).toHaveCount(0, { timeout: LIVE_READ_TIMEOUT });
    for (const row of await rows.all()) {
      await expect(row.locator("[data-fix-action]")).not.toBeEmpty();
      const percent = row.locator("[data-fix-percent]");
      const ratio = row.locator("[data-fix-ratio]");
      if ((await ratio.count()) > 0) {
        await expect(percent).toHaveText(/^\d+\.\d%$/);
        await expect(ratio).toHaveText(/^[\d,]+ of [\d,]+\b/);
      } else {
        await expect(percent).toHaveText("Not available*");
      }
      await expect(row.locator("[data-fix-open]")).toHaveText(/^Open .+ →$/);
    }
  });

  test("the list sits on the shared table, and the actions after the findings state a fact then an action", async ({ page, baseURL }) => {
    await openUrgentInterventions(page, baseURL);
    const list = page.locator(".drilldown-panel [data-fix-list]");
    await expect(list.locator('[data-table-toolbar="action-items-fixes"]')).toBeVisible();
    await expect(list.locator("th .ifai-sort-btn")).toHaveCount(6);
    await expect(list).toHaveAttribute("data-fix-sources", "ready", { timeout: 90_000 });
    const extra = list.locator('[data-fix-row]:not([data-fix-kind="finding"])');
    for (const row of await extra.all()) {
      await expect(row.locator("[data-plan-fact]")).not.toBeEmpty();
      await expect(row.locator("[data-fix-action]")).not.toBeEmpty();
      await expect(row.locator("[data-fix-open]")).toHaveText(/^Open .+ →$/);
    }
    const weights = await list.evaluate((root) =>
      [...root.querySelectorAll("*")].map((node) => Number(getComputedStyle(node).fontWeight)),
    );
    expect(Math.max(...weights)).toBeLessThanOrEqual(600);
    const sizes = await list.evaluate((root) =>
      [...root.querySelectorAll("*")]
        .filter((node) => (node.textContent ?? "").trim() && node.getClientRects().length)
        .map((node) => parseFloat(getComputedStyle(node).fontSize)),
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });

  test("the priority rule is in the custom tooltip on the list title", async ({ page, baseURL }) => {
    await openUrgentInterventions(page, baseURL);
    const term = page.locator(".drilldown-panel [data-fix-list] .content-box-title .ifai-term");
    await expect(term).toHaveText("Fixes in priority order");
    await expect(term).not.toHaveAttribute("title");
    await term.hover();
    await expect(page.locator(".node-tooltip-definition")).toContainText("Critical findings come first");
  });

  test("an old Current findings link lands on Urgent Interventions", async ({ page, baseURL }) => {
    pageErrors = await openSpokeTab(page, baseURL, "suggestions", "current-findings");
    await expect(page.locator(".drilldown-tab-btn")).toHaveText(["Urgent Interventions", "Revenue Estimates"]);
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText("Urgent Interventions");
    await expect(page.locator(".drilldown-panel [data-fix-list]")).toBeVisible();
  });

  test("each row opens the evidence tab behind its finding", async ({ page, baseURL }) => {
    const rows = await openUrgentInterventions(page, baseURL);
    const id = await rows.first().getAttribute("data-fix-row");
    // A late live read can re-rank the list, so click the row that was read rather than row 1.
    const open = page.locator(`[data-fix-row="${id}"] [data-fix-open]`);
    const tab = await open.getAttribute("data-ifai-tab");
    await open.click();
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText(tab!);
  });
});
