import type { Page } from "@playwright/test";
import { Canvas, expect, test as base } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";
import { EARLIER_RUN, SEARCH_RUN, enableApiViews, mockAiSearchWithApi } from "./api-engines-mock";

/**
 * FDD A-02 follow-up: the Engines switch on Run Summary, the trend, Citation Ecosystem, and a
 * single run. Every AI read is mocked (see api-engines-mock.ts): published search runs on Oct 20
 * and Nov 3 with the same answers, and one API run on Nov 2, nearest the Nov 3 run.
 */

const test = base.extend<{ canvas: Canvas; pageErrors: string[] }>({
  canvas: async ({ page, pageErrors, setAsides }, provide) => {
    void pageErrors;
    void setAsides;
    await page.context().addCookies([{ name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" }]);
    await mockCanvasRead(page);
    await provide(new Canvas(page));
  },
  pageErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()} ${message.location().url}`);
    });
    await provide(errors);
    expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
  },
});

const choice = (page: Page, value: "all" | "search" | "api") => page.locator(`[data-ai-engine-choice='${value}']`);

async function choose(page: Page, value: "all" | "search" | "api") {
  await choice(page, value).click();
  await expect(choice(page, value)).toHaveAttribute("aria-pressed", "true");
}

test.beforeEach(async ({ canvas, page }) => {
  await enableApiViews(page);
  await mockAiSearchWithApi(page, { earlierRun: true });
  await canvas.open();
  await canvas.openSpokeFromMap("AI Search Visibility");
});

test("Run Summary and its trend follow the switch; the Nov 3 point carries the Nov 2 API run", async ({ page }) => {
  const lead = page.locator("[data-ai-win-rate='unbranded_discovery']");
  const rows = page.locator("[data-ai-trend-row$=':overall']");
  await expect(page.locator("[data-ai-engine-switch='ready']")).toBeVisible();
  await expect(choice(page, "all")).toHaveAttribute("aria-pressed", "true");

  // All: 6 of 8 search leads over two runs, plus 2 of 4 from the API engines.
  await expect(lead).toHaveText("66.7%");
  await expect(rows).toHaveCount(2);
  await expect(page.locator(`[data-ai-trend-row='${EARLIER_RUN}:overall']`)).toContainText("75.0% (3 of 4 resolved)");
  await expect(page.locator(`[data-ai-trend-row='${EARLIER_RUN}:overall']`)).not.toContainText("API run");
  const nov3 = page.locator(`[data-ai-trend-row='${SEARCH_RUN}:overall']`);
  await expect(nov3).toContainText("62.5% (5 of 8 resolved)");
  await expect(nov3).toContainText("API run Nov 2, 2026");
  await expect(nov3).not.toContainText("Partial coverage");

  await choose(page, "search");
  await expect(lead).toHaveText("75.0%");
  await expect(rows).toHaveCount(2);
  await expect(nov3).toContainText("75.0% (3 of 4 resolved)");
  await expect(nov3).not.toContainText("API run");

  await choose(page, "api");
  await expect(lead).toHaveText("50.0%");
  await expect(page.locator("[data-ai-history-state='one-run']")).toBeVisible();
  await expect(rows).toHaveCount(0);
});

test("Citation Ecosystem counts the API engines' cited links on All and API only", async ({ canvas, page }) => {
  await canvas.openTab("Citation Ecosystem");
  const links = page.locator("[data-ai-cited-links]").first();
  await expect(page.locator("[data-ai-engine-switch='ready']")).toBeVisible();
  await expect(links).toContainText("12");
  await choose(page, "search");
  await expect(links).toContainText("8");
  await choose(page, "api");
  await expect(links).toContainText("4");
});

test("a single run offers the API run nearest its day, labeled with its date", async ({ page }) => {
  await page.locator("[data-ai-history-trigger]").click();
  await page.locator("[data-ai-history-dialog]").getByRole("button", { name: "Previous month" }).click();
  await page.locator("[data-ai-history-day='2026-10-20']").click();
  const detail = page.locator(`[data-ai-history-run='${EARLIER_RUN}'] [data-ai-history-api-run='ready']`);
  await expect(detail).toContainText("API run beside it: Nov 2, 2026 (13 days after)");
  await expect(detail).toContainText("Crescent API");
  await expect(detail.locator(".ifai-term")).toHaveAttribute("data-ifai-tooltip-desc", /nearest its day/);
  await expect(detail.locator("[title]")).toHaveCount(0);
  await page.locator("[data-ai-history-view-run]").click();
  await expect(page.locator("[data-ai-history-trigger]")).toContainText("Historical run");

  const paired = page.locator("[data-ai-engine-paired='2026-11-02']");
  await expect(paired).toContainText("API run · Nov 2, 2026");
  await expect(paired.locator(".ifai-term")).toHaveAttribute("data-ifai-tooltip-desc", /nearest its day/);
  const lead = page.locator("[data-ai-win-rate='unbranded_discovery']");
  // The Oct 20 run alone: 3 of 4; with the Nov 2 API run: 5 of 8; the API run alone: 2 of 4.
  await expect(lead).toHaveText("62.5%");
  await choose(page, "search");
  await expect(lead).toHaveText("75.0%");
  await choose(page, "api");
  await expect(lead).toHaveText("50.0%");
});
