import type { Page } from "@playwright/test";
import { Canvas, expect, test as base } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

/** FDD X-13: one failed read leaves the map standing; its figures read Not available*. */

const BUNDLE_READS = [
  "canvas_metrics",
  "canvas_ai_category",
  "canvas_ai_engine",
  "canvas_competitor_sov",
  "canvas_divisions",
  "canvas_spec_missing_fields",
  "canvas_freshness",
];

/** Reads outside the bundle that also feed the map: retail, AI Search, Findability, pages. */
const SEPARATE_READS = [
  "canvas_retail_listings",
  "canvas_ai_current_run",
  "canvas_ai_probes",
  "canvas_spec_findability",
  "canvas_spec_readiness",
  "canvas_listing_content",
];

const forced: string[] = [];

/**
 * Every Supabase call answers from the shared mock, so only the forced read fails and a
 * slow live database cannot. The canvas is not opened here: each test forces its read
 * first, then loads the page. The 500s this spec forces are expected console noise;
 * anything else still fails.
 */
const test = base.extend<{ pageErrors: string[]; canvas: Canvas }>({
  canvas: async ({ page, pageErrors, setAsides }, provide) => {
    void pageErrors;
    void setAsides;
    await page.context().addCookies([
      { name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" },
    ]);
    await mockCanvasRead(page);
    await provide(new Canvas(page));
  },
  pageErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const url = message.location().url;
      if (forced.some((table) => url.includes(`/rest/v1/${table}`))) return;
      errors.push(`console: ${message.text()} ${url}`);
    });
    await provide(errors);
    forced.length = 0;
    expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
  },
});

async function failReads(page: Page, tables: string[]) {
  forced.push(...tables);
  for (const table of tables) {
    await page.route(new RegExp(`/rest/v1/${table}(\\?|$)`), (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ code: "XX000", message: `forced ${table} failure` }),
      }),
    );
  }
}

/** A cold dev server can take a while to compile and answer the first canvas load. */
const FIRST_LOAD_MS = 30_000;

async function expectMap(page: Page) {
  await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: FIRST_LOAD_MS });
  await expect(page.locator('[data-graph-node-id="hub"]')).toBeVisible();
  await expect(page.locator('[data-graph-node-id="spoke-specs"]')).toBeVisible();
  await expect(page.getByText("Could not load live canvas data")).toHaveCount(0);
}

test.describe("a failed read keeps the map", () => {
  test("canvas_divisions failing: map renders and the division figures read Not available*", async ({
    canvas,
    page,
  }, testInfo) => {
    await failReads(page, ["canvas_divisions"]);
    await page.goto("/dashboard?spoke=hub&tab=performance");
    await expectMap(page);
    await expect(canvas.panel).toBeVisible();
    await expect(canvas.activeTab).toContainText("Performance");

    const box = canvas.panel.locator('[data-read-unavailable-box="canvas_divisions"]');
    await expect(box).toContainText("FMIC Catalog Division Performance Matrix");
    const mark = box.locator('.ifai-term[data-read-unavailable="canvas_divisions"]');
    await expect(mark).toHaveText("Not available*");
    await expect(mark).toHaveAttribute("data-ifai-tooltip-desc", /\(canvas_divisions\) did not load/);
    await expect(mark).not.toHaveAttribute("title");
    await expect(canvas.panel).not.toContainText(/\b0 divisions\b/);

    const desc = page.locator(".drilldown-desc");
    await expect(desc.locator('[data-read-unavailable="canvas_divisions"]')).toHaveText("Not available*");

    await expect(canvas.panel.getByText("Loading AI Consensus scores")).toHaveCount(0, { timeout: FIRST_LOAD_MS });
    const tooltip = page.locator(".node-tooltip-definition");
    // A tab re-render under a resting pointer sends no new pointerover, so point again.
    await expect(async () => {
      await page.mouse.move(0, 0);
      await mark.hover();
      await expect(tooltip).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(tooltip).toContainText("canvas_divisions");
    await expect(tooltip).toHaveCSS("opacity", "1");

    await page.screenshot({ path: testInfo.outputPath("failed-division-read.png") });
  });

  for (const table of [...BUNDLE_READS, ...SEPARATE_READS]) {
    test(`${table} failing alone leaves the map on screen`, async ({ canvas, page }) => {
      void canvas;
      await failReads(page, [table]);
      await page.goto("/dashboard");
      await expectMap(page);
      await expect(page.locator(".graph-node")).not.toHaveCount(0);
    });
  }

  test("every bundle read failing still shows the full error", async ({ canvas, page }) => {
    void canvas;
    await failReads(page, BUNDLE_READS);
    await page.goto("/dashboard");
    await expect(page.getByText("Could not load live canvas data")).toBeVisible({ timeout: FIRST_LOAD_MS });
  });
});
