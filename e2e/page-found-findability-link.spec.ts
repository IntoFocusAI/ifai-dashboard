import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead, SPEC_ROWS, type Row } from "./spec-read-mock";

/**
 * FDD D-08. On Brand-Site Specs, a not-found row's Findability result opens that
 * listing's row on the Findability tab: its outcome table open, its page shown, the
 * row in view and briefly highlighted. The mock has two not-found SKUs: B00MISSING
 * has a Findability row, B00NULLFLG has none. B00MISSING sits last among 30 finished
 * searches, so it is on the second page of 25.
 */

const FILLER: Row[] = Array.from({ length: 29 }, (_, index) => ({
  asin: `B00NP${String(index + 1).padStart(5, "0")}`,
  title: `No Page Filler ${index + 1}`,
  latest_state: "completed_not_found",
  counts_as_completed_not_found: true,
  counts_as_finished_search: true,
}));

const FINDABILITY: Row[] = [
  { asin: "B00FOUND01", title: "Found Strat", latest_state: "exact_official_product", counts_as_confirmed: true },
  ...FILLER,
  {
    asin: "B00MISSING",
    title: "Missing Page Guitar",
    latest_state: "completed_not_found",
    counts_as_completed_not_found: true,
    counts_as_finished_search: true,
  },
];

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openBrandSiteSpecs(page: Page, canvas: Canvas) {
  await canvas.open();
  await expect(async () => {
    await page.locator(".graph-node").filter({ hasText: /AI\s*Readiness/i }).click({ force: true });
    await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(canvas.activeTab).toContainText("Brand-Site Specs");
  await expect(page.locator("#brand-site-page-found-skus")).toHaveAttribute("data-page-found-table", "ready");
}

async function expectLandedOnMissing(page: Page, canvas: Canvas) {
  await expect(canvas.activeTab).toContainText("Findability");
  await expect(page.locator("[data-findability-outcome='completed_not_found'] button.findability-count")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const row = page.locator("#findability-listings tr[data-findability-asin='B00MISSING']");
  await expect(row).toBeVisible();
  await expect(row).toBeInViewport();
  await expect(page.locator("#findability-listings")).toContainText("26–30 of 30");
  return row;
}

test("a not-found row's Findability result opens that listing's row on the Findability tab", async ({ page }) => {
  const errors = watchErrors(page);
  await mockCanvasRead(page, { findability: FINDABILITY });
  const canvas = new Canvas(page);
  await openBrandSiteSpecs(page, canvas);

  const table = page.locator("#brand-site-page-found-skus");
  const missing = table.locator("[data-page-found-row='not_found'][data-asin='B00MISSING']");
  const link = missing.locator("button[data-page-found-findability-link='asin:B00MISSING']");
  await expect(link).toHaveText("No Defensible Page");
  await expect(link).toHaveAttribute("data-ifai-open", "specs");
  await expect(link).toHaveAttribute("data-ifai-tab", "Findability");
  await expect(link).toHaveAttribute("data-ifai-tooltip-desc", /Opens B00MISSING on the Findability tab/);
  await expect(link).toHaveAttribute("aria-label", /No Defensible Page: .*Opens B00MISSING on the Findability tab/);
  await expect(link).not.toHaveAttribute("title");
  await expect(missing.locator("[data-page-found-findability]")).toHaveText(/^Findability:\s*No Defensible Page$/);

  const noRow = table.locator("[data-page-found-row='not_found'][data-asin='B00NULLFLG']");
  await expect(noRow.locator("[data-page-found-reason]")).toHaveText("Reason not recorded");
  await expect(noRow.locator("[data-page-found-reason]").locator("button, a")).toHaveCount(0);

  await link.click();
  const row = await expectLandedOnMissing(page, canvas);
  await expect(row).toHaveAttribute("data-findability-landed", "");
  await expect(row).not.toHaveAttribute("data-findability-landed", { timeout: 5000 });
  expect(new URL(page.url()).searchParams.get("evidence")).toBe("asin:B00MISSING");
  expect(new URL(page.url()).searchParams.get("tab")).toBe("findability");

  // A choice on the tab replaces the landing, and the URL stops naming the row.
  await page.locator("[data-findability-outcome='exact_official_product'] button.findability-count").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("evidence")).toBeNull();
  await page.locator("[data-findability-outcome='completed_not_found'] button.findability-count").click();
  await expect(page.locator("#findability-listings")).toContainText("1–25 of 30");
  await expect(page.locator("tr[data-findability-landed]")).toHaveCount(0);

  // Leaving and coming back opens the tab as usual.
  await canvas.openTab("Brand-Site Specs");
  await canvas.openTab("Findability");
  await expect(page.locator("[data-findability-outcome='exact_official_product'] button.findability-count")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});

test("the Findability link works from the keyboard", async ({ page }) => {
  const errors = watchErrors(page);
  await mockCanvasRead(page, { findability: FINDABILITY });
  const canvas = new Canvas(page);
  await openBrandSiteSpecs(page, canvas);

  const link = page.locator("button[data-page-found-findability-link='asin:B00MISSING']");
  await link.focus();
  await expect(link).toBeFocused();
  await expect(page.locator(".node-tooltip.node-tooltip-definition.visible")).toContainText("No Defensible Page");
  await page.keyboard.press("Enter");
  const row = await expectLandedOnMissing(page, canvas);
  await expect(row).toHaveAttribute("data-findability-landed", "");
  expect(errors).toEqual([]);
});

/** fender_missing_fields as the fender.com spec check stored them on 4 Nov 2026. */
const STORED: Array<[string, string]> = [
  [
    "B09BTVN81S",
    "not_found: search_results_no_matching_model (affinity-series-stratocaster-fmt-hss:handle_rejected | affinity-stratocaster-fmt-hss:handle_rejected | squier-affinity-stratocaster-fmt-hss:handle_rejected)",
  ],
  [
    "B09TPVQJML",
    "not_found: search_results_no_matching_model (fender-spaghetti-logo-t-shirt-shell-pink:handle_rejected | fender-spaghetti-logo-t-shirt-surf-green:handle_rejected | fender-spaghetti-logo-t-shirt-daphne-blue:handle_rejected | fender-spaghetti-logo-t-shirt-butterscotch-blonde:handle_rejected | fender-spaghetti-logo-t-shirt-dakota-red:handle_rejected | fender-spaghetti-logo-t-shirt-black:handle_rejected | fender-spaghetti-logo-tie-dye-t-shirt-mustard:handle_rejected | fender-spaghetti-logo-tie-dye-t-shirt:handle_rejected | fender-spaghetti-logo-long-sleeve-t-shirt-black:handle_rejected | fender-spa",
  ],
  [
    "B09R6WBMG9",
    "not_found: search_candidate_page_missing (fender-digital-gift-card:handle_rejected | fender-play-prepaid-cards:handle_rejected | affinity-jazzmaster:page_not_found | squier-affinity-jazzmaster:page_not_found)",
  ],
  [
    "B0B621WX38",
    "not_found: findability_page_not_read (findability:page_not_read | american-vintage-ii-1957-stratocaster-left-hand:handle_rejected | american-vintage-ii-1957-left-handed-stratocaster-2-color-sunburst:handle_rejected | squier-american-vintage-ii-1957-left-handed-stratocaster-2-color-sunburst:handle_rejected)",
  ],
];

const STORED_ROWS: Row[] = [
  ...SPEC_ROWS.filter((row) => row.fender_found === true || row.asin === "B00MISSING"),
  ...STORED.map(([asin, missing]) => ({
    asin,
    title: `Stored ${asin}`,
    amazon_checked: true,
    fender_found: false,
    fender_missing_fields: missing,
    fender_url: null,
  })),
];

test("stored not-found reasons read as plain reasons, grouped, and still link to Findability", async ({ page }) => {
  const errors = watchErrors(page);
  await mockCanvasRead(page, {
    findability: [
      ...FINDABILITY,
      { asin: "B0B621WX38", title: "Stored Strat", latest_state: "official_family_page", counts_as_confirmed: true },
    ],
  });
  await page.route("**/rest/v1/canvas_spec_readiness**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": `0-${STORED_ROWS.length - 1}/${STORED_ROWS.length}`,
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
      },
      body: JSON.stringify(STORED_ROWS),
    });
  });
  const canvas = new Canvas(page);
  await openBrandSiteSpecs(page, canvas);

  const table = page.locator("#brand-site-page-found-skus");
  await table.locator("[data-page-found-filter='not_found']").click();
  await expect(table.locator("[data-page-found-reason-filter]")).toHaveText([
    "All reasons 5",
    "No matching fender.com product page 2",
    "Matching fender.com page is missing 1",
    "fender.com page did not load 1",
    "No Defensible Page 1",
  ]);
  await expect(table.locator("tbody")).not.toContainText(/handle|rejected|not_found|page_not|\(/);

  const cut = table.locator("[data-asin='B09TPVQJML'] [data-page-found-stored-reason='no_matching_model'] .ifai-term");
  await expect(cut).toHaveText("No matching fender.com product page");
  await expect(cut).toHaveAttribute("data-ifai-tooltip-desc", /none was for this model\. At least 10 fender\.com pages checked\.$/);
  await expect(cut).not.toHaveAttribute("title");
  await cut.hover();
  await expect(page.locator(".node-tooltip.node-tooltip-definition.visible")).toContainText(
    "At least 10 fender.com pages checked.",
  );

  await table.locator("[data-page-found-reason-filter='fender.com page did not load']").click();
  const row = table.locator("[data-page-found-row]");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-asin", "B0B621WX38");
  await expect(row.locator("[data-page-found-stored-reason='page_not_read']")).toHaveText("fender.com page did not load");
  await expect(row.locator("[data-page-found-stored-reason] .ifai-term")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /4 fender\.com pages checked\.$/,
  );
  await row.locator("button[data-page-found-findability-link='asin:B0B621WX38']").click();
  await expect(canvas.activeTab).toContainText("Findability");
  await expect(page.locator("[data-findability-outcome='official_family_page'] button.findability-count")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const landed = page.locator("#findability-listings tr[data-findability-asin='B0B621WX38']");
  await expect(landed).toBeInViewport();
  await expect(landed).toHaveAttribute("data-findability-landed", "");
  expect(errors).toEqual([]);
});

test("a copied link reopens the same Findability row", async ({ page }) => {
  const errors = watchErrors(page);
  await mockCanvasRead(page, { findability: FINDABILITY });
  await page.context().addCookies([{ name: "ifai_guest_fender", value: "1", domain: "localhost", path: "/" }]);
  await page.goto("/dashboard?spoke=specs&tab=findability&evidence=asin:B00MISSING");
  const canvas = new Canvas(page);
  const row = await expectLandedOnMissing(page, canvas);
  await expect(row).toHaveAttribute("data-findability-landed", "");
  expect(errors).toEqual([]);
});
