import { expect, test } from "./fixtures";

/* AI Search tabs follow the run control. The map stays on the published run.
   These cover the run summary, evidence drill-downs, citations, and old links. */

test.describe("AI Search Visibility", () => {
  test("the bubble states the published run with numerator and denominator", async ({ page }) => {
    const bubble = page.locator(".graph-node").filter({ hasText: /AI\s*Search\s*Visibility/i });
    await expect(bubble).toContainText(/Unbranded\s*13 of 23/);
    await expect(bubble).toContainText(/Branded\s*22 of 23/);
    await expect(bubble).not.toContainText(/51 of 63/);
    await expect(bubble).not.toContainText(/Sims/);
  });

  test("the run summary shows completeness, engines, and the win share", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await expect(canvas.activeTab).toHaveText("Run Summary");
    const body = page.locator(".drilldown-body");
    await expect(page.locator("[data-ai-history-trigger]")).toContainText("Last 30 days");
    await expect(page.locator("[data-ai-window-freshness]")).toHaveCount(0);
    await expect(page.locator("[data-ai-history-banner]")).toHaveCount(0);
    await expect(page.locator("[data-ai-win-rate='unbranded_discovery']")).toHaveText(/\d+\.\d%/);
    await expect(page.locator("[data-ai-win-rate='branded_consideration']")).toHaveText(/\d+\.\d%/);
    await expect(page.locator("[data-ai-role='unbranded_discovery']")).toContainText(/\d+ Fender\/Squier leads/);
    await expect(page.locator("[data-ai-role='unbranded_discovery']")).toContainText(/of \d+/);
    await expect(page.locator("[data-ai-role='branded_consideration']")).toContainText(/\d+ Fender\/Squier leads/);
    await expect(page.locator("[data-ai-role='branded_consideration']")).toContainText(/of \d+/);
    await expect(body).toContainText("not inside unbranded discovery");
    await expect(body).toContainText("Not in either rate above");
    await expect(body).not.toContainText("51 of 63");
    await expect(page.locator(".ai-engine-table tbody tr")).not.toHaveCount(0);
    await expect(page.locator(".ai-category-table [data-category='hallucinations']")).toHaveCount(0);
    await expect(page.locator("[data-ai-window-completeness]")).toContainText("Runs in this selection");
    await expect(page.locator("[data-ai-window-calls]")).toHaveText(/^[\d,]+ answered of [\d,]+ calls?$/);
    await expect(page.locator(".ai-run-card")).not.toContainText("Expected calls");
  });

  test("the command center and metric repeat the two rates", async ({ canvas, page }) => {
    await canvas.openCommandCenter();
    await expect(canvas.commandCenter).toContainText("13 of 23 resolved answers (56.5%)");
    await expect(canvas.commandCenter).toContainText("22 of 23 resolved answers (95.7%)");
    await expect(canvas.commandCenter).not.toContainText("51 of 63");
    await page.locator(".drilldown-hide-btn").click();
    await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);

    await page.locator("[data-graph-node-id='spoke-aeo']").focus();
    const slots = page.locator("[data-hub-slots]");
    await expect(slots.locator("[data-hub-slot='gap']")).toContainText(/Fender led \d+ of \d+/);
    await expect(slots).not.toContainText("Overall AI Win Rate");
  });

  test("a headline count opens the rows behind it", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await page.locator("[data-ifai-evidence='outcome:error']").first().click();
    await expect(canvas.activeTab).toHaveText("Run Details");
    await expect(page).toHaveURL(/evidence=outcome(%3A|:)error/);
    const outcomes = await canvas.simulations.evaluateAll((els) => els.map((el) => el.getAttribute("data-outcome")));
    expect(outcomes.length).toBeGreaterThan(0);
    for (const outcome of outcomes) expect(outcome).toBe("error");
  });

  test("prompts carry no engine tag and the drawer hides absent remediation", async ({ canvas, page }) => {
    await canvas.openSimulations();
    for (const prompt of await page.locator("[data-ai-prompt]").allInnerTexts()) {
      expect(prompt).not.toMatch(/[[(]\s*(chatgpt|gemini|perplexity)/i);
    }
    await canvas.simulations.first().click();
    const drawer = page.locator(".ai-evidence-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Model");
    await expect(drawer).toContainText("Answer ID");
    await expect(drawer.locator("[data-ai-remediation]")).toHaveCount(0);
    await expect(drawer.locator("[data-ai-root-cause]")).toHaveCount(0);
  });

  test("a copied evidence link reopens the same call", async ({ canvas, page }) => {
    await canvas.openSimulations();
    const simId = await canvas.simulations.first().getAttribute("data-sim-id");
    await page.goto(`/dashboard?spoke=aeo&tab=simulations&evidence=sim:${simId}`);
    await expect(page.locator(`.ai-evidence-drawer[data-sim-id='${simId}']`)).toBeVisible();
  });

  test("citations drill from a domain to its cited pages", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Citation Ecosystem");
    await expect(page.locator("[data-ai-cited-answers]")).toContainText(
      /\d+ of \d+ shopping answers cited web sources/,
    );
    const ratio = await page.locator("[data-citation-hero-value]").innerText();
    const ratioMatch = ratio.match(/(\d+) of (\d+)/);
    expect(ratioMatch).not.toBeNull();
    const ownedAnswers = Number(ratioMatch![1]);
    const answered = Number(ratioMatch![2]);
    expect(ownedAnswers).toBeGreaterThanOrEqual(0);
    expect(answered).toBeGreaterThan(0);
    await expect(page.locator("[data-citation-hero-ratio]")).toContainText(
      /unbranded discovery answers cited a Fender-owned page/,
    );
    await expect(page.getByText(/Figures add \d+ runs?/)).toHaveCount(0);
    await expect(page.locator("[data-citation-hero-pct]")).toContainText(/%/);
    await expect(page.locator("[data-citation-role-lead]").first()).toBeVisible();
    const linkPie = page.locator("[data-citation-pie='classes']");
    const ownedPie = page.locator("[data-citation-pie='unbranded']");
    await expect(ownedPie).toHaveAttribute("data-pie-total", String(answered));
    const brandPie = page.locator("[data-citation-pie='brands']");
    const pies = [linkPie, ownedPie];
    if (await brandPie.count()) pies.push(brandPie);
    for (const pie of pies) {
      const total = Number(await pie.getAttribute("data-pie-total"));
      const counts = await pie.locator("[data-pie-count]").evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute("data-pie-count"))),
      );
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(total);
    }
    await expect(page.locator("[data-citation-role='unbranded_discovery']")).toContainText(/\d+ of \d+/);
    await expect(page.locator("[data-citation-role='branded_consideration']")).toContainText(/\d+ of \d+/);
    for (const role of ["unbranded_discovery", "branded_consideration"]) {
      const roleRow = page.locator(`[data-citation-role="${role}"]`);
      await expect(roleRow).toBeVisible();
      const resolved = Number(await roleRow.getAttribute("data-role-resolved"));
      const groupNs = await roleRow.locator("[data-role-n]").evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute("data-role-n"))),
      );
      expect(groupNs.reduce((sum, n) => sum + n, 0)).toBe(resolved);
    }
    const heroBox = await page.locator("[data-citation-hero-value]").boundingBox();
    expect(heroBox && heroBox.height).toBeGreaterThan(40);
    const ownedDisc = await page.locator(".citation-pie-disc-owned").boundingBox();
    const mixDisc = await page.locator(".citation-pie-disc-mix").boundingBox();
    expect(ownedDisc && ownedDisc.width).toBeGreaterThanOrEqual(160);
    expect(mixDisc && mixDisc.width).toBeGreaterThanOrEqual(180);
    await expect(page.locator("[data-ai-cited-links]")).toContainText(/\d+ cited links/);
    await expect(page.locator("[data-ai-fender-owned]")).toContainText(
      /\d+ of \d+ cited links .* led to Fender-owned sites/,
    );
    const body = page.locator(".drilldown-body");
    await expect(body).toContainText("Answers and links are separate counts");
    await expect(body).toContainText("Why this matters");
    await expect(body).toContainText("canonical product facts");
    await expect(body).toContainText("An association, not proof of cause");
    await expect(page.locator(".drilldown-desc")).not.toContainText("\u2014");
    await expect(page.locator("[data-ai-citation-interpretation]")).toContainText(
      "A low count does not prove a source had no influence",
    );
    await expect(body).not.toContainText("valid link");
    const domain = page.locator(".ai-top-domains [data-ai-pick^='domain:']").first();
    const picked = (await domain.getAttribute("data-ai-pick"))!.slice("domain:".length);
    await domain.click();
    const rows = page.locator(".ai-citation-evidence tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const d of await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-domain")))) {
      expect(d).toBe(picked);
    }
    const roleGroup = page.locator("[data-citation-role-group]").first();
    if (await roleGroup.count()) {
      await roleGroup.click();
      await expect(page.locator(".ai-citation-evidence")).toContainText(/Fender-owned page/i);
    }
    const gap = page.locator("[data-citation-gap]").first();
    if (await gap.count()) {
      await gap.click();
      await expect(page.locator(".ai-citation-evidence")).toContainText(/gaps \(no Fender-owned page\)/i);
      await expect(rows.first()).toBeVisible();
    }
    const link = page.locator(".ai-citation-evidence a[href]").first();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(page.locator(".drilldown-body")).not.toContainText(/\bnull\b/);
  });

  test("AI definitions use the custom tooltip", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    const terms = page.locator(".ai-search-panel .ifai-term");
    await expect(terms.first()).toBeVisible();
    for (const term of await terms.all()) {
      expect((await term.getAttribute("data-ifai-tooltip-desc"))?.length ?? 0).toBeGreaterThan(20);
      await expect(term).not.toHaveAttribute("title");
    }
  });

  test("the citation definitions are reachable by keyboard", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Citation Ecosystem");
    for (const [label, fragment] of [
      ["Cited link", "explicitly returned with its answer"],
      ["Fender-owned", "controlled by Fender or another FMIC brand"],
      ["Source class", "brand-owned, retailer, editorial, community, video, or other"],
    ]) {
      const term = page.locator(`.ifai-term[data-ifai-tooltip-title="${label}"]`).first();
      await expect(term).toHaveAttribute("data-ifai-tooltip-desc", new RegExp(fragment));
      await expect(term).toHaveAttribute("tabindex", "0");
      await expect(term).toHaveAttribute("aria-label", new RegExp(label));
      await expect(term).not.toHaveAttribute("title");
      await term.focus();
      await expect(page.locator(".node-tooltip-definition, .node-tooltip")).toBeVisible();
    }
  });

  test("the fact-check drawer reads question, fact, source, answer, result", async ({ canvas, page }) => {
    await canvas.openSimulations();
    await canvas.filterChip("Product fact checks").click();
    const checked = canvas.simulations.filter({ hasText: "No contradiction found for this fact" }).first();
    await checked.click();
    const drawer = page.locator("[data-ai-fact-check-evidence]");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("product questions IntoFocus sends to every engine on purpose");
    await expect(drawer).not.toContainText("randomly chosen");
    await expect(drawer).not.toContainText("not the whole answer");
    await expect(drawer.locator(".ifai-term", { hasText: "product questions" })).toHaveAttribute(
      "data-ifai-tooltip-desc",
      /is not recorded/,
    );
    // The step labels are uppercased in CSS, so compare case-insensitively.
    const order = (await drawer.innerText()).toLowerCase();
    const steps = ["question checked", "verified fender fact", "official fender source", "ai answer", "result"];
    let cursor = -1;
    for (const step of steps) {
      const at = order.indexOf(step);
      expect(at, step).toBeGreaterThan(cursor);
      cursor = at;
    }
    await expect(drawer.locator("[data-ai-fact-result-row]")).toHaveText("No contradiction found for this fact");
    await expect(drawer.locator("[data-ai-remediation]")).toHaveCount(0);
    await expect(drawer.locator("[data-ai-root-cause]")).toHaveCount(0);
  });

  test("Product Fact Checks states how its products were chosen, N of M", async ({ canvas, page }) => {
    test.slow();
    await page.goto("/dashboard?spoke=aeo&tab=product-fact-checks");
    await expect(canvas.activeTab).toHaveText("Product Fact Checks");
    await expect(page.locator("[data-ai-accuracy-figure]")).toHaveText(/\d+\.\d% Accuracy/, { timeout: 60_000 });
    const badge = page.locator("[data-ai-fact-result]");
    await expect(badge).toHaveText(/^(No contradictions found|1 contradiction|([2-9]|\d{2,}) contradictions)$/);
    const method = page.locator("[data-ai-accuracy-lead] [data-ai-fact-method]");
    await expect(method).toHaveText(/^\d+ products? checked · \d+ with a verified fact$/);
    const term = method.locator(".ifai-term").first();
    await expect(term).toHaveAttribute("data-ifai-tooltip-title", "How these products were chosen");
    await expect(term).toHaveAttribute("data-ifai-tooltip-desc", /is not recorded, so this result covers/);
    await expect(term).not.toHaveAttribute("data-ifai-tooltip-desc", /representative|random/i);
    await expect(term).not.toHaveAttribute("title");
    await term.focus();
    await expect(page.locator(".node-tooltip-definition, .node-tooltip")).toContainText("picked");
    const scope = page.locator("[data-ai-fact-scope] .ifai-term");
    await expect(scope).toHaveText("These checks cover the selected facts only.");
    await expect(scope).toHaveAttribute("data-ifai-tooltip-desc", /do not prove every statement/);
    const body = page.locator(".drilldown-body");
    for (const qualifier of ["does not cover", "clean bill of health", "is not a buying prompt", "so they are not reported"]) {
      await expect(body).not.toContainText(qualifier);
    }
  });

  test("every non-fact-check row reads n/a in Fact check", async ({ canvas, page }) => {
    test.slow();
    await page.goto("/dashboard?spoke=aeo&tab=run-details");
    await expect(canvas.activeTab).toHaveText("Run Details");
    await expect(canvas.simulations.first()).toBeVisible({ timeout: 60_000 });
    await canvas.filterChip("All calls").click();
    // The table draws 25 rows at first; this test reads every row.
    const showAll = page.locator("#ai-simulation-list [data-table-show-all]");
    if (await showAll.count()) await showAll.click();
    await expect(page.locator("#ai-simulation-list [data-table-row-limit]")).toHaveCount(0);
    const factCells = (kind: string) =>
      page
        .locator(`#ai-simulation-list .ai-sim-row${kind} td:nth-child(6)`)
        .evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() ?? ""));
    const shopping = await factCells(":not([data-kind='probe'])");
    expect(shopping.length).toBeGreaterThan(0);
    for (const text of shopping) expect(text).toBe("n/a");
    const checks = await factCells("[data-kind='probe']");
    expect(checks.length).toBeGreaterThan(0);
    for (const text of checks) expect(text).not.toBe("n/a");

    await canvas.filterChip("Shopping prompts").click();
    await page.getByLabel("Fact-check result").selectOption("not_evaluated");
    await expect(canvas.filterChip("Product fact checks")).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.simulations.first()).toBeVisible();
    const kinds = await canvas.simulations.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-kind")));
    for (const kind of kinds) expect(kind).toBe("probe");
  });

  test("Run Details draws the first 25 rows, then 25 more, then every row", async ({ canvas, page }) => {
    test.slow();
    await page.goto("/dashboard?spoke=aeo&tab=run-details");
    await expect(canvas.simulations.first()).toBeVisible({ timeout: 60_000 });
    const footer = page.locator("#ai-simulation-list [data-table-row-limit]");
    await expect(canvas.simulations).toHaveCount(25);
    const total = Number(await footer.getAttribute("data-rows-total"));
    expect(total).toBeGreaterThan(25);
    await expect(footer).toContainText(`Showing 25 of ${total.toLocaleString("en-US")} rows`);
    await footer.locator("[data-table-show-more]").click();
    await expect(canvas.simulations).toHaveCount(Math.min(50, total));
    await footer.locator("[data-table-show-all]").click();
    await expect(canvas.simulations).toHaveCount(total);
    await expect(footer).toHaveCount(0);
  });

  test("a question with no verified fact says so", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Product Fact Checks");
    const pending = page.locator(".ai-probe-table tr[data-probe-state='no_fact']").first();
    await expect(pending).toContainText("No verified fact available");
    await expect(page.locator("[data-ai-pending-fact]")).toContainText(/no verified Fender fact yet/);
    await expect(page.locator("[data-ai-coverage-note]")).toContainText(/did not return answers for \d+ fact-check calls/);
    const body = page.locator(".drilldown-body");
    await expect(body).not.toContainText("0 of 65");
    await expect(body).not.toContainText("0 confirmed");
    await expect(body).not.toContainText("Not evaluated");
  });
});

test.describe("Competitive Radar", () => {
  test("only commercial AI-search outcomes, no retail channels", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("Competitive Radar");
    await expect(page.locator(".drilldown-tab-btn")).toHaveText([
      "Category Battlecards",
      "Competitor Wins",
      "Engine Comparison",
    ]);
    const body = page.locator(".drilldown-body");
    for (const tab of ["Category Battlecards", "Competitor Wins", "Engine Comparison"]) {
      await canvas.openTab(tab);
      await expect(page.locator(".ai-search-panel")).toBeVisible();
      await expect(body).not.toContainText(/Sweetwater|Reverb|Walmart|shelf price/i);
      await expect(body).not.toContainText(/hallucinations/i);
    }
    await expect(page.locator(".ai-engine-comparison tbody tr")).not.toHaveCount(0);
  });

  test("category battlecards open on a row of pies with no header sentence, and chips filter in place", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard?spoke=competitors&tab=category-battlecards");
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText("Category Battlecards");
    const cards = page.locator(".ai-battlecards");
    await expect(cards).toBeVisible({ timeout: 90_000 });
    const heroes = cards.locator(":scope > *").first();
    await expect(heroes).toHaveAttribute("data-ai-battle-heroes", "");
    const desc = page.locator(".drilldown-desc");
    await expect(desc).toBeHidden();
    const sentence = (await desc.textContent())?.match(/Competitors led (\d+) of (\d+) resolved unbranded discovery answers/);
    expect(sentence).not.toBeNull();
    await expect(heroes.locator("[data-ai-battle-competitor-led]")).toHaveText(
      `Competitors led ${sentence?.[1]} of ${sentence?.[2]}`,
    );
    await expect(heroes.locator("[data-ai-ontrack-figure]")).toContainText(/^\d+ of \d+$/);
    await expect(heroes.locator("[data-ai-win-rate='unbranded_discovery']")).toContainText(/\d+\.\d%/);
    await expect(heroes.locator("[data-ai-win-rate='branded_consideration']")).toContainText(/\d+\.\d%/);
    await expect(heroes.locator("[data-citation-pie-disc]")).toHaveCount(3);
    const discTops = await heroes
      .locator("[data-citation-pie-disc]")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(discTops).size, "the three hero pies share one row").toBe(1);
    await expect(heroes.locator("[data-ai-on-track-hero] .ifai-term").first()).toHaveAttribute(
      "data-ifai-tooltip-desc",
      /The pie counts every category, including any the Who leads chip hides\./,
    );
    const tab = page.locator("[data-ai-battlecards-tab]");
    for (const gone of [
      "not inside unbranded discovery",
      "Not in either rate above",
      "stay out of both denominators",
      "No filter is on",
      "count inside",
      "unbranded discovery only",
    ]) {
      await expect(tab).not.toContainText(gone);
    }
    const onTrack = await heroes.locator("[data-ai-ontrack-figure]").innerText();

    const rows = cards.locator("[data-ai-on-track-category]");
    await expect(rows).not.toHaveCount(0);
    for (const row of await rows.all()) {
      const status = await row.getAttribute("data-ai-on-track-status");
      await expect(row.locator(status === "not_available" ? "[data-ai-battle-pie-empty]" : "[data-ai-battle-pie-disc]")).toHaveCount(1);
    }
    const piesBottom = await cards
      .locator("[data-ai-battle-lead-graph]")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(piesBottom, "hero row and category pies fit a 1440 by 900 window").toBeLessThanOrEqual(900);
    const theadTop = await cards.locator("thead").evaluate((el) => el.getBoundingClientRect().top);
    expect(theadTop, "the table header starts inside a 1440 by 900 window").toBeLessThan(900);

    await page.setViewportSize({ width: 1280, height: 720 });
    const groupTops = await cards
      .locator(".ai-battle-chip-group")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(groupTops).size, "both chip groups share one row at 1280 wide").toBe(1);
    const tileBottoms = await rows.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().bottom));
    expect(Math.max(...tileBottoms), "every category pie fits a 1280 by 720 window").toBeLessThanOrEqual(720);
    await page.setViewportSize({ width: 1440, height: 900 });
    const total = await rows.count();
    const url = page.url();

    await cards.locator("[data-ai-battle-chip='lead:other']").click();
    await expect(cards.locator("[data-ai-battle-chip='lead:other']")).toHaveAttribute("aria-pressed", "true");
    for (const status of await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-ai-on-track-status")))) {
      expect(status).toBe("behind");
    }
    for (const status of await cards
      .locator("tbody tr[data-category]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-ai-on-track-status")))) {
      expect(status).toBe("behind");
    }
    await expect(cards.locator("[data-ai-battle-active-chip]")).toHaveText("Another brand leads");
    await expect(heroes.locator("[data-ai-ontrack-figure]"), "the hero pie still counts every category").toHaveText(onTrack);

    const engine = cards.locator("[data-ai-battle-chip^='engine:']:not([data-ai-battle-chip='engine:all'])").first();
    await engine.click();
    await expect(engine).toHaveAttribute("aria-pressed", "true");
    await expect(cards.locator("[data-ai-battle-rates-scope]")).toHaveCount(0);

    await cards.locator("[data-ai-battle-clear]").first().click();
    await expect(rows).toHaveCount(total);
    await expect(cards.locator("[data-ai-battle-chip='engine:all']")).toHaveAttribute("aria-pressed", "true");
    await expect(cards.locator("[data-ai-battle-active-chip]")).toHaveCount(0);
    expect(page.url()).toBe(url);

    await page.locator(".drilldown-tab-btn", { hasText: "Competitor Wins" }).click();
    await expect(desc).toBeVisible();
    await expect(desc).toContainText(/Competitors led \d+ of \d+ resolved unbranded discovery answers/);
  });

  test("a battlecard engine chip carries into each evidence link and marks the figures it narrows", async ({ page }) => {
    test.slow();
    await page.goto("/dashboard?spoke=competitors&tab=category-battlecards");
    const cards = page.locator(".ai-battlecards");
    await expect(cards).toBeVisible({ timeout: 90_000 });
    const pieLink = (key: string) => cards.locator(`[data-ai-battle-pie-disc='${key}']`).locator("xpath=ancestor::button[1]");
    const key = await cards.locator("[data-ai-battle-pie-disc]").first().getAttribute("data-ai-battle-pie-disc");
    expect(key).toBeTruthy();
    await expect(pieLink(key!)).toHaveAttribute("data-ifai-evidence", `category:${key}`);
    await expect(cards.locator(".ai-battle-engine-mark")).toHaveCount(0);
    const firstRow = cards.locator("tbody tr[data-category]").first();
    const firstKey = await firstRow.getAttribute("data-category");
    const plainRates = firstRow.locator("[data-ai-role-count='unbranded_discovery'] .ifai-evidence-link");
    if (await plainRates.count()) {
      await expect(plainRates.first(), "with no chip, a row's rate opens that row's category").toHaveAttribute(
        "data-ifai-evidence",
        `role:unbranded_discovery/fender_win,category:${firstKey}`,
      );
    }

    const chip = cards.locator("[data-ai-battle-chip^='engine:']:not([data-ai-battle-chip='engine:all'])").first();
    const engine = (await chip.getAttribute("data-ai-battle-chip"))!.slice("engine:".length);
    const engineName = (await chip.innerText()).trim();
    await chip.click();
    const marks = cards.locator(".ai-battle-engine-mark");
    await expect(marks.first()).toBeVisible();
    for (const mark of await marks.all()) {
      await expect(mark).toHaveText("*");
      await expect(mark).toHaveAttribute("data-ifai-tooltip-desc", `${engineName} only. Clear the engine to see all engines.`);
      await expect(mark).not.toHaveAttribute("title");
    }
    await expect(cards.locator("[data-ai-on-track-hero] .ai-battle-engine-mark")).toHaveCount(1);
    await expect(pieLink(key!)).toHaveAttribute("data-ifai-evidence", `category:${key},engine:${engine}`);
    const row = cards.locator("tbody tr[data-category]").first();
    const rowKey = await row.getAttribute("data-category");
    await expect(row.locator("td").first().locator(".ifai-evidence-link")).toHaveAttribute(
      "data-ifai-evidence",
      `category:${rowKey},engine:${engine}`,
    );
    const rateLinks = row.locator("[data-ai-role-count='unbranded_discovery'] .ifai-evidence-link");
    if (await rateLinks.count()) {
      await expect(rateLinks.first()).toHaveAttribute(
        "data-ifai-evidence",
        `role:unbranded_discovery/fender_win,category:${rowKey},engine:${engine}`,
      );
    }

    await pieLink(key!).click();
    await expect(page.locator(".drilldown-tab-btn.active")).toHaveText("Run Details");
    expect(new URL(page.url()).searchParams.get("evidence")).toBe(`category:${key},engine:${engine}`);
    await expect(page.locator(".ai-simulations select[aria-label='Engine']")).toHaveValue(engine);
    await expect(page.locator(".ai-simulations select[aria-label='Category']")).toHaveValue(key!);
  });

  test("engine comparison shows the two rates, not one pooled commercial win rate", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("Competitive Radar");
    await canvas.openTab("Engine Comparison");
    const comparison = page.locator(".ai-engine-comparison");
    const lead = comparison.locator("[data-ai-engine-comparison-lead]");
    await expect(lead.locator("[data-ai-lead-figure='unbranded_discovery']")).toBeVisible();
    await expect(lead.locator("[data-ai-lead-figure='branded_consideration']")).toBeVisible();
    await expect(lead.locator("[data-ai-win-rate='unbranded_discovery']")).toContainText(/\d+\.\d%/);
    await expect(lead.locator("[data-ai-win-rate='branded_consideration']")).toContainText(/\d+\.\d%/);
    await expect(lead.locator("[data-citation-pie-disc]")).toHaveCount(2);
    await expect(comparison.locator("[data-ai-role-total='unbranded_discovery']")).toContainText(/\d+ of \d+/);
    await expect(comparison.locator("[data-ai-role-total='branded_consideration']")).toContainText(/\d+ of \d+/);

    const graph = comparison.locator("[data-ai-engine-unbranded-graph]");
    await expect(graph).toBeVisible();
    const marks = graph.locator("[data-ai-engine-mark]");
    await expect(marks).not.toHaveCount(0);
    const rates = await marks.locator("[data-ai-engine-rate]").allInnerTexts();
    const shares = rates.map((text) => parseFloat(text));
    for (let i = 1; i < shares.length; i++) {
      expect(shares[i]).toBeGreaterThanOrEqual(shares[i - 1]);
    }
    await expect(graph.locator("[data-ai-seg-label='fender']").first()).toContainText(/Fender\/Squier leads: \d+/);
    await expect(graph.locator("[data-ai-seg-label='other']").first()).toContainText(/Rest of resolved answers: \d+/);

    const body = page.locator(".drilldown-body");
    await expect(body).not.toContainText("51 of 63");
    await expect(body).not.toContainText("All commercial prompts");
    await expect(body).not.toContainText("Fender win share");
    await expect(body).not.toContainText("Too few to compare");
    await expect(comparison.locator("tbody [data-small-sample='true']")).toHaveCount(0);

    const cell = await comparison.locator("td").first().evaluate((el) => getComputedStyle(el).fontSize);
    const header = await comparison.locator(".ifai-sort-btn").first().evaluate((el) => getComputedStyle(el).fontSize);
    const note = await comparison.locator(".ai-role-footnote").last().evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(cell)).toBeGreaterThanOrEqual(15);
    expect(parseFloat(header)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(note)).toBeGreaterThanOrEqual(14);

    await comparison.locator("[data-ai-role-total='unbranded_discovery'] .ifai-evidence-link").first().click();
    await expect(canvas.activeTab).toHaveText("Run Details");
    await expect(page.locator("[data-ai-role-filter='unbranded_discovery']")).toBeVisible();
    const roles = await canvas.simulations.evaluateAll((els) => els.map((el) => el.getAttribute("data-role")));
    expect(roles.length).toBeGreaterThan(0);
    for (const role of roles) expect(role).toBe("unbranded_discovery");
  });

  test("old tab slugs still open the renamed tabs", async ({ page }) => {
    for (const [spoke, slug, tab] of [
      ["competitors", "multi-marketplace-channel-scope-sweetwater-reverb-walmart", "Engine Comparison"],
      ["competitors", "head-to-head-category-battlecards", "Category Battlecards"],
      ["aeo", "dual-index-scoring-executive-callout", "Run Summary"],
      ["aeo", "simulations", "Run Details"],
      ["aeo", "100-ai-simulations-interactive-explorer", "Run Details"],
      ["aeo", "ai-spec-hallucination-engine-root-causes", "Product Fact Checks"],
      ["aeo", "ai-drift", "Product Fact Checks"],
      ["aeo", "hallucination", "Product Fact Checks"],
      ["aeo", "citation-ecosystem-fender-dtc-opportunity", "Citation Ecosystem"],
      ["hub", "executive-briefing-buy-box-coverage", "Briefing"],
      ["hub", "executive-briefing", "Briefing"],
      ["hub", "division-performance-3-598-skus", "Performance"],
      ["hub", "commercial-sizing-680k-pilot-vs-38m-to-62m-enterprise", "Opportunity"],
    ]) {
      await page.goto(`/dashboard?spoke=${spoke}&tab=${slug}`);
      await expect(page.locator(".drilldown-tab-btn.active")).toHaveText(tab);
    }
  });
});
