import type { Page } from "@playwright/test";
import { Canvas, expect, test as base } from "./fixtures";
import { mockCanvasRead } from "./spec-read-mock";

/**
 * FDD X-13 on the AI Readiness tabs: a failed read keeps each box and reads Not available*
 * with that read named in its tooltip. Every other Supabase call answers from the shared
 * mock, so only the forced read fails. The forced 500s are expected console noise.
 */

const forced: string[] = [];

const test = base.extend<{ pageErrors: string[]; canvas: Canvas }>({
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
      if (forced.some((table) => url.includes(`/rest/v1/${table}`))) return;
      errors.push(`console: ${message.text()} ${url}`);
    });
    await provide(errors);
    forced.length = 0;
    expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
  },
});

async function failRead(page: Page, table: string) {
  forced.push(table);
  await page.route(new RegExp(`/rest/v1/${table}(\\?|$)`), (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ code: "XX000", message: `forced ${table} failure` }),
    }),
  );
}

const FIRST_LOAD_MS = 30_000;

async function openTab(page: Page, canvas: Canvas, tab: string, label: string) {
  await page.goto(`/dashboard?spoke=specs&tab=${tab}`);
  await expect(page.locator(".graph-node").first()).toBeVisible({ timeout: FIRST_LOAD_MS });
  await expect(page.getByText("Could not load live canvas data")).toHaveCount(0);
  await expect(canvas.activeTab).toContainText(label);
}

async function expectTooltip(page: Page, mark: ReturnType<Page["locator"]>, text: string) {
  const tooltip = page.locator(".node-tooltip.node-tooltip-definition.visible");
  await expect(async () => {
    await page.mouse.move(0, 0);
    await mark.hover();
    await expect(tooltip).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(tooltip).toContainText(text);
}

test("canvas_spec_missing_fields failing: Top missing Amazon fields stays and reads Not available*", async ({
  canvas,
  page,
}) => {
  await failRead(page, "canvas_spec_missing_fields");
  await openTab(page, canvas, "amazon-specs", "Amazon Specs");

  const box = canvas.panel.locator('[data-spec-missing-fields-box][data-read-unavailable-box="canvas_spec_missing_fields"]');
  await expect(box).toBeVisible();
  await expect(box).toContainText("Top missing Amazon fields");
  const mark = box.locator('.ifai-term[data-read-unavailable="canvas_spec_missing_fields"]');
  await expect(mark).toHaveText("Not available*");
  await expect(mark).toHaveAttribute(
    "data-ifai-tooltip-desc",
    "The missing spec field read (canvas_spec_missing_fields) did not load: forced canvas_spec_missing_fields failure.",
  );
  await expect(mark).not.toHaveAttribute("title");
  await expect(box.locator("[data-spec-missing-field]")).toHaveCount(0);
  await expect(canvas.panel.locator('[data-amazon-specs-hero="amazon_completeness"] [data-ai-readiness-hero-percent]')).toHaveText(
    "48.8%",
  );
  await expectTooltip(page, mark, "(canvas_spec_missing_fields) did not load");
});

test("canvas_metrics failing: Top missing Amazon fields keeps its counts and names the read on each share", async ({
  canvas,
  page,
}) => {
  await failRead(page, "canvas_metrics");
  await openTab(page, canvas, "amazon-specs", "Amazon Specs");

  const box = canvas.panel.locator("[data-spec-missing-fields-box]");
  const first = box.locator("[data-spec-missing-field]").first();
  await expect(first.locator("[data-spec-missing-count]")).toHaveText("3 checked listings · Not available*");
  const mark = first.locator('.ifai-term[data-read-unavailable="canvas_metrics"]');
  await expect(mark).toHaveAttribute("data-ifai-tooltip-desc", /^The catalog metrics read \(canvas_metrics\) did not load/);
  await expect(mark).not.toHaveAttribute("title");
  await expectTooltip(page, mark, "(canvas_metrics) did not load");
});

test("canvas_metrics failing: the Brand-Site Specs page-found hero names canvas_metrics", async ({ canvas, page }) => {
  await failRead(page, "canvas_metrics");
  await openTab(page, canvas, "brand-site-specs", "Brand-Site Specs");

  const hero = canvas.panel.locator("[data-machine-hero='page_found']");
  const figure = hero.locator(".ai-lead-figure.ifai-term");
  await expect(figure).toHaveText("Not available*");
  await expect(figure).toHaveAttribute("data-ifai-tooltip-desc", /^The catalog metrics read \(canvas_metrics\) did not load/);
  await expect(figure).not.toHaveAttribute("data-ifai-tooltip-desc", /stored|has not reported/);
  await expect(figure).not.toHaveAttribute("title");
  await expect(hero).toContainText("The checked-SKU counts did not load.");
  await expectTooltip(page, figure, "(canvas_metrics) did not load");
});
