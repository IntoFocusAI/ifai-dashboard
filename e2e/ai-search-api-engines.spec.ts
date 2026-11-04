import type { Page } from "@playwright/test";
import { Canvas, expect, test as base } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";
import { enableApiViews, mockAiSearchWithApi } from "./api-engines-mock";

/**
 * FDD A-02: API engines beside the search engines, behind an All / Without API / API only switch.
 * Every AI read is mocked (see api-engines-mock.ts). The canvas opens after the mocks are in place.
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
      if (message.type() !== "error") return;
      const url = message.location().url;
      // The "missing" test answers the API views with the database's 404 on purpose.
      if (url.includes("/rest/v1/canvas_ai_api_")) return;
      errors.push(`console: ${message.text()} ${url}`);
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

test.describe("API engines beside the search engines", () => {
  test.beforeEach(async ({ canvas, page }) => {
    await enableApiViews(page);
    await mockAiSearchWithApi(page);
    await canvas.open();
  });

  test("the switch starts on All and Run Details tags each row's engine group", async ({ canvas, page }) => {
    await canvas.openSimulations();
    const engineSwitch = page.locator("[data-ai-engine-switch='ready']");
    await expect(engineSwitch.locator(".segmented-btn")).toHaveText(["All", "Without API", "API only"]);
    await expect(choice(page, "all")).toHaveAttribute("aria-pressed", "true");
    await expect(engineSwitch.locator("[title]")).toHaveCount(0);

    // Shopping prompts: 4 search answers and 6 API calls, Crescent API's errors included.
    await expect(canvas.simulations).toHaveCount(10);
    await expect(page.locator("#ai-simulation-list td[data-engine-group='api']")).toHaveCount(6);
    await expect(page.locator("#ai-simulation-list td[data-engine-group='api'] .ai-engine-group-tag").first()).toHaveText("API");
    await expect(page.locator("#ai-simulation-list td[data-engine-group='search'] .ai-engine-group-tag").first()).toHaveText(
      "Search engine",
    );

    // All calls: 10 search calls less the 2 rotating fact checks, plus 12 API calls.
    await canvas.filterChip("All calls").click();
    await expect(canvas.simulations).toHaveCount(20);
    const rotating = canvas.simulations.filter({ hasText: "Nut width of the Fender American Professional II" });
    await expect(rotating).toHaveCount(0);

    await choose(page, "search");
    await expect(canvas.simulations).toHaveCount(10);
    await expect(rotating).toHaveCount(2);
    await expect(page.locator("#ai-simulation-list td[data-engine-group='api']")).toHaveCount(0);

    await choose(page, "api");
    await expect(canvas.simulations).toHaveCount(12);
    await expect(page.locator("#ai-simulation-list td[data-engine-group='search']")).toHaveCount(0);

    await expect(page.locator("[data-ai-history-trigger]")).toContainText("Last 30 days");
  });

  test("fact checks with API engines count the fixed questions and say so in the tooltip", async ({ canvas, page }) => {
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Product Fact Checks");
    const figure = page.locator("[data-ai-accuracy-figure]");
    const fixedOnly = page.locator("[data-ai-fact-fixed-only] .ifai-term");

    // All: 7 of 8 answered fixed checks matched. The rotating p35 checks sit out.
    await expect(figure).toHaveText("87.5% Accuracy*");
    await expect(fixedOnly).toHaveAttribute("data-ifai-tooltip-desc", /fact checks count the fixed questions only/);
    await expect(fixedOnly).toHaveAttribute("data-ifai-tooltip-desc", /10 of 12 fact-check calls are counted/);
    await expect(fixedOnly).not.toHaveAttribute("title", /.*/);
    await expect(page.locator("[data-ai-fact-headline]")).toContainText("1 of 8 answers contradicted");

    // Without API: the search run's six checks, rotating included.
    await choose(page, "search");
    await expect(figure).toHaveText("83.3% Accuracy");
    await expect(fixedOnly).toHaveCount(0);
    await expect(page.locator("[data-ai-fact-headline]")).toContainText("1 of 6 answers contradicted");

    await choose(page, "api");
    await expect(figure).toHaveText("75.0% Accuracy*");
    await expect(page.locator("[data-ai-fact-headline]")).toContainText("1 of 4 answers contradicted");
  });

  test("Engine Comparison lists API engines as their own rows and leaves out one that failed every call", async ({
    canvas,
    page,
  }) => {
    await canvas.openSpokeFromMap("Competitive Radar");
    await canvas.openTab("Engine Comparison");
    const rows = page.locator(".ai-engine-comparison tr[data-engine]");
    const lead = page.locator("[data-ai-competitor-desc]");

    await expect(rows).toHaveCount(4);
    await expect(page.locator(".ai-engine-comparison tr[data-engine='openai_api']")).toContainText("ChatGPT API");
    await expect(page.locator(".ai-engine-comparison tr[data-engine='openai_api']")).toHaveAttribute("data-engine-group", "api");
    await expect(page.locator(".ai-engine-comparison tr[data-engine='crescent_api']")).toHaveCount(0);
    await expect(lead).toContainText("Competitors led 3 of 8 resolved unbranded discovery answers.");

    await choose(page, "search");
    await expect(rows).toHaveCount(2);
    await expect(page.locator(".ai-engine-comparison tr[data-engine-group='api']")).toHaveCount(0);
    await expect(lead).toContainText("Competitors led 1 of 4 resolved unbranded discovery answers.");

    await choose(page, "api");
    await expect(rows).toHaveCount(2);
    await expect(page.locator(".ai-engine-comparison tr[data-engine='gemini_api']")).toContainText("50.0% (1 of 2)");
    await expect(lead).toContainText("Competitors led 2 of 4 resolved unbranded discovery answers.");

    // One switch: the choice made here holds on the AI Search tabs.
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Run Details");
    await expect(choice(page, "api")).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.simulations).toHaveCount(6);
  });
});

test.describe("before the API views are applied", () => {
  test("with the flag off nothing asks for the API views and the switch reads Not available*", async ({ canvas, page }) => {
    const seen = await mockAiSearchWithApi(page);
    await canvas.open();
    await canvas.openSimulations();
    const na = page.locator("[data-ai-engine-switch='unavailable'] [data-ai-engine-na='missing']");
    await expect(na).toContainText("Not available*");
    await expect(na.locator(".ifai-term")).toHaveAttribute("data-ifai-tooltip-desc", /not published to the dashboard yet/);
    await expect(choice(page, "all")).toHaveAttribute("aria-pressed", "true");
    await expect(choice(page, "api")).toBeDisabled();
    await expect(canvas.simulations).toHaveCount(4);
    await expect(page.locator("#ai-simulation-list .ai-engine-group-tag")).toHaveCount(0);
    expect(seen.filter((table) => table.startsWith("canvas_ai_api_"))).toEqual([]);
  });

  test("a missing view reads as Not available*, and the search figures stand", async ({ canvas, page }) => {
    await enableApiViews(page);
    const seen = await mockAiSearchWithApi(page, { apiViews: "missing" });
    await canvas.open();
    await canvas.openSpokeFromMap("AI Search Visibility");
    await canvas.openTab("Product Fact Checks");
    await expect(page.locator("[data-ai-engine-na='missing']")).toContainText("Not available*");
    await expect(page.locator("[data-ai-accuracy-figure]")).toHaveText("83.3% Accuracy");
    expect(seen).toContain("canvas_ai_api_runs");
  });
});
