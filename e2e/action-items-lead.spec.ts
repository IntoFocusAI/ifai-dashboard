import { expect, test, type Locator, type Page } from "@playwright/test";
import { LIVE_READ_TIMEOUT, openSpokeTab } from "./figure-first-page";

let pageErrors: string[] = [];

async function openActionItems(page: Page, baseURL: string | undefined, tab: string) {
  pageErrors = await openSpokeTab(page, baseURL, "suggestions", tab);
}

async function top(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return box.y;
}

/** Polls because the panel widens as it opens, and text wraps taller until it settles. */
async function expectInFirstScreen(page: Page, locator: Locator) {
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(viewport!.height);
}

test.describe("Action Items lead with the figure (X-03, X-04)", () => {
  test.describe.configure({ timeout: 120_000 });
  test.afterEach(() => {
    expect(pageErrors, `unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });

  test("Urgent Interventions opens on critical findings N of M and a disc before any action copy", async ({
    page,
    baseURL,
  }) => {
    await openActionItems(page, baseURL, "urgent-interventions");
    const lead = page.locator(".drilldown-panel [data-action-items-lead='critical_findings']");
    await expect(lead.locator("[data-hero-ratio]")).toHaveText(/^\d+ of \d+\*?$/, { timeout: LIVE_READ_TIMEOUT });
    await expect(lead.locator("[data-hero-percent]")).toHaveText(/^\d+\.\d%$/);
    const disc = lead.locator("[data-citation-pie-disc='action-items-critical']");
    await expect(disc).toBeVisible();
    await expectInFirstScreen(page, disc);

    const cards = page.locator(".drilldown-panel [data-urgent-finding]");
    await expect(cards).toHaveCount(5);
    expect(await top(disc)).toBeLessThan(await top(cards.first().locator("[data-urgent-finding-action]")));
    for (const card of await cards.all()) {
      const figure = card.locator("[data-urgent-finding-percent]");
      await expect(figure).toBeVisible();
      expect(await top(figure)).toBeLessThan(await top(card.locator("[data-urgent-finding-action]")));
    }
  });

  test("Current findings opens on the same lead, and it matches the five cards", async ({ page, baseURL }) => {
    await openActionItems(page, baseURL, "current-findings");
    const lead = page.locator(".drilldown-panel [data-action-items-lead='critical_findings']");
    await expect(lead.locator("[data-hero-ratio]")).toHaveText(/^\d+ of \d+\*?$/, { timeout: LIVE_READ_TIMEOUT });
    await expectInFirstScreen(page, lead.locator("[data-citation-pie-disc]"));

    const cards = page.locator(".drilldown-panel [data-current-findings] [data-briefing-finding]");
    await expect(cards).toHaveCount(5);
    expect(await top(lead)).toBeLessThan(await top(cards.first()));

    const stored = cards.filter({ has: page.locator("[data-briefing-finding-ratio]") });
    await expect
      .poll(async () => {
        const storedCount = await stored.count();
        const critical = await stored.locator("[data-briefing-finding-tone='danger']").count();
        const expected = `${critical} of ${storedCount}${storedCount < 5 ? "*" : ""}`;
        return (await lead.locator("[data-hero-ratio]").textContent()) === expected;
      })
      .toBe(true);
  });

  test("the lead label explains itself in the custom tooltip, not a native title", async ({ page, baseURL }) => {
    await openActionItems(page, baseURL, "urgent-interventions");
    const term = page.locator(".drilldown-panel [data-action-items-lead] .ifai-term").first();
    await expect(term).toHaveText("Critical findings");
    await expect(term).not.toHaveAttribute("title");
    await term.hover();
    await expect(page.locator(".node-tooltip-definition")).toContainText("red band");
  });
});
