import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { MISSING_FIELD_ROWS, mockCanvasRead } from "./spec-read-mock";

/**
 * The AI Readiness bubble keeps its name. Its satellites and tabs share
 * Amazon Specs / Brand-Site Specs. A link copied from an earlier tab title
 * still opens the renamed tab.
 */

const TAB_NAMES = ["Findability", "Amazon Specs", "Brand-Site Specs", "Amazon A+ Matrix"];

/** Bubble titles are drawn as separate SVG lines, so the DOM text has no space. */
function mapNode(page: Page, title: string) {
  const escaped = title
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
  return page.locator(".graph-node").filter({ hasText: new RegExp(escaped, "i") });
}

async function openAmazonSpecs(page: Page) {
  const canvas = new Canvas(page);
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(canvas.panel).toBeVisible();
  await canvas.openTab("Amazon Specs");
  return canvas;
}

test("the bubble, its satellites, and its tabs share one set of names", async ({ page }) => {
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  await canvas.open();

  await expect(mapNode(page, "AI Readiness")).toHaveCount(1);
  await expect(mapNode(page, "Findability")).toHaveCount(1);
  await expect(mapNode(page, "Brand-Site Specs")).toHaveCount(1);
  await expect(mapNode(page, "Amazon A+ Matrix")).toHaveCount(1);
  await expect(mapNode(page, "Machine Readability")).toHaveCount(0);
  await expect(mapNode(page, "Schema.org")).toHaveCount(0);
  await expect(mapNode(page, "A+ Tables")).toHaveCount(0);

  await expect(async () => {
    await mapNode(page, "AI Readiness").click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator(".drilldown-tabs .drilldown-tab-btn")).toHaveText(TAB_NAMES);
  await expect(canvas.activeTab).toHaveText("Brand-Site Specs");
});

test("each satellite opens the tab that carries its name", async ({ page }) => {
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  await canvas.open();

  /* Satellites only take clicks while their parent cluster is revealed, and the
     map collapses to a spoke column once a panel is open, so each satellite is
     reached from a fresh map by hovering AI Readiness first. */
  for (const satellite of ["Findability", "Brand-Site Specs", "Amazon A+ Matrix"]) {
    await page.goto("/dashboard");
    await expect(page.locator(".ifai-canvas.panel-hidden")).toHaveCount(1);
    await expect(async () => {
      await mapNode(page, "AI Readiness").hover({ force: true });
      await expect(page.locator(".satellite-group.visible")).toHaveCount(1, { timeout: 2000 });
      await mapNode(page, satellite).click({ force: true });
      await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    await expect(canvas.activeTab).toHaveText(satellite);
  }
});

test("a link copied from an earlier tab title still opens the same tab", async ({ page }) => {
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  await canvas.open();

  const aliases: Array<[string, string]> = [
    ["catalog-readiness-executive-guide", "Amazon Specs"],
    ["ai-readiness", "Amazon Specs"],
    ["machine-readable-schema-org-json-ld-audit", "Brand-Site Specs"],
    ["machine-readability", "Brand-Site Specs"],
    ["amazon-a-comparison-matrix-blueprint", "Amazon A+ Matrix"],
  ];

  for (const [slug, tab] of aliases) {
    await page.goto(`/dashboard?spoke=specs&tab=${slug}`);
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
    await expect(canvas.activeTab).toHaveText(tab);
  }
});

test("Amazon Specs opens on Amazon fields and the title chevron reveals the rest", async ({ page }) => {
  await mockCanvasRead(page);
  await openAmazonSpecs(page);

  const amazonFieldCount = MISSING_FIELD_ROWS.filter(
    (row) => String(row.source).toLowerCase() === "amazon",
  ).length;

  const fields = page.locator("#spec-missing-fields > div");
  await expect(fields).toHaveCount(2);
  // Plain field names, not stored keys.
  await expect(fields.first()).toContainText("Scale length");
  await expect(fields.first()).not.toContainText("scale_length");
  await expect(fields.nth(1)).toContainText("Neck");
  // sku_count is of the same checked listings as METRICS.spec_checked (4).
  await expect(fields.first().locator("[data-spec-missing-count]")).toHaveText("3 of 4 (75.0%)");
  await expect(fields.nth(1).locator("[data-spec-missing-count]")).toHaveText("2 of 4 (50.0%)");
  await expect(fields.first()).toHaveAttribute("data-spec-missing-share", "share");
  await expect(fields.first().locator(".readiness-progress-fill")).toHaveAttribute(
    "style",
    /width:\s*75%/,
  );
  await expect(page.locator("#spec-missing-fields")).not.toContainText("additionalProperty");
  await expect(page.locator("#spec-missing-fields")).not.toContainText("SKUs");
  await expect(page.locator("#spec-missing-fields")).toHaveClass(/spec-missing-fields-preview/);
  await expect(page.getByText(/Show all/)).toHaveCount(0);

  const reveal = page.locator("[data-spec-missing-fields-toggle]");
  await expect(reveal).toHaveAttribute("aria-expanded", "false");
  await expect(reveal).toHaveAttribute(
    "aria-label",
    `Show all ${amazonFieldCount} missing Amazon fields`,
  );
  await reveal.click();
  await expect(reveal).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#spec-missing-fields")).not.toHaveClass(/spec-missing-fields-preview/);
  await expect(fields).toHaveCount(amazonFieldCount);
  await expect(fields.last()).toContainText("pickup_configuration");
  await expect(fields.last().locator("[data-spec-missing-count]")).toHaveText("1 of 4 (25.0%)");

  await reveal.click();
  await expect(reveal).toHaveAttribute("aria-expanded", "false");
  await expect(fields).toHaveCount(2);
  await expect(page.locator("#spec-missing-fields")).toHaveClass(/spec-missing-fields-preview/);
});

test("Amazon Specs shows Amazon completeness only, with no fender.com page-found figure", async ({
  page,
}) => {
  await mockCanvasRead(page);
  await openAmazonSpecs(page);

  const lead = page.locator("[data-amazon-specs-lead]");
  await expect(lead).toBeVisible();
  await expect(page.locator(".spec-summary")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Metric" })).toHaveCount(0);
  await expect(page.locator("[data-spec-filter]")).toHaveCount(0);
  await expect(page.locator(".spec-found-pill")).toHaveCount(0);

  await expect(page.locator("[data-ai-readiness-hero]")).toHaveCount(1);
  const amazon = page.locator("[data-ai-readiness-hero='amazon_completeness']");
  await expect(amazon.locator("[data-ai-readiness-hero-percent]")).toHaveText(/^48\.8%\*?$/);
  await expect(amazon.locator("[data-ai-readiness-hero-ratio]")).toHaveText("26 of 52 (48.8%)");
  await expect(amazon.locator("[data-ai-readiness-hero-ratio]")).not.toContainText(/Across/i);
  await expect(amazon.locator("span.ifai-term")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /averaged across the Amazon listings of the 4 checked SKUs/i,
  );
  await expect(amazon.locator("span.ifai-term")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /average per listing, not the share of listings with every field filled/i,
  );

  await expect(page.locator("[data-ai-readiness-hero='page_found']")).toHaveCount(0);
  await expect(page.locator("[data-ai-readiness-hero='fender_completeness']")).toHaveCount(0);
  await expect(page.locator("[data-ai-readiness-hero='missing_additional_property']")).toHaveCount(0);
  await expect(lead).not.toContainText("fender.com page found");
  await expect(lead).not.toContainText("fender.com completeness");
  await expect(page.locator(".ai-readiness-lead-note")).toHaveCount(0);

  const catalog = page.locator("#spec-readiness-by-asin");
  await expect(catalog).toContainText("B00MISSING");
  await expect(catalog).toContainText("B00FOUND01");
  await expect(catalog).toContainText("B00NULLFLG");
  await expect(catalog.getByRole("columnheader", { name: "fender.com found" })).toHaveCount(0);
  await expect(catalog.getByRole("columnheader", { name: "Amazon completeness" })).toHaveCount(1);
  await expect(catalog.getByRole("columnheader", { name: "Missing Amazon fields" })).toHaveCount(1);
});

test("Amazon Specs puts Top missing fields beside the completeness hero", async ({ page }) => {
  await mockCanvasRead(page);
  await openAmazonSpecs(page);

  const band = page.locator("[data-amazon-specs-band]");
  const hero = page.locator("[data-ai-readiness-hero='amazon_completeness']");
  const fieldsBox = page.locator("[data-spec-missing-fields-box]");
  const table = page.locator("#spec-readiness-by-asin");

  await expect(band).toBeVisible();
  await expect(hero).toBeVisible();
  await expect(fieldsBox).toBeVisible();
  await expect(fieldsBox.locator("[data-spec-missing-count]").first()).toHaveText("3 of 4 (75.0%)");

  const desktop = await page.evaluate(() => {
    const bandEl = document.querySelector("[data-amazon-specs-band]");
    const heroEl = document.querySelector("[data-ai-readiness-hero='amazon_completeness']");
    const fieldsEl = document.querySelector("[data-spec-missing-fields-box]");
    const tableEl = document.querySelector("#spec-readiness-by-asin");
    const percentEl = heroEl?.querySelector("[data-ai-readiness-hero-percent]");
    const pieEl = heroEl?.querySelector(".citation-pie-disc");
    const barEl = fieldsEl?.querySelector(".readiness-progress-bar");
    if (!bandEl || !heroEl || !fieldsEl || !tableEl || !percentEl || !pieEl || !barEl) return null;
    const band = bandEl.getBoundingClientRect();
    const h = heroEl.getBoundingClientRect();
    const f = fieldsEl.getBoundingClientRect();
    const t = tableEl.getBoundingClientRect();
    const percent = percentEl.getBoundingClientRect();
    const pie = pieEl.getBoundingClientRect();
    const bar = barEl.getBoundingClientRect();
    return {
      heroRight: h.right,
      heroWidth: h.width,
      bandWidth: band.width,
      fieldsLeft: f.left,
      fieldsWidth: f.width,
      barWidth: bar.width,
      heroTop: h.top,
      heroBottom: h.bottom,
      fieldsTop: f.top,
      fieldsBottom: f.bottom,
      tableTop: t.top,
      sideBySide: f.left >= h.right - 2 && f.top < h.bottom && h.top < f.bottom,
      tableBelow: t.top >= Math.max(h.bottom, f.bottom) - 2,
      // Pie beside the percentage: pie top must not sit below the percent bottom.
      pieBesidePercent: pie.top < percent.bottom && pie.left >= percent.left,
      ratioText: heroEl.querySelector("[data-ai-readiness-hero-ratio]")?.textContent ?? "",
      pieHeight: pie.height,
      heroHeight: h.height,
    };
  });
  expect(desktop).not.toBeNull();
  expect(desktop!.sideBySide).toBe(true);
  expect(desktop!.tableBelow).toBe(true);
  expect(desktop!.fieldsLeft).toBeGreaterThan(desktop!.heroRight - 2);
  expect(desktop!.pieBesidePercent).toBe(true);
  expect(desktop!.ratioText).toMatch(/^\d[\d,]* of \d[\d,]* \(/);
  expect(desktop!.ratioText).not.toMatch(/^Across\b/);
  // Content-sized hero; missing-fields box is the wider of the two.
  expect(desktop!.heroWidth).toBeLessThan(desktop!.fieldsWidth);
  expect(desktop!.heroWidth).toBeLessThan(desktop!.bandWidth * 0.55);
  // Pie nearly as tall as the card (padding leaves a small margin).
  expect(desktop!.pieHeight).toBeGreaterThanOrEqual(70);
  expect(desktop!.pieHeight).toBeGreaterThan(desktop!.heroHeight * 0.45);
  // Missing-field bar track is shorter than the fields box.
  expect(desktop!.barWidth).toBeLessThanOrEqual(180);
  expect(desktop!.barWidth).toBeLessThan(desktop!.fieldsWidth * 0.6);

  // The drilldown panel keeps a wide floor when the viewport shrinks. Constrain the
  // band itself to prove flex-wrap stacks the fields under the hero without overlap.
  await page.evaluate(() => {
    const band = document.querySelector<HTMLElement>("[data-amazon-specs-band]");
    if (!band) return;
    band.style.width = "360px";
    band.style.maxWidth = "360px";
  });
  const narrow = await page.evaluate(() => {
    const heroEl = document.querySelector("[data-ai-readiness-hero='amazon_completeness']");
    const fieldsEl = document.querySelector("[data-spec-missing-fields-box]");
    const tableEl = document.querySelector("#spec-readiness-by-asin");
    const percentEl = heroEl?.querySelector("[data-ai-readiness-hero-percent]");
    const pieEl = heroEl?.querySelector(".citation-pie-disc");
    if (!heroEl || !fieldsEl || !tableEl || !percentEl || !pieEl) return null;
    const h = heroEl.getBoundingClientRect();
    const f = fieldsEl.getBoundingClientRect();
    const t = tableEl.getBoundingClientRect();
    const percent = percentEl.getBoundingClientRect();
    const pie = pieEl.getBoundingClientRect();
    return {
      wrapped: f.top >= h.bottom - 2,
      noOverlap: f.top >= h.bottom - 2,
      tableBelow: t.top >= Math.max(h.bottom, f.bottom) - 2,
      tableWidth: t.width,
      fieldsWidth: f.width,
      pieBesidePercent: pie.top < percent.bottom && pie.left >= percent.left,
    };
  });
  expect(narrow).not.toBeNull();
  expect(narrow!.wrapped).toBe(true);
  expect(narrow!.noOverlap).toBe(true);
  expect(narrow!.tableBelow).toBe(true);
  expect(narrow!.tableWidth).toBeGreaterThan(200);
  expect(narrow!.fieldsWidth).toBeLessThanOrEqual(360);
  expect(narrow!.pieBesidePercent).toBe(true);
  await expect(table).toBeVisible();
});

test("Brand-Site Specs leads with page found and missing machine-readable specs, and no Amazon percentage", async ({
  page,
}) => {
  await mockCanvasRead(page);
  const canvas = new Canvas(page);
  // Wide desktop panel: same top-band lead as Amazon A+ Matrix.
  await page.goto("/dashboard?spoke=specs&tab=brand-site-specs&layout=wide");
  await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
  await expect(canvas.activeTab).toHaveText("Brand-Site Specs");

  const pageFound = page.locator("[data-machine-hero='page_found']");
  await expect(pageFound.locator("[data-hero-percent]")).toHaveText(/^50\.0%\*?$/);
  await expect(pageFound).toContainText("2 of 4");

  const missing = page.locator("[data-machine-hero='missing_specs']");
  await expect(missing).toBeVisible();
  await expect(missing.locator("[data-hero-percent]")).toHaveText(/^50\.0%\*?$/);
  await expect(missing).toContainText("1 of 2");
  await expect(missing).toContainText("Found pages missing machine-readable specs");
  await expect(missing).not.toContainText("additionalProperty");
  await expect(missing).toContainText("spec block");

  const lead = page.locator("[data-brand-site-specs-lead]");
  const pageFoundBox = lead.locator("[data-machine-hero='page_found']");
  const missingBox = lead.locator("[data-machine-hero='missing_specs']");
  const basicsBox = lead.locator("[data-machine-hero='product_basics']");
  const notes = lead.locator("[data-brand-site-specs-notes]");
  await expect(pageFoundBox).toBeVisible();
  await expect(missingBox).toBeVisible();
  await expect(basicsBox).toBeVisible();
  await expect(notes).toBeVisible();
  const rect = (el: Element) => {
    const box = el.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, right: box.right, left: box.left };
  };
  // The panel widens as it opens; read the band once it settles.
  await expect(async () => {
    const band = await Promise.all([
      pageFoundBox.evaluate(rect),
      missingBox.evaluate(rect),
      basicsBox.evaluate(rect),
      notes.evaluate(rect),
    ]);
    // The three heroes share one row, page found first.
    expect(Math.abs(band[0].top - band[1].top)).toBeLessThan(8);
    expect(Math.abs(band[0].top - band[2].top)).toBeLessThan(8);
    expect(band[0].right).toBeLessThanOrEqual(band[1].left + 1);
    expect(band[1].right).toBeLessThanOrEqual(band[2].left + 1);
    // The explainer sits to their right when the panel has room, otherwise just below them.
    const besideHeroes = Math.abs(band[0].top - band[3].top) < 8 && band[2].right <= band[3].left + 1;
    const belowHeroes = band[3].top >= Math.max(band[0].bottom, band[1].bottom, band[2].bottom) - 1;
    expect(besideHeroes || belowHeroes).toBe(true);
  }).toPass({ timeout: 10_000 });

  await expect(page.locator("[data-ai-readiness-hero='amazon_completeness']")).toHaveCount(0);
  await expect(lead).not.toContainText("Amazon attribute completeness");
  await expect(page.locator("#spec-readiness-by-asin")).toHaveCount(0);
});
