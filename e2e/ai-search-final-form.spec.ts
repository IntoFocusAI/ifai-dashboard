import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/* Worker 24.4, AI Search Visibility final form, on the live read for both clients:
   the Ledlenser window (defect), N of M catalog products on every engine choice (A-05),
   the decided names on the map (X-18), downloads that follow the date pill (X-10, X-33),
   and the view-only Prompts list for every client with staff-only Build prompts (decisions 89, 99). */

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

for (const client of CLIENTS) {
  test.describe(`AI Search final form (${client})`, () => {
    test.beforeEach(async ({ page }) => guest(page));

    test("the tabs open on the last 30 days with both lead rates", async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto(url(client, "spoke=aeo&tab=run-summary"));
      await expect(page.locator("[data-ai-history-trigger]")).toContainText("Last 30 days");
      const unbranded = page.locator("[data-ai-win-rate='unbranded_discovery']");
      await expect(unbranded).toHaveText(/^\d+\.\d%$/, { timeout: 90_000 });
      await expect(page.locator("[data-ai-win-rate='branded_consideration']")).toHaveText(/^\d+\.\d%$/);
      await expect(page.locator(".drilldown-body")).not.toContainText("No published run in the last 30 days");
      // Each rate carries its status as color, mark, and word.
      await expect(page.locator("[data-ai-role='unbranded_discovery'] [data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
      // Qualifiers that say what a figure is not live in tooltips.
      for (const gone of ["not inside Unbranded Discovery", "Not in either rate above", "not counted as wins"]) {
        await expect(page.locator(".drilldown-body")).not.toContainText(gone);
      }
    });

    test("Product Fact Checks leads with N of M catalog products on every engine choice", async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto(url(client, "spoke=aeo&tab=product-fact-checks"));
      const figure = page.locator("[data-ai-catalog-figure]");
      await expect(figure).toHaveText(/^[\d,]+ of [\d,]+$/, { timeout: 90_000 });
      const lead = page.locator("[data-ai-catalog-lead='ready']");
      await expect(lead).toContainText("catalog products checked");
      const tip = figure.locator(".ifai-term");
      await expect(tip).toHaveAttribute("data-ifai-tooltip-title", "Catalog products checked");
      await expect(tip).toHaveAttribute(
        "data-ifai-tooltip-desc",
        /^This figure covers ChatGPT, Gemini, and Perplexity\. Only ChatGPT, Gemini, and Perplexity ask the rotating catalog questions\./,
      );
      await expect(tip).not.toHaveAttribute("title", /.*/);
      // Accuracy sits to the right of the catalog figure, side by side, with no sideways scroll.
      const catalogBox = (await lead.boundingBox())!;
      const accuracyBox = (await page.locator("[data-ai-accuracy-figure]").boundingBox())!;
      expect(accuracyBox.x).toBeGreaterThanOrEqual(catalogBox.x + catalogBox.width - 1);
      expect(Math.abs(accuracyBox.y - catalogBox.y)).toBeLessThan(40);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const explainerBox = (await page.locator("[data-ai-accuracy-lead]").boundingBox())!;
      expect(explainerBox.x).toBeGreaterThanOrEqual(accuracyBox.x + accuracyBox.width - 1);
      await expect(page.locator("[data-ai-accuracy-figure-col] [data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
      await expect(page.locator("[data-ai-fact-fixed-only]")).toHaveCount(0);

      const all = await figure.textContent();
      // Both clients have API engines (decision 89). Their API runs ask no catalog question, so
      // API only reads Not available* with the reason in its tooltip (decision 90).
      await expect(page.locator("[data-ai-engine-switch='unavailable']")).toHaveCount(0);
      await page.locator("[data-ai-engine-choice='search']").click();
      await expect(figure).toHaveText(all!);
      await page.locator("[data-ai-engine-choice='api']").click();
      await expect(page.locator("[data-ai-catalog-lead='not-asked']")).toBeVisible({ timeout: 60_000 });
      await expect(figure).toHaveText("Not available*");
      await expect(tip).toHaveAttribute(
        "data-ifai-tooltip-desc",
        /^No engine in this engine choice was asked a catalog question in this selection, so there is no count to show\./,
      );
    });

    test("the map uses the decided names and the radar label stays inside its bubble at 1280", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(url(client, "spoke=competitors"));
      const aeo = page.locator("[data-graph-node-id='spoke-aeo']");
      await expect(aeo).toContainText(/Unbranded\s*Discovery/, { timeout: 60_000 });
      await expect(page.locator(".ifai-canvas")).not.toContainText("Unbranded SOV");
      const radar = page.locator("[data-graph-node-id='spoke-competitors']");
      const label = radar.locator(".node-hero-label");
      // The label is drawn as SVG rows, so its words meet without a space in the DOM text.
      await expect(label).toHaveText(/^\S.*leads\s?\S/, { timeout: 60_000 });
      await expect(label).not.toContainText("·");
      const circle = (await radar.locator(":scope > .node-inner > .node-circle").boundingBox())!;
      const text = (await label.boundingBox())!;
      expect(text.y + text.height, "the label ends inside the ring").toBeLessThanOrEqual(circle.y + circle.height);
      expect(text.x).toBeGreaterThanOrEqual(circle.x);
      expect(text.x + text.width).toBeLessThanOrEqual(circle.x + circle.width);
    });

    test("the radar bubble names the rival the Category Battlecards tab lists first as Behind", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(url(client, "spoke=competitors"));
      const label = page.locator("[data-graph-node-id='spoke-competitors'] .node-hero-label");
      await expect(label).toHaveText(/^\S.*leads\s?\S/, { timeout: 120_000 });
      // The bubble adds "(rival share)" after the decided wording, since its figure is the rival's share.
      const bubble = ((await label.textContent()) ?? "").replace(/\s+/g, " ").replace(/\s?\(rival\s?share\)$/, "");
      await page.goto(url(client, "spoke=competitors&tab=category-battlecards"));
      const body = page.locator(".drilldown-body");
      const behind = body.locator("[data-ai-on-track-status='behind'] [data-ai-battle-leader]").first();
      await expect(behind).toHaveText(/\S leads \S/, { timeout: 120_000 });
      // The first Behind card reads exactly what the bubble reads: "Taylor leads Acoustics".
      expect(((await behind.textContent()) ?? "").replace(/\s/g, "")).toBe(bubble.replace(/\s/g, ""));
    });

    test("Run Summary and Run Details download what they show for the date pill's selection", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(url(client, "spoke=aeo&tab=run-summary"));
      const rows = page.locator('[data-table-id="ai-run-engines"] tbody tr');
      await expect(rows.first()).toBeVisible({ timeout: 90_000 });
      const pill = (await page.locator("[data-ai-history-trigger]").textContent())!.replace("▾", "").trim();
      const shown = await rows.count();
      const firstEngine = (await rows.first().locator("td").first().textContent())!.trim();
      const firstRate = await rows.first().locator("[data-ai-role-count='unbranded_discovery']").getAttribute("data-ai-rate");

      const lines = await downloadLines(page, "ai-run-engines");
      expect(lines[0]).toContain(`Filter,"${pill}. Engines: `);
      expect(lines[1]).toMatch(/^Sort,/);
      expect(lines[2]).toMatch(/^As of,".+ UTC"$/);
      expect(lines[3]).toMatch(/^Population,"?[\d,]+ calls from \d+ runs? in this selection\."?$/);
      expect(lines[4]).toBe("Engine,Model,Unbranded Discovery,Branded Consideration,No leader,Errors");
      expect(lines.length - 5).toBe(shown);
      expect(lines[5].startsWith(`${firstEngine},`)).toBe(true);
      if (firstRate) expect(lines[5]).toContain(firstRate);

      await page.goto(url(client, "spoke=aeo&tab=run-details"));
      const search = page.locator('[data-table-search="ai-simulations"]');
      await expect(search).toBeVisible({ timeout: 90_000 });
      await search.fill("best");
      const count = page.locator('[data-table-toolbar="ai-simulations"] [data-table-search-count]');
      await expect(count).toHaveText(/^[\d,]+ of [\d,]+ rows$/);
      const matched = Number(await count.getAttribute("data-table-search-count"));
      expect(matched).toBeGreaterThan(0);
      const details = await downloadLines(page, "ai-simulations");
      expect(details[0]).toContain(`${pill}. Engines: `);
      expect(details[0]).toContain("Shopping prompts.");
      expect(details[0]).toContain('Search ""best""');
      expect(details[4]).toBe("Prompt,Outcome,Engine,Model,Category,Fact check,Cited links,Checked");
      expect(details.length - 5).toBe(matched);
    });
  });
}


/* Decisions 89 and 99 (Workers 27.10, 27.12): every client gets the same view-only Prompts list
   (search, N of M, CSV) and no client edits questions. Build prompts is for IntoFocus staff only.
   Ledlenser's list reads ledlenser.canvas_ai_prompts, mocked here until the view is applied. */
const LEDLENSER_PROMPTS = [
  { prompt_key: "l01", prompt_text: "Best rechargeable headlamp for backpacking and hiking", category: "headlamps", prompt_kind: "commercial", active: true, created_at: "2026-11-04T15:59:37Z", updated_at: null },
  { prompt_key: "l08", prompt_text: "Best rechargeable EDC flashlight under $100", category: "flashlights", prompt_kind: "commercial", active: true, created_at: "2026-11-04T15:59:37Z", updated_at: null },
  { prompt_key: "l12", prompt_text: "Ledlenser P7R vs Olight Warrior 3S flashlight", category: "flashlights", prompt_kind: "commercial", active: true, created_at: "2026-11-04T15:59:37Z", updated_at: null },
  { prompt_key: "l30", prompt_text: "Rotating catalog fact check slot A: question per run in ledlenser.ai_probe_plan", category: "hallucinations", prompt_kind: "probe", active: true, created_at: "2026-11-04T15:59:37Z", updated_at: null },
];

const PROMPTS_BUTTON = /^Prompts$/;

/** The header's staff check (as in sites-to-review.spec.ts). Unmocked it asks the dev server, whose e2e session is not staff. */
async function answerStaff(page: Page) {
  await page.route("**/dashboard/sites-to-review/staff", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ staff: true }) }),
  );
}

/** No add, edit, remove, restore, history, or Build prompts link on the Prompts screen. */
async function expectViewOnly(page: Page) {
  const dialog = page.locator(".pe-dialog");
  await expect(dialog.locator("textarea")).toHaveCount(0);
  await expect(dialog.locator(".pe-add, .pe-item-actions, .pe-edit")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^(Edit|Remove) / })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Add prompt|Restore prompt|Save prompt/ })).toHaveCount(0);
  await expect(dialog.locator("[data-pe-builder-link]")).toHaveCount(0);
  await expect(dialog.locator("[data-prompt-history-toggle], [data-prompt-history], [data-prompt-history-status]")).toHaveCount(0);
  await expect(dialog.locator('[data-prompt-search] input[type="search"]')).toBeVisible();
  await expect(dialog.locator('[data-table-download="prompts"]')).toBeEnabled();
}

test.describe("Prompts for every client (decisions 89 and 99)", () => {
  test.beforeEach(async ({ page }) => guest(page));

  for (const client of CLIENTS) {
    test(`a client user has Prompts and no Build prompts (${client})`, async ({ page }) => {
      await page.goto(url(client, ""));
      await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: 60_000 });
      await expect(page.locator(".hdr-btn", { hasText: PROMPTS_BUTTON })).toBeVisible();
      await expect(page.locator(".hdr-btn", { hasText: "Build prompts" })).toHaveCount(0);
    });

    test(`staff see Build prompts; the page still checks the session (${client})`, async ({ page }) => {
      await answerStaff(page);
      await page.goto(url(client, ""));
      const link = page.locator(".hdr-btn", { hasText: "Build prompts" });
      await expect(link).toBeVisible({ timeout: 60_000 });
      await expect(page.locator(".hdr-btn", { hasText: PROMPTS_BUTTON })).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(client === "fender" ? /\/dashboard\/battery-builder$/ : /\/dashboard\/battery-builder\?client=ledlenser/);
      // The e2e server session is not staff, so the page shows the staff message, as Sites to review does.
      await expect(page.locator("[data-staff-only]")).toContainText("This page is for IntoFocus staff.");
    });

    test(`a forwarded Build prompts link shows the staff message (${client})`, async ({ page }) => {
      await page.goto(`/dashboard/battery-builder${client === "fender" ? "" : `?client=${client}`}`);
      const notice = page.locator("[data-staff-only]");
      await expect(notice).toContainText("This page is for IntoFocus staff.");
      await expect(notice.locator("h1")).toHaveText("Build prompts");
      await expect(page.locator(".bb-card, .bb-page")).toHaveCount(0);
      await expect(notice.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
        "href",
        client === "fender" ? "/dashboard" : `/dashboard?client=${client}`,
      );
    });
  }

  test("Fender's Prompts list is view-only, searchable, and never reads the change log", async ({ page }) => {
    test.setTimeout(120_000);
    let historyRead = false;
    await page.route("**/rest/v1/rpc/ai_prompt_edits_list*", (route) => {
      historyRead = true;
      return route.continue();
    });
    await page.goto(url("fender", ""));
    await page.locator(".hdr-btn", { hasText: PROMPTS_BUTTON }).click();
    await expect(page.locator(".pe-item").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-prompt-search-count]")).toHaveText(/^[\d,]+ of [\d,]+ prompts$/);
    await expectViewOnly(page);
    const fact = page.locator(".pe-item", { hasText: "Rotating catalog fact check, slot A" });
    await expect(fact).toContainText("Rotating catalog fact check, slot A: a different catalog product each run");
    await expect(page.locator(".pe-dialog")).not.toContainText("fmic_ai_probe_plan");
    expect(historyRead).toBe(false);
  });

  test("Ledlenser's Prompts lists its own battery, searchable, view-only", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route("**/rest/v1/canvas_ai_prompts*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(LEDLENSER_PROMPTS) }),
    );
    let fenderListRead = false;
    await page.route("**/rest/v1/rpc/ai_prompts_list*", (route) => {
      fenderListRead = true;
      return route.continue();
    });
    await page.goto(url("ledlenser", ""));
    await page.locator(".hdr-btn", { hasText: PROMPTS_BUTTON }).click();
    const items = page.locator(".pe-item");
    await expect(items).toHaveCount(4, { timeout: 60_000 });
    await expect(items.first()).toContainText("Best rechargeable headlamp for backpacking and hiking");
    await expect(items.nth(3)).toContainText("Fact check");
    await expect(items.nth(3)).toContainText("Rotating catalog fact check, slot A: a different catalog product each run");
    await expect(items.nth(3)).not.toContainText("ai_probe_plan");
    await expect(page.locator("[data-prompt-search-count]")).toHaveText("4 of 4 prompts");
    await expect(page.locator(".pe-sub").first()).toContainText("4 active.");
    await page.locator('[data-prompt-search] input[type="search"]').fill("flashlight");
    await expect(page.locator("[data-prompt-search-count]")).toHaveText("2 of 4 prompts");
    await expectViewOnly(page);
    expect(fenderListRead).toBe(false);
  });

  test("when Ledlenser's view cannot be read its Prompts screen says so", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route("**/rest/v1/canvas_ai_prompts*", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "42P01", message: 'relation "ledlenser.canvas_ai_prompts" does not exist' }),
      }),
    );
    await page.goto(url("ledlenser", ""));
    await page.locator(".hdr-btn", { hasText: PROMPTS_BUTTON }).click();
    await expect(page.locator(".pe-banner-error")).toHaveText("The prompt list could not be read.", { timeout: 60_000 });
    await expect(page.locator(".pe-item")).toHaveCount(0);
  });

  test("Ledlenser's prompt CSV holds its own battery once the view is applied (live)", async ({ page }) => {
    test.setTimeout(120_000);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    test.skip(!base || !key, "No Supabase URL or key in this environment.");
    const probe = await page.request.get(`${base}/rest/v1/canvas_ai_prompts?select=prompt_key&limit=1`, {
      headers: { apikey: key!, Authorization: `Bearer ${key}`, "Accept-Profile": "ledlenser" },
    });
    test.skip(!probe.ok(), "ledlenser.canvas_ai_prompts is not applied yet.");
    await page.goto(url("ledlenser", ""));
    await page.locator(".hdr-btn", { hasText: PROMPTS_BUTTON }).click();
    await expect(page.locator(".pe-item").first()).toBeVisible({ timeout: 60_000 });
    const asked = Number(await page.locator("[data-prompt-search-count]").getAttribute("data-prompt-search-count"));
    const lines = await downloadLines(page, "prompts");
    expect(lines[4]).toBe("Prompt key,Category,Kind,Prompt,Status");
    const keys = lines.slice(5).map((line) => line.split(",")[0]);
    expect(keys.every((k) => /^l\d+$/.test(k))).toBe(true);
    expect(keys.length).toBeGreaterThanOrEqual(asked);
  });
});
