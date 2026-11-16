import { AI_READ_MS, expect, test } from "./fixtures";

/* Worker 25.1, Summary final form. Decision 7 / X-09: the Briefing's AI figure reads the map's
   population, so the map and the Briefing show one number. H-07: each score reads against
   target 70. Decision 94: no division table; the weakest score card opens its breakdown; the
   saved weekly scores draw "Scores over time", and nothing shows before the table exists. */

const SNAPSHOT_ROUTE = "**/rest/v1/canvas_score_snapshots*";

function snapshotRow(clientKey: string, week: string, consensus: number, foundation: number, commerce: number) {
  return {
    client_key: clientKey,
    week_start: week,
    saved_at: `${week}T18:17:00Z`,
    consensus_score: consensus,
    foundation_score: foundation,
    commerce_score: commerce,
    actuation_score: null,
  };
}

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

    test("Performance shows four titled score cards in one row and Consensus opens its weights", async ({ page }) => {
      test.slow();
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const score = page.locator("[data-consensus-pillar='consensus'] [data-consensus-pillar-score]");
      await expect(score).toHaveText(/^\d{1,3}\*?$/, { timeout: AI_READ_MS });
      await expect(page.locator("[data-consensus-explainer]")).toHaveCount(0);
      await expect(page.getByText(/What is the AI Consensus/i)).toHaveCount(0);

      const titles = page.locator("[data-consensus-lead] [data-consensus-pillar-name]");
      await expect(titles).toHaveText(["AI Consensus Score", "AI Foundation Score", "AI Commerce Score", "AI Actuation Score"]);
      await expect(page.locator("[data-consensus-lead] [data-score-card-tip]")).toHaveCount(4);
      const tops = await page
        .locator("[data-consensus-lead] > [data-consensus-pillar]")
        .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.locator("[data-consensus-pillar='consensus'] [data-score-card-tip]").hover();
      await expect(page.locator(".node-tooltip-definition")).toContainText("AI Consensus is IntoFocus");

      await expect(page.locator("[data-consensus-pillar='actuation'] button.retail-explore")).toHaveCount(0);
      await page.locator("[data-consensus-pillar='consensus'] button.retail-explore").click();
      const weights = page.locator("[data-consensus-weights]");
      await expect(weights.locator("[data-consensus-weight-row='actuation']")).toContainText("Not included");
      await expect(weights.locator("[data-consensus-weight-row='actuation'] [data-consensus-weight]")).toHaveCount(0);
      const points = await weights
        .locator("[data-consensus-contribution]")
        .evaluateAll((nodes) => nodes.map((node) => Number.parseFloat(node.textContent ?? "")));
      const sum = points.reduce((a, b) => a + b, 0);
      const shown = Number.parseInt((await score.textContent()) ?? "", 10);
      expect(Math.abs(sum - shown)).toBeLessThanOrEqual(0.6);
    });

    test("Performance has no division table and opens the weakest score card", async ({ page }) => {
      test.slow();
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const scores: Record<string, number> = {};
      for (const pillar of ["consensus", "foundation", "commerce"]) {
        const figure = page.locator(`[data-consensus-pillar='${pillar}'] [data-consensus-pillar-score]`);
        await expect(figure).toHaveText(/^\d{1,3}\*?$/, { timeout: AI_READ_MS });
        scores[pillar] = Number.parseInt((await figure.textContent()) ?? "", 10);
      }
      await expect(page.locator('[data-table-id="catalog-divisions"]')).toHaveCount(0);
      await expect(page.locator(".drilldown-panel")).not.toContainText("Catalog Division");

      const weakest = await page.locator("[data-consensus-scores]").getAttribute("data-consensus-weakest");
      expect(weakest).not.toBeNull();
      expect(scores[weakest as string]).toBe(Math.min(...Object.values(scores)));
      await expect(page.locator(`[data-consensus-pillar='${weakest}'] button.retail-explore`)).toHaveAttribute("aria-expanded", "true");
      const detail = page.locator("#consensus-component-detail");
      await expect(detail).toBeVisible();
    });

    test("Scores over time shows nothing before the table exists", async ({ page }) => {
      test.slow();
      await page.route(SNAPSHOT_ROUTE, (route) =>
        route.fulfill({
          status: 404,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.canvas_score_snapshots' in the schema cache" }),
        }),
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      await expect(page.locator("[data-consensus-pillar='consensus'] [data-consensus-pillar-score]")).toHaveText(/^\d{1,3}\*?$/, {
        timeout: AI_READ_MS,
      });
      await expect(page.locator("[data-score-history]")).toHaveCount(0);
      await expect(page.getByText("Scores over time")).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test("Scores over time draws each saved score with a toggle and the target of 70", async ({ page }) => {
      test.slow();
      const key = client === "fender" ? "fmic" : client;
      await page.route(SNAPSHOT_ROUTE, (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get("client_key")).toBe(`eq.${key}`);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify([snapshotRow(key, "2026-11-09", 54, 33, 75), snapshotRow(key, "2026-11-16", 56, 35, 77)]),
        });
      });
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const section = page.locator("[data-score-history]");
      await expect(section).toBeVisible({ timeout: AI_READ_MS });
      await expect(section.locator("summary")).toHaveText("Scores over time");
      const toggles = section.locator("[data-score-history-toggle]");
      await expect(toggles).toHaveText(["AI Consensus", "AI Foundation", "AI Commerce"]);
      await expect(section.locator("[data-score-history-line]")).toHaveCount(3);
      await expect(section.locator("[data-score-history-target]")).toHaveCount(1);
      await expect(section).toContainText("Target 70");
      await expect(section.locator("[data-score-history-point]")).toHaveCount(6);
      const family = await section.locator(".score-history-xlabels span").first().evaluate((node) => getComputedStyle(node).fontFamily);
      expect(family.toLowerCase()).toContain("mono");

      await section.locator("[data-score-history-toggle='commerce']").click();
      await expect(section.locator("[data-score-history-toggle='commerce']")).toHaveAttribute("aria-pressed", "false");
      await expect(section.locator("[data-score-history-line]")).toHaveCount(2);

      const point = section.locator("[data-score-history-point='consensus']").last();
      await point.hover();
      await expect(page.locator(".node-tooltip-definition")).toContainText("56 vs target 70");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
