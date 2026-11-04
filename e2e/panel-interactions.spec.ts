import { expect, test } from "./fixtures";

/* The authored panel HTML is injected as a string and wired by delegation.
   These cover the contract in lib/canvas-sdk/panel-interactions.ts. */

test.describe("simulation filters", () => {
  test("commercial prompts, probes, and errors filter apart", async ({ canvas, page }) => {
    await canvas.openSimulations();
    const rows = canvas.simulations;
    for (const kind of await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-kind")))) {
      expect(kind).toBe("commercial");
    }

    await canvas.filterChip("Product fact checks").click();
    await expect(rows.first()).toHaveAttribute("data-kind", "probe");
    for (const kind of await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-kind")))) {
      expect(kind).toBe("probe");
    }

    await page.locator(".ai-sim-filters .segmented-btn", { hasText: "Errors" }).click();
    for (const outcome of await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-outcome")))) {
      expect(outcome).toBe("error");
    }
  });

  /* Guards the regression these buttons shipped with: they called
     window.filterSimulations, which was never defined, and threw on click. */
  test("no filter relies on an undefined global", async ({ canvas, page }) => {
    await canvas.openSimulations();
    const inlineHandlers = await page
      .locator(".segmented-btn")
      .evaluateAll((els) => els.filter((el) => el.hasAttribute("onclick")).length);
    expect(inlineHandlers).toBe(0);
  });

  test("the active chip tracks the selection", async ({ canvas, page }) => {
    await canvas.openSimulations();
    await canvas.filterChip("Product fact checks").click();
    await expect(page.locator(".ai-sim-filters .segmented-btn.active")).toHaveText("Product fact checks");
  });
});

test.describe("collapsible explanations", () => {
  test("an explanation can be hidden and stays hidden", async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");

    const toggle = page.locator(".ceo-callout-toggle").first();
    const body = page.locator(".ceo-callout-body").first();
    await expect(body).toBeVisible();

    await toggle.click();
    await expect(body).toBeHidden();
    // The header survives as a one-line reminder of what was hidden.
    await expect(page.locator(".ceo-callout-header").first()).toBeVisible();

    await canvas.reload();
    await canvas.openPriority("Buy Box withheld");
    await expect(page.locator(".ceo-callout-body").first()).toBeHidden();

    await page.locator(".ceo-callout-toggle").first().click();
    await expect(page.locator(".ceo-callout-body").first()).toBeVisible();
  });
});

test.describe("drill-downs", () => {
  test("MAP tab holds the summary and does not revive the old channel story", async ({ canvas, page }) => {
    await canvas.openPriority("Fender MAP prices have not been stored");
    await expect(canvas.activeTab).toContainText("MAP");

    const body = page.locator(".drilldown-body");
    await expect(body).toContainText("Summary");
    await expect(body).toContainText("Fender MAP prices have not been stored.");
    await expect(body).not.toContainText("listings below MAP");
    await expect(body).not.toContainText("Listings below MAP");
    await expect(body).not.toContainText("Average price gap");
    await expect(body).not.toContainText("Discounted bundles");
    await expect(body).not.toContainText("Amazon gap");
    const musiciansFriend = page.locator("tr", { hasText: "B0HJDFP2XS" });
    await expect(musiciansFriend).toBeVisible();
    await expect(musiciansFriend).toContainText("$599.99");
    await expect(musiciansFriend).toContainText("Not available*");
    await expect(musiciansFriend.locator(".channel-fact a.listing-link")).toHaveCount(0);
    await expect(musiciansFriend).not.toContainText("-$150");
    await expect(musiciansFriend.locator(".channel-gap")).toHaveCount(0);
    const walmart = page.locator("tr", { hasText: "B0DYKZ4MJG" });
    await expect(walmart).toBeVisible();
    await expect(walmart).toContainText("$220.14");
    await expect(walmart.locator(".channel-gap")).toHaveCount(0);
    await expect(body).not.toContainText("$808.00");
    await expect(body).not.toContainText("Reverb");
    await expect(body).not.toContainText("Sweetwater");
    await expect(body).not.toContainText("Buy Box withheld");
    await expect(body).not.toContainText("Prices at MAP");
    await expect(page.locator(".map-channel-row")).toHaveCount(0);
  });

  test("portfolio retail keeps listings, MAP, suppressed rows, and catalog apart", async ({
    canvas,
    page,
  }) => {
    await canvas.openPriority("Buy Box withheld");
    await expect(page.locator(".drilldown-tab-btn")).toHaveText([
      "Retail Overview",
      "Suppressed Listings",
      "MAP",
      "Catalog Governance",
      "Out of Stock",
    ]);

    await expect(canvas.activeTab).toHaveText("Retail Overview");
    await expect(page.getByRole("button", { name: "Explore all listings" })).toBeVisible();
    await expect(page.locator(".retail-listings-table")).toHaveCount(0);
    await expect(page.locator(".suppressed-listings")).toHaveCount(0);

    await page.getByRole("button", { name: "Explore all listings" }).click();
    await expect(page.locator(".retail-listings-table")).toBeVisible();
    await expect(page.locator(".segmented-btn", { hasText: "All" })).toBeVisible();
    await expect(page.locator(".segmented-btn", { hasText: "MAP violations only" })).toBeVisible();
    await expect(page.locator(".segmented-btn", { hasText: "Bundles only" })).toBeVisible();

    await canvas.openTab("Catalog Governance");
    const catalog = page.locator(".catalog-governance");
    await expect(catalog).toContainText("not the full catalog");
    await expect(catalog).not.toContainText("listings below MAP");
    await expect(catalog).not.toContainText("Average price gap");
    await expect(catalog).not.toContainText("$808");
    await expect(catalog).not.toContainText("8 Listings");
    await expect(catalog).not.toContainText("11 Listings");
    await expect(catalog).not.toContainText("0 Violations");
    await expect(catalog).not.toContainText("Reverb");
    await expect(catalog).not.toContainText("Sweetwater");
    await expect(catalog).not.toContainText("Starter Kit");
  });

  test("out of stock shows sourced estimates that open to their inputs", async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");
    await expect(page.locator(".drilldown-tab-btn[data-new-tab]")).toHaveText(["Out of Stock"]);
    await canvas.openTab("Out of Stock");
    const panel = page.locator(".stock-loss");
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-new-tag]")).toBeVisible();
    await expect(panel.getByText("Loading the stock history…")).toHaveCount(0);
    await expect(panel).toContainText("analyst estimate");
    await expect(panel).not.toContainText("could not be loaded");

    // Every number column names where it comes from.
    const header = panel.locator("thead");
    await expect(header.locator('[data-source="Keepa"]').first()).toBeVisible();
    await expect(header.locator('[data-source="SmartScout"]').first()).toBeVisible();
    await expect(header.locator('[data-source="Estimate"]').first()).toBeVisible();

    // Every row was out of stock at least one day, so no 12-month estimate is $0.00.
    // A listing with no sales source reads Awaiting inputs.
    const rows = panel.locator("tr.stock-loss-row");
    await expect(rows.first()).toBeVisible();
    const zeroYear = await rows.evaluateAll(
      (trs) => trs.filter((tr) => tr.querySelectorAll("td")[1]?.textContent?.trim() === "$0.00").length,
    );
    expect(zeroYear).toBe(0);
    await expect(rows.locator("td:nth-child(2)", { hasText: "Awaiting inputs" }).first()).toBeVisible();
    await expect(panel.locator("[data-no-active-offer]").first()).toBeVisible();

    // The top row has an estimate, and it opens to its inputs and dated stretches.
    await rows.first().click();
    const drawer = panel.locator("[data-stock-loss-drawer]");
    await expect(drawer).toContainText("How this estimate is built");
    await expect(drawer).toContainText("Sales per in-stock day");
    await expect(drawer.getByRole("link", { name: "Open the Keepa chart" })).toBeVisible();
    await expect(drawer.getByText("Loading the dated stretches…")).toHaveCount(0);
    await expect(drawer.locator("[data-episode-state]").first()).toBeVisible();
  });

  test("suppressed listings follow the retail reading", async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");
    await canvas.openTab("Suppressed Listings");
    const body = page.locator(".drilldown-body");
    const list = page.locator(".suppressed-listings");
    await expect(list).toBeVisible();
    await expect(list).toContainText("Competitive External Price");
    await expect(list).not.toContainText("Recorded Keepa reading");
    await expect(list).not.toContainText("39 of 993");
    await expect(list).not.toContainText("Reverb");
    await expect(list).not.toContainText("Sweetwater");
    await expect(body).not.toContainText("$808.00");

    // Amazon's benchmark is never attributed to a named retailer.
    await expect(list).toContainText("Amazon does not name that retailer");

    const count = list.locator(".suppressed-count");
    await expect(count).toBeVisible();
    await expect(list.getByText("Loading withheld listings…")).toHaveCount(0);
    await expect(
      list.getByText(/current reading|not stored a reading|could not be loaded/).first(),
    ).toBeVisible();
    if (await count.isVisible()) {
      // The badge is the confirmed withheld count, and the table lists exactly those rows.
      const badge = Number((await count.innerText()).replace(/,/g, ""));
      const empty = await list.getByText("No monitored listing has a withheld").count();
      const dataRows = empty ? 0 : await list.locator("tbody tr").count();
      expect(badge).toBe(dataRows);
    }
  });

  test("the Buy Box readings keep each state on its own denominator", async ({
    canvas,
    page,
  }) => {
    await canvas.openPriority("Buy Box withheld");
    await expect(canvas.activeTab).toHaveText("Retail Overview");
    const readings = page.locator(".fo-readings");
    await expect(readings).toBeVisible();
    for (const label of [
      "Buy Box present",
      "Buy Box withheld",
      "No active offer",
      "Coverage exceptions",
      "Competitive External Price available",
      "Confirmed withheld above outside price",
    ]) {
      await expect(readings.locator(".fo-reading", { hasText: label }).first()).toBeVisible();
    }
    const coverage = readings.locator(".fo-reading", { hasText: "Coverage exceptions" });
    await expect(coverage).toContainText("unchecked");
    await expect(coverage).toContainText("failed");
    await expect(readings.locator(".fo-reading")).toHaveCount(6);
    // Every rate shows its denominator, and a missing result is never a bare zero.
    await expect(readings.locator(".fo-denominator").first()).toBeVisible();
    await expect(readings).toContainText("not counted as zero");
    await expect(readings).toContainText("Buy Box check");
    await expect(readings).not.toContainText("MAP");
  });

  test("roadmap first tab shows current findings, not example phases", async ({ page }) => {
    await page.context().addCookies([
      { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
    ]);
    await page.goto("/dashboard?spoke=roadmap");
    const body = page.locator(".drilldown-body");
    await expect(page.locator("[data-roadmap-findings-panel]")).toBeVisible();
    await expect(page.locator(".drilldown-tab-btn.active")).toContainText("30-60-90 Day Milestones");
    await expect(body).toContainText("Current findings");
    for (const label of [
      "Buy Box withheld",
      "MAP leakage",
      "Splintered bundles",
      "Exact official product pages",
      "Unbranded discovery",
    ]) {
      await expect(body).toContainText(label);
    }
    // Each finding shows its current N of M share.
    await expect(body.locator("[data-briefing-finding-ratio]")).toHaveCount(5);
    await expect(body.locator(".ifai-open-hint")).toHaveCount(0);
    await expect(body).not.toContainText("Phase 1");
    await expect(body).not.toContainText("Days 1 to 30");
    await expect(body).not.toContainText("since last time");
  });

  test("the spec sample states the live schema result", async ({ canvas, page }) => {
    await canvas.openPriority("machine-readable spec");
    await canvas.openTab("Readiness");
    await expect(page.locator(".drilldown-desc")).toHaveCount(0);
    await expect(page.locator(".drilldown-body")).toContainText("additionalProperty");
    await expect(page.locator(".drilldown-body")).not.toContainText("29.2%");
    await expect(page.locator(".drilldown-body")).not.toContainText("7 of 22");
    await expect(page.locator(".drilldown-body")).not.toContainText("14 catalog");
  });

  test("Product Fact Checks leads with the business result", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Product Fact Checks");
    const body = page.locator(".drilldown-body");
    await expect(page.locator("[data-ai-fact-headline]")).toContainText(
      /\d+ Fender product facts were checked across .+\. No contradictions were found in \d+ answers\./,
    );
    await expect(body).not.toContainText("These checks cover the selected facts only");
    await expect(page.locator("[data-ai-accuracy-figure] .ifai-term")).toHaveAttribute(
      "data-ifai-tooltip-desc",
      /These checks cover the selected facts only\./,
    );
    await expect(page.locator(".ai-probe-table tbody tr").first()).toBeVisible();
    await expect(body).not.toContainText("Dual Humbucker");
    await expect(body).not.toContainText("12-Inch");
    await expect(body).not.toContainText("flagged answers");
  });

  test("a Musician's Friend price uses its stored page or says the page was not stored", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("Catalog Health");
    await canvas.openTab("MAP");
    const cells = page.locator(".drilldown-body table td.channel-fact");
    await expect(cells.first()).toBeVisible();
    const texts = await cells.allInnerTexts();
    const hrefs = await cells.locator("a.listing-link").evaluateAll((els) =>
      els.map((el) => el.getAttribute("href") ?? ""),
    );
    expect(texts.some((text) => text.includes("Not available*")) || hrefs.length > 0).toBe(true);
    for (const href of hrefs) expect(href).toMatch(/^https?:\/\//);
    await expect(page.locator(".drilldown-body a[href*='/search']")).toHaveCount(0);
  });

  test("competitive rows use commercial AI-search outcomes", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("Competitive Radar");
    await expect(page.locator(".ai-battlecards")).toBeVisible();

    const headers = await page.locator(".ai-battlecards th").allInnerTexts();
    expect(headers.some((h) => /unbranded discovery/i.test(h))).toBe(true);
    expect(headers.some((h) => /top competitor/i.test(h))).toBe(true);
    expect(headers.some((h) => /competitor leads/i.test(h))).toBe(true);

    const desc = await page.locator(".drilldown-desc").innerText();
    const led = desc.match(/Competitors led (\d+) of (\d+) resolved unbranded discovery answers/);
    expect(led).not.toBeNull();
    await expect(page.locator("[data-ai-run-details-lead] [data-ai-win-rate='unbranded_discovery']")).toBeVisible();
    await expect(page.locator("[data-ai-battle-lead-graph]")).toBeVisible();
    await expect(page.locator("[data-ai-history-trigger]")).toContainText("Last 30 days");

    const body = page.locator(".drilldown-body");
    await expect(body).toContainText("Yamaha");
    await expect(body).toContainText("Fender/Squier");
    await expect(body).not.toContainText("16.7%");
    await expect(body).not.toContainText("15.4%");
    await expect(body).not.toContainText("50-point");
  });
});

test.describe("glossary", () => {
  test("jargon is marked with a plain-language definition", async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");

    const terms = page.locator(".ifai-term");
    expect(await terms.count()).toBeGreaterThan(0);

    for (const term of await terms.all()) {
      const definition = await term.getAttribute("data-ifai-tooltip-desc");
      expect(definition?.length ?? 0).toBeGreaterThan(20);
      await expect(term).not.toHaveAttribute("title");
    }
    const buyBox = terms.filter({ hasText: "Buy Box" }).first();
    await expect(buyBox).toBeVisible();
    await expect(buyBox).toHaveAttribute(
      "data-ifai-tooltip-desc",
      /Amazon also calls it the Featured Offer\./,
    );
  });

  /* The command center is React-rendered; mutating it would fight reconciliation. */
  test("the walker leaves React-rendered content alone", async ({ canvas, page }) => {
    await canvas.openCommandCenter();
    await expect(page.locator(".command-center .ifai-term")).toHaveCount(0);

    const item = canvas.priorities.first();
    await item.locator(".cc-owner-btn", { hasText: "Client team" }).click();
    await expect(item.locator(".cc-owner-btn.active")).toHaveText("Client team");
  });

  test("marking does not corrupt the surrounding copy", async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");
    const html = await page.locator(".drilldown-body").innerHTML();
    expect(html).toContain('<span class="ifai-term"');
    expect(html).not.toContain("&lt;span");
    await expect(page.locator(".drilldown-body")).toContainText("Buy Box");
  });

  test("terms are re-marked after switching tabs", async ({ canvas, page }) => {
    await canvas.openPriority("Buy Box withheld");
    const before = await page.locator(".ifai-term").count();

    await canvas.openTab("MAP");
    await canvas.openTab("Retail Overview");
    await expect(page.locator(".ifai-term")).toHaveCount(before);
  });
});
