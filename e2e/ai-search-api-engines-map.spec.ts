import { Canvas, expect, test as base } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";
import { disableApiViews, enableApiViews, mockAiSearchWithApi } from "./api-engines-mock";

/**
 * FDD A-02: the map's AI Search bubbles show the published run with the counted API run nearest
 * its day, the same figure AI Search shows for that run on All. Mocked reads (api-engines-mock.ts):
 * published Nov 3 search run, a counted Nov 2 API run with repeats past the cap, and a
 * one-question smoke test on Nov 3 that does not count.
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

test("the AI Search bubble adds the Nov 2 API run and matches AI Search on All for the published run", async ({ canvas, page }) => {
  await enableApiViews(page);
  await mockAiSearchWithApi(page);
  await canvas.open();

  // 3 of 4 search leads plus 2 of 4 API leads (repeats 1 to 3). The smoke test is left out.
  const bubble = canvas.bubble("spoke-aeo");
  // The mocked run is past its check schedule, so the bubble carries the stale asterisk (X-25).
  await expect(bubble.locator(".node-hero-value")).toHaveText(/^62\.5%\*?$/);
  await bubble.hover({ force: true });
  await canvas.bubble("spoke-competitors").hover({ force: true });
  await page.waitForTimeout(400);
  await expect(page.locator(".node-tooltip", { hasText: /\S/ })).toHaveCount(0);

  await canvas.openSpokeFromMap("AI Search Visibility");
  await page.locator("[data-ai-history-trigger]").click();
  await page.locator("[data-ai-history-day='2026-11-03']").click();
  await expect(page.locator("[data-ai-engine-choice='all']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-ai-win-rate='unbranded_discovery']")).toHaveText("62.5%");
});

test("with the API reads off the bubble shows the published run alone", async ({ canvas, page }) => {
  await disableApiViews(page);
  await mockAiSearchWithApi(page);
  await canvas.open();

  const bubble = canvas.bubble("spoke-aeo");
  await expect(bubble.locator(".node-hero-value")).toHaveText(/^75\.0%\*?$/);
  await bubble.hover({ force: true });
  await page.waitForTimeout(400);
  await expect(page.locator(".node-tooltip", { hasText: "Includes API engines" })).toHaveCount(0);
});

test("with the API views missing the bubble shows the published run alone", async ({ canvas, page }) => {
  await enableApiViews(page);
  await mockAiSearchWithApi(page, { apiViews: "missing" });
  await canvas.open();

  const bubble = canvas.bubble("spoke-aeo");
  await expect(bubble.locator(".node-hero-value")).toHaveText(/^75\.0%\*?$/);
  await bubble.hover({ force: true });
  await page.waitForTimeout(400);
  await expect(page.locator(".node-tooltip", { hasText: "Includes API engines" })).toHaveCount(0);
});
