import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead, SPEC_ROWS, type Row } from "./spec-read-mock";

const NO_TIME = "The Amazon listing check has no check time recorded for any listing whose Amazon page was checked.";

/**
 * FDD D-04. Amazon Specs shows Last checked with its heroes before any box opens:
 * the newest stored check among listings whose Amazon page was read, in UTC.
 * An unchecked listing does not set it.
 */

const CHECKED_AT = [
  "2026-10-02T08:03:00+00:00",
  "2026-10-13T18:04:08+00:00",
  "2026-10-07T23:01:30+00:00",
  "2026-10-05T12:00:00+00:00",
];

const UNCHECKED_LATER: Row = {
  asin: "B00NOTREAD",
  title: "Unread Amazon Page",
  amazon_completeness_pct: null,
  amazon_checked: false,
  amazon_fields_found: null,
  amazon_fields_expected: null,
  amazon_missing_fields: "",
  fender_found: false,
  fender_missing_fields: null,
  fender_url: null,
  checked_at: "2026-11-01T12:00:00+00:00",
};

/** Serves the Amazon Specs rows with stored check times. Registered after the shared mock, so it wins. */
async function serveSpecRows(page: Page, rows: Row[]) {
  await page.route("**/rest/v1/canvas_spec_readiness**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : `*/0`,
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
      },
      body: JSON.stringify(rows),
    });
  });
}

async function openAmazonSpecs(page: Page, canvas: Canvas) {
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await canvas.openTab("Amazon Specs");
}

test("Amazon Specs shows Last checked beside its heroes, from checked listings only", async ({ page }) => {
  await mockCanvasRead(page);
  await serveSpecRows(page, [
    ...SPEC_ROWS.map((row, index) => ({ ...row, checked_at: CHECKED_AT[index] })),
    UNCHECKED_LATER,
  ]);
  const canvas = new Canvas(page);
  await openAmazonSpecs(page, canvas);

  const lead = page.locator("[data-amazon-specs-lead]");
  const line = lead.locator("[data-amazon-specs-last-checked]");
  await expect(line).toHaveText("Last checked Oct 13, 2026, 6:04 PM UTC.");
  await expect(line).toHaveAttribute("data-amazon-specs-last-checked", "2026-10-13T18:04:08.000Z");
  await expect(line).toBeInViewport();
  await expect(page.locator("[data-amazon-specs-hero-col]")).toContainText("Last checked");
  const term = lead.locator("[data-amazon-specs-hero='amazon_completeness'] .ifai-term").first();
  await expect(term).toHaveAttribute("data-ifai-tooltip-desc", /averaged across the Amazon listings of the 4 checked SKUs\./);
  await expect(term).toHaveAttribute("data-ifai-tooltip-desc", /Last checked Oct 13, 2026, 6:04 PM UTC\./);
  await expect(term).not.toHaveAttribute("data-ifai-tooltip-desc", /spec read|older|stored/);

  // Nothing had to open for it, and the heroes and table read the same rows.
  await expect(page.locator("[data-spec-missing-fields-toggle]")).toHaveAttribute("data-spec-missing-fields-toggle", "preview");
  await expect(page.locator("#spec-readiness-by-asin .content-box-title .tag-badge")).toHaveText("5 rows");
  await expect(lead.locator("[data-amazon-specs-hero]").first()).toBeVisible();
});

test("Amazon Specs reads Last checked Not available* when no checked listing has a time", async ({ page }) => {
  await mockCanvasRead(page);
  await serveSpecRows(page, [
    ...SPEC_ROWS.map((row) => ({ ...row, checked_at: null })),
    UNCHECKED_LATER,
  ]);
  const canvas = new Canvas(page);
  await openAmazonSpecs(page, canvas);

  const line = page.locator("[data-amazon-specs-last-checked]");
  await expect(line).toHaveText("Last checked Not available*");
  await expect(line).toHaveAttribute("data-amazon-specs-last-checked", "");
  const term = line.locator(".ifai-term");
  await expect(term).toHaveText("Not available*");
  await expect(term).toHaveAttribute("data-ifai-tooltip-desc", NO_TIME);
  await expect(term).not.toHaveAttribute("title");
  await term.hover();
  await expect(page.locator(".node-tooltip.node-tooltip-definition.visible")).toContainText(
    NO_TIME,
  );
});
