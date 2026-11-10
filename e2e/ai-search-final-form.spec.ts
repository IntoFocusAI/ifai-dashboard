import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/* Worker 24.4, AI Search Visibility final form, on the live read for both clients:
   the Ledlenser window (defect), N of M catalog products on every engine choice (A-05),
   the decided names on the map (X-18), downloads that follow the date pill (X-10, X-33),
   and the prompt change history (A-08, with the read function mocked). */

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
      for (const gone of ["not inside unbranded discovery", "Not in either rate above", "not counted as wins"]) {
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
      // The catalog lead sits above Accuracy.
      const catalogTop = (await lead.boundingBox())!.y;
      const accuracyTop = (await page.locator("[data-ai-accuracy-figure]").boundingBox())!.y;
      expect(catalogTop).toBeLessThan(accuracyTop);
      await expect(page.locator("[data-ai-accuracy-figure-col] [data-status]")).toHaveText(/^(Poor|Fair|Good)$/);
      await expect(page.locator("[data-ai-fact-fixed-only]")).toHaveCount(0);

      const all = await figure.textContent();
      const total = all!.split(" of ")[1];
      if (client === "fender") {
        // Fender has API engines. They ask the fixed questions only, so the lead reads 0 of M there.
        await page.locator("[data-ai-engine-choice='search']").click();
        await expect(figure).toHaveText(all!);
        await page.locator("[data-ai-engine-choice='api']").click();
        await expect(figure).toHaveText(`0 of ${total}`);
        await expect(tip).toHaveAttribute("data-ifai-tooltip-desc", /^No engine in this engine choice asks the rotating catalog questions/);
      } else {
        await expect(page.locator("[data-ai-engine-switch='unavailable']")).toBeVisible();
      }
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
      expect(lines[4]).toBe("Engine,Model,Unbranded discovery,Branded consideration,No leader,Errors");
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

const EDITS = [
  {
    id: "6c0e1b2a-4d5f-4a6b-8c7d-111111111111",
    edited_at: "2026-11-04T13:27:19.699Z",
    action: "edit",
    prompt_key: "p01",
    before: { prompt_text: "Best electric guitar under $900", category: "electrics" },
    after: { prompt_text: "Best electric guitar under $900 for versatile tones", category: "electrics" },
  },
  {
    id: "6c0e1b2a-4d5f-4a6b-8c7d-222222222222",
    edited_at: "2026-10-27T18:40:00.000Z",
    action: "add",
    prompt_key: "p01",
    before: null,
    after: { prompt_text: "Best electric guitar under $900", category: "electrics", prompt_kind: "commercial", active: true },
  },
];

test.describe("Prompts change history (A-08)", () => {
  test.beforeEach(async ({ page }) => guest(page));

  test("each prompt opens its stored changes once the read function exists", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route("**/rest/v1/rpc/ai_prompt_edits_list*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EDITS) }),
    );
    await page.goto("/dashboard");
    await page.locator(".hdr-btn", { hasText: "Prompts" }).click();
    const toggle = page.locator("[data-prompt-history-toggle='p01']");
    await expect(toggle).toHaveText("Show history · 2 changes", { timeout: 60_000 });
    await expect(page.locator("[data-prompt-history-toggle='p02']")).toHaveText("Show history · No changes");
    await expect(page.locator("[data-prompt-history-status]")).toHaveCount(0);
    await toggle.click();
    const history = page.locator("[data-prompt-history='p01']");
    await expect(history).toContainText("A run keeps the questions it asked. A later edit does not change that run.");
    const rows = history.locator('[data-table-id="prompt-history"] tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Nov 4, 2026, 1:27 PM UTC");
    await expect(rows.first()).toContainText("Edited");
    await expect(rows.first()).toContainText("Best electric guitar under $900 for versatile tones");
    await expect(rows.nth(1)).toContainText("Added");
    await expect(history.locator('[data-table-search="prompt-history"]')).toBeVisible();
    await expect(history.locator('[data-table-download="prompt-history"]')).toBeVisible();
    await expect(toggle).toHaveText("Hide history · 2 changes");
  });

  test("until the read function is applied the screen says so once, and shows no history rows", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route("**/rest/v1/rpc/ai_prompt_edits_list*", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST202",
          message: "Could not find the function public.ai_prompt_edits_list(p_prompt_key) in the schema cache",
        }),
      }),
    );
    await page.goto("/dashboard");
    await page.locator(".hdr-btn", { hasText: "Prompts" }).click();
    const notice = page.locator("[data-prompt-history-status='missing']");
    await expect(notice).toHaveText("Change history: Not available*", { timeout: 60_000 });
    await expect(notice.locator(".ifai-term")).toHaveAttribute("data-ifai-tooltip-desc", /not applied to the database yet/);
    await expect(notice.locator(".ifai-term")).not.toHaveAttribute("title", /.*/);
    await expect(page.locator(".pe-item").first()).toBeVisible();
    await expect(page.locator("[data-prompt-history-toggle]")).toHaveCount(0);
    await expect(page.locator("[data-prompt-history]")).toHaveCount(0);
  });

  test("Ledlenser has no prompt editor, so its prompt list stays read-only", async ({ page }) => {
    await page.goto("/dashboard?client=ledlenser");
    await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".hdr-btn", { hasText: "Prompts" })).toHaveCount(0);
  });
});
