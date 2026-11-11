import { readFile } from "node:fs/promises";
import { AI_READ_MS, expect, test } from "./fixtures";

/* Worker 25.1, Summary final form. Decision 7 / X-09: the Briefing's AI figure reads the map's
   population, so the map and the Briefing show one number. H-07: each score reads against
   target 70. X-33 / X-10: the catalog division table sorts, searches, and downloads CSV. */

for (const client of ["fender", "ledlenser"]) {
  test.describe(`Summary (${client})`, () => {
    const query = client === "fender" ? "" : `client=${client}&`;

    test.beforeEach(async ({ page }) => {
      await page.context().addCookies([
        { name: `ifai_guest_${client}`, value: "1", domain: "localhost", path: "/" },
        { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
      ]);
    });

    test("the Briefing unbranded discovery figure matches the map bubble", async ({ page }) => {
      test.slow();
      await page.goto(`/dashboard?${query}spoke=hub`);
      const bubble = page.locator(".graph-node").filter({ hasText: /AI\s*Search\s*Visibility/i });
      await expect(bubble).toContainText(/\d+\.\d%/, { timeout: AI_READ_MS });
      const mapFigure = ((await bubble.textContent()) ?? "").match(/\d+\.\d%/)?.[0];

      const card = page.locator("[data-briefing-finding='unbranded_discovery']");
      const figure = card.locator("[data-briefing-finding-percent]");
      await expect(figure).toHaveText(/\d+\.\d%/, { timeout: AI_READ_MS });
      expect((await figure.textContent())?.match(/\d+\.\d%/)?.[0]).toBe(mapFigure);
      await expect(card.locator("[data-briefing-finding-ratio]")).toHaveText(/^\d[\d,]* of \d[\d,]*$/);
      await expect(card.locator("[data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
    });

    test("every Briefing finding is the same width and shows N of M with its share", async ({ page }) => {
      test.slow();
      await page.goto(`/dashboard?${query}spoke=hub`);
      const cards = page.locator(".briefing-findings > *");
      await expect(cards).toHaveCount(7);
      await expect(page.locator("[data-briefing-finding-ratio]")).toHaveCount(5, { timeout: AI_READ_MS });
      const widths = await cards.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
      expect(new Set(widths).size).toBe(1);
      await expect(page.locator("[data-briefing-finding='splintered_bundles'] [data-briefing-finding-label]")).toHaveText(
        "Splintered Listings",
      );
    });

    test("Performance reads each score against target 70 with its status word", async ({ page }) => {
      test.slow();
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      for (const pillar of ["consensus", "foundation", "commerce"]) {
        const card = page.locator(`[data-consensus-pillar='${pillar}']`);
        await expect(card.locator("[data-consensus-pillar-score]")).toHaveText(/^\d{1,3}\*?$/, { timeout: AI_READ_MS });
        await expect(card.locator("[data-consensus-target]")).toHaveText("vs target 70");
        await expect(card.locator("[data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
      }
      await expect(page.locator("[data-consensus-pillar='actuation']")).toContainText("Not included");
      // AI Actuation is left out, so AI Consensus covers 2 of 3 pillars and carries the asterisk.
      await expect(page.locator("[data-consensus-pillar='consensus'] [data-partial-figure='coverage']")).toHaveCount(1);
      const briefing = page.locator("[data-consensus-pillar='consensus'] [data-consensus-pillar-score]");
      const score = await briefing.textContent();
      await page.locator(".drilldown-tab-btn", { hasText: "Briefing" }).click();
      await expect(page.locator("[data-briefing-consensus-score]")).toHaveText(score ?? "", { timeout: AI_READ_MS });
    });

    test("the division table sorts, searches, and downloads its rows as CSV", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const rows = page.locator('[data-table-id="catalog-divisions"] tbody tr[data-division-row]');
      await expect(rows.first()).toBeVisible({ timeout: 60_000 });
      const total = await rows.count();

      await page.locator('[data-table-id="catalog-divisions"] th[data-col-id="division"] .ifai-sort-btn').click();
      const names = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-division-row") ?? ""));
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names.map((n) => n.toLowerCase())).toEqual(sortedNames.map((n) => n.toLowerCase()));

      const first = names[0];
      await page.locator('[data-table-search="catalog-divisions"]').fill(first);
      await expect(page.locator('[data-table-toolbar="catalog-divisions"] [data-table-search-count]')).toHaveText(
        new RegExp(`^\\d+ of ${total} rows$`),
      );

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.locator('[data-table-download="catalog-divisions"]').click(),
      ]);
      const lines = (await readFile((await download.path())!, "utf8")).trim().split("\n");
      expect(lines[0]).toMatch(/^Filter,/);
      expect(lines[1]).toMatch(/^Sort,/);
      expect(lines[2]).toMatch(/^As of,/);
      expect(lines[3]).toMatch(/^Population,.*catalog division/);
      expect(lines[4]).toBe("Catalog Division,Bundle listings,Amazon holds the Buy Box,Next step");
      expect(lines.slice(5).some((line) => line.includes(first))).toBe(true);
    });
  });
}
