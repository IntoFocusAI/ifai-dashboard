import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/* Worker 25.3, Competitive Radar final form, on the live read for both clients: the map's
   "Taylor leads Acoustics" wording inside the tab (X-18), Download CSV on every Radar table for
   the date pill's selection (X-10, X-33), and no guitar words for a lighting brand. */

const CLIENTS = ["fender", "ledlenser"] as const;
type Client = (typeof CLIENTS)[number];

const url = (client: Client, query: string) => `/dashboard?${client === "fender" ? "" : `client=${client}&`}${query}`;

async function guest(page: Page) {
  await page.context().addCookies([
    { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
    { name: "ifai_guest_ledlenser", value: "1", domain: "localhost", path: "/" },
  ]);
}

async function downloadLines(page: Page, tableId: string): Promise<string[]> {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 120_000 }),
    page.locator(`[data-table-download="${tableId}"]`).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${tableId}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
  return (await readFile((await download.path())!, "utf8")).trim().split("\n");
}

const GUITAR_WORDS = /guitar|Squier|Fender|Yamaha|Ibanez|Taylor|Gibson|Stratocaster|acoustics/i;

for (const client of CLIENTS) {
  test.describe(`Competitive Radar final form (${client})`, () => {
    test.beforeEach(async ({ page }) => guest(page));

    test("the on-track caption words a Behind category the way the map bubble does", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(url(client, "spoke=competitors&tab=category-battlecards"));
      const label = page.locator("[data-graph-node-id='spoke-competitors'] .node-hero-label");
      await expect(label).toHaveText(/^\S.*leads\s?\S/, { timeout: 120_000 });
      const bubble = ((await label.textContent()) ?? "").replace(/\s/g, "");
      const caption = page.locator("[data-ai-on-track-caption]");
      await expect(caption).toContainText(" leads ", { timeout: 120_000 });
      await expect(caption).not.toContainText("Behind in");
      expect((await caption.innerText()).replace(/\s/g, "")).toContain(bubble);
    });

    test("Competitor Wins and both Engine Comparison tables download what they show", async ({ page }) => {
      test.setTimeout(300_000);
      await page.goto(url(client, "spoke=competitors&tab=competitor-wins"));
      const wins = page.locator('[data-table-id="competitor-wins"] tbody tr');
      await expect(wins.first()).toBeVisible({ timeout: 120_000 });
      const pill = (await page.locator("[data-ai-history-trigger]").textContent())!.replace("▾", "").trim();
      const shownWins = await wins.count();
      const firstBrand = (await wins.first().getAttribute("data-competitor"))!;
      const lines = await downloadLines(page, "competitor-wins");
      expect(lines[0]).toContain(`Filter,"${pill}. Engines: `);
      expect(lines[3]).toMatch(/^Population,"?[\d,]+ calls from \d+ runs? in this selection\."?$/);
      expect(lines[4]).toBe("Competitor,Leads,Categories,Engines");
      expect(lines.length - 5).toBe(shownWins);
      expect(lines[5].startsWith(`${firstBrand},`)).toBe(true);

      await page.locator(".drilldown-tab-btn", { hasText: "Engine Comparison" }).click();
      const engines = page.locator('[data-table-id="engine-comparison"] tbody tr');
      await expect(engines.first()).toBeVisible({ timeout: 120_000 });
      const shownEngines = await engines.count();
      const comparison = await downloadLines(page, "engine-comparison");
      expect(comparison[4]).toBe("Engine,Model,Unbranded discovery,Branded consideration,Competitor leads,No leader,Errors");
      expect(comparison.length - 5).toBe(shownEngines);
      const grid = await downloadLines(page, "engine-category");
      expect(grid[4]).toMatch(/^Engine,/);
      expect(grid.length - 5).toBe(await page.locator('[data-table-id="engine-category"] tbody tr').count());
    });

    test("a battlecard chip narrows the download and names itself in the Filter line", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(url(client, "spoke=competitors&tab=category-battlecards"));
      const cards = page.locator(".ai-battlecards");
      await expect(cards.locator("tbody tr[data-category]").first()).toBeVisible({ timeout: 120_000 });
      await cards.locator("[data-ai-battle-chip='lead:other']").click();
      const rows = cards.locator("tbody tr[data-category]");
      const shown = await rows.count();
      const lines = await downloadLines(page, "category-battlecards");
      expect(lines[0]).toContain("Who leads: Another brand leads.");
      expect(lines[4]).toBe(
        "Category,Status,Unbranded discovery,Branded consideration,Top competitor,Competitor leads,No leader,Errors",
      );
      expect(lines.length - 5).toBe(shown);
      for (const line of lines.slice(5)) expect(line.split(",")[1]).toBe("Behind");
    });

    if (client === "ledlenser") {
      test("no tab uses guitar words for a lighting brand", async ({ page }) => {
        test.setTimeout(240_000);
        for (const tab of ["category-battlecards", "competitor-wins", "engine-comparison"]) {
          await page.goto(url(client, `spoke=competitors&tab=${tab}`));
          const body = page.locator(".drilldown-body");
          await expect(body.locator("table").first()).toBeVisible({ timeout: 120_000 });
          // Our copy only: stored engine answers and the pages they cite are the engines' own words.
          const copy = await body.evaluate((el) => {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("[data-ai-why-answer], .ai-why-not-pages").forEach((node) => node.remove());
            return clone.textContent ?? "";
          });
          expect(copy).not.toMatch(GUITAR_WORDS);
        }
      });
    }
  });
}
