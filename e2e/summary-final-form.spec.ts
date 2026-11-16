import { AI_READ_MS, expect, test } from "./fixtures";

/* Worker 25.1, Summary final form. Decision 7 / X-09: the Briefing's AI figure reads the map's
   population, so the map and the Briefing show one number. H-07: each score reads against
   target 70. Decision 94: no division table; the weakest score card opens its breakdown; the
   saved weekly scores draw "Scores over time", and nothing shows before the table exists. */

const SNAPSHOT_ROUTE = "**/rest/v1/canvas_score_snapshots*";

function snapshotRow(clientKey: string, week: string, consensus: number, foundation: number, commerce: number, actuation: number | null = null) {
  return {
    client_key: clientKey,
    week_start: week,
    saved_at: `${week}T18:17:00Z`,
    consensus_score: consensus,
    foundation_score: foundation,
    commerce_score: commerce,
    actuation_score: actuation,
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
      for (const pillar of ["consensus", "foundation", "commerce", "actuation"]) {
        const card = page.locator(`[data-consensus-lead] [data-consensus-pillar='${pillar}']`);
        await expect(card.locator("[data-consensus-pillar-score]")).toHaveText(/^\d{1,3}\*?$/, { timeout: AI_READ_MS });
        await expect(card.locator("[data-consensus-target]")).toHaveText("vs target 70");
        await expect(card.locator("[data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
      }
      // SC-03: Actuation counts from 0 at launch (decision 97); it never reads Not included (decision 78).
      await expect(page.locator("[data-consensus-scores]")).not.toContainText(/Not included|Awaiting confirmation/);
      await expect(page.locator("[data-consensus-pillar='actuation'] [data-consensus-pillar-coverage]")).toHaveText("5 of 5 factors");
      await expect(page.locator("[data-consensus-pillar='consensus'] [data-consensus-pillar-coverage]")).toHaveText("3 of 3 pillars");
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

      await page.locator("[data-consensus-pillar='consensus'] button.retail-explore").click();
      const weights = page.locator("[data-consensus-weights]");
      // Decisions 77, 78: 40% Foundation, 40% Commerce, 20% Actuation.
      await expect(weights.locator("[data-consensus-weight]")).toHaveText(["Weight 40.0%", "Weight 40.0%", "Weight 20.0%"]);
      await expect(weights.locator("[data-consensus-weight-total] [data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
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
      for (const pillar of ["consensus", "foundation", "commerce", "actuation"]) {
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

    test("AI Actuation opens its factors with points and basis, E1 with its tooltip", async ({ page }) => {
      test.slow();
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const card = page.locator("[data-consensus-pillar='actuation']");
      await expect(card.locator("[data-consensus-pillar-score]")).toHaveText(/^\d{1,3}$/, { timeout: AI_READ_MS });
      const toggle = card.locator("button.retail-explore");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      const factors = page.locator("[data-actuation-factors]");
      await expect(factors.locator("[data-actuation-factor]")).toHaveCount(5);
      await expect(factors.locator("[data-actuation-factor-points]")).toHaveText([
        /^\d+(\.\d)? of 20 points$/,
        /^\d+(\.\d)? of 20 points$/,
        /^\d+(\.\d)? of 30 points$/,
        /^\d+(\.\d)? of 15 points$/,
        /^\d+(\.\d)? of 15 points$/,
      ]);
      await expect(factors.locator("[data-actuation-factor='P1'] [data-actuation-factor-basis]")).toHaveText(/^(Not in place\.|In place\. )/);
      await expect(factors.locator("[data-actuation-factor='E1'] [data-actuation-factor-basis]")).toContainText("unbranded shopping");
      await factors.locator("[data-actuation-factor-tip='E1']").hover();
      await expect(page.locator(".node-tooltip-definition")).toContainText("Owned answers. The share of AI answers to shopping questions");
      await expect(page.locator(".node-tooltip-definition")).toContainText("Target: 15%");
      const sum = await factors
        .locator("[data-actuation-factor-points]")
        .evaluateAll((nodes) => nodes.reduce((total, node) => total + Number.parseFloat(node.textContent ?? "0"), 0));
      const shown = Number.parseInt((await card.locator("[data-consensus-pillar-score]").textContent()) ?? "", 10);
      expect(Math.abs(sum - shown)).toBeLessThanOrEqual(0.6);
      await expect(factors).not.toContainText(/Awaiting|Not included/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("Scores over time shows nothing before the table exists", async ({ page, pageErrors }) => {
      test.slow();
      await page.route(SNAPSHOT_ROUTE, (route) =>
        route.fulfill({
          status: 404,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.canvas_score_snapshots' in the schema cache" }),
        }),
      );
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      await expect(page.locator("[data-consensus-pillar='consensus'] [data-consensus-pillar-score]")).toHaveText(/^\d{1,3}\*?$/, {
        timeout: AI_READ_MS,
      });
      await expect(page.locator("[data-score-history]")).toHaveCount(0);
      await expect(page.getByText("Scores over time")).toHaveCount(0);
      // The browser logs the missing table's 404 as a network line; nothing on the page errors.
      const others = pageErrors.filter((line) => !/404.*canvas_score_snapshots/.test(line));
      expect(others).toEqual([]);
      pageErrors.splice(0, pageErrors.length, ...others);
    });

    test("a failed history read shows Not available* with the reason", async ({ page, pageErrors }) => {
      test.slow();
      await page.route(SNAPSHOT_ROUTE, (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: "57014", message: "canceling statement due to statement timeout" }),
        }),
      );
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const section = page.locator("[data-score-history-failed]");
      await expect(section).toBeVisible({ timeout: AI_READ_MS });
      const mark = section.locator('.ifai-term[data-read-unavailable="canvas_score_snapshots"]');
      await expect(mark).toHaveText("Not available*");
      await expect(mark).toHaveAttribute("data-ifai-tooltip-desc", /did not load: canceling statement due to statement timeout\./);
      // The browser logs the routed 500 as a network line; nothing on the page errors.
      const others = pageErrors.filter((line) => !/500.*canvas_score_snapshots/.test(line));
      expect(others).toEqual([]);
      pageErrors.splice(0, pageErrors.length, ...others);
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
          body: JSON.stringify([snapshotRow(key, "2026-11-09", 54, 33, 75), snapshotRow(key, "2026-11-16", 56, 35, 77, 9)]),
        });
      });
      await page.goto(`/dashboard?${query}spoke=hub&tab=performance`);
      const section = page.locator("[data-score-history]");
      await expect(section).toBeVisible({ timeout: AI_READ_MS });
      await expect(section.locator("summary")).toHaveText("Scores over time");
      // Directly under the card row, above the open breakdown.
      const order = await page.evaluate(() => {
        const row = document.querySelector("[data-consensus-lead]");
        const chart = document.querySelector("[data-score-history]");
        const detail = document.querySelector("#consensus-component-detail");
        return [row?.nextElementSibling === chart, !!chart && !!detail && chart.compareDocumentPosition(detail) === Node.DOCUMENT_POSITION_FOLLOWING];
      });
      expect(order).toEqual([true, true]);
      const toggles = section.locator("[data-score-history-toggle]");
      await expect(toggles).toHaveText(["AI Consensus", "AI Foundation", "AI Commerce", "AI Actuation"]);
      await expect(section.locator("[data-score-history-line]")).toHaveCount(3);
      await expect(section.locator("[data-score-history-target]")).toHaveCount(1);
      await expect(section).toContainText("Target 70");
      await expect(section.locator("[data-score-history-point]")).toHaveCount(7);
      // Decision 97: the week scoring added AI Actuation is marked.
      await expect(section.locator("[data-score-history-actuation-marker='2026-11-16']")).toHaveCount(1);
      const family = await section.locator(".score-history-xlabels span").first().evaluate((node) => getComputedStyle(node).fontFamily);
      expect(family.toLowerCase()).toContain("mono");

      await section.locator("[data-score-history-toggle='commerce']").click();
      await expect(section.locator("[data-score-history-toggle='commerce']")).toHaveAttribute("aria-pressed", "false");
      await expect(section.locator("[data-score-history-line]")).toHaveCount(2);

      const point = section.locator("[data-score-history-point='consensus']").last();
      await point.hover();
      await expect(page.locator(".node-tooltip-definition")).toContainText("56 vs target 70");
      await expect(page.locator(".node-tooltip-definition")).toContainText("Scoring now includes AI Actuation");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
