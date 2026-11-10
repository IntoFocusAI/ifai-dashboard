import { expect, test, type Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockCanvasRead, type Row } from "./spec-read-mock";

const EXACT = "https://brand.example/products/zebra";

const ROWS: Row[] = [
  {
    asin: "B00ZEBRA",
    title: "Zebra Exact",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: "exact_official_product",
    latest_canonical_url: EXACT,
    latest_variant_sku: "0140000001",
    confidence: "sku",
    explanation: "Official page has one variant.",
    source_method: "derived_handle",
    http_status: 200,
    latest_attempt_at: "2026-10-12T20:27:42.000Z",
    jsonld_status: "not_checked",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
  },
  {
    asin: "B00ALPHA",
    title: "Alpha Exact",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: "exact_official_product",
    latest_canonical_url: "https://brand.example/products/alpha",
    latest_variant_sku: "0140000002",
    confidence: "gtin",
    explanation: "Official page has one variant.",
    source_method: "model_number_search",
    http_status: 200,
    latest_attempt_at: "2026-10-12T20:27:43.000Z",
    jsonld_status: "not_checked",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
  },
  {
    asin: "B00FAMILY",
    title: "Family Page Guitar",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: "official_family_page",
    latest_canonical_url: "https://brand.example/products/family",
    latest_variant_sku: "0117602805",
    confidence: "sku",
    explanation: "Official family page with 4 variants.",
    source_method: "derived_handle",
    http_status: 200,
    latest_attempt_at: "2026-10-12T20:27:44.000Z",
    jsonld_status: "not_checked",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
  },
  {
    asin: "B00BUNDLE1",
    title: "Finished Without A Page",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: "completed_not_found",
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: "none",
    explanation: "Search finished without a defensible official page.",
    source_method: null,
    http_status: 200,
    latest_attempt_at: "2026-10-12T20:27:45.000Z",
    jsonld_status: "not_checked",
    counts_as_confirmed: false,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: true,
  },
  {
    asin: "B00AMBIG",
    title: "Ambiguous Finish",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: "ambiguous_candidate",
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: "none",
    explanation: "More than one official page fits the listing.",
    source_method: null,
    http_status: 200,
    latest_attempt_at: "2026-10-12T20:27:46.000Z",
    jsonld_status: "not_checked",
    counts_as_confirmed: false,
    counts_as_finished_search: true,
    counts_as_ambiguous: true,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
  },
  {
    asin: "B00UNCHECKED",
    title: "Unchecked Listing",
    category: "Solid Body",
    product_kind: null,
    latest_state: "not_checked",
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: null,
    counts_as_confirmed: false,
    counts_as_finished_search: false,
    counts_as_ambiguous: false,
    counts_as_unchecked: true,
    counts_as_completed_not_found: false,
  },
];

async function openFindability(page: Page) {
  const canvas = new Canvas(page);
  await canvas.open();
  await page.goto("/dashboard?spoke=specs&tab=findability");
  await expect(page.locator(".ifai-canvas.column-layout")).toHaveCount(1);
  await expect(canvas.activeTab).toContainText("Findability");
  await expect(page.locator("[data-findability-lead]")).toBeVisible();
  return canvas;
}

test("the five outcome counts stay distinct and open the listings behind them", async ({ page }) => {
  await mockCanvasRead(page, { findability: ROWS });
  await openFindability(page);

  const lead = page.locator("[data-findability-lead]");
  await expect(lead).toBeVisible();
  await expect(page.locator("[data-findability-lead-outcome]")).toHaveCount(5);
  await expect(page.locator(".findability-headline")).toHaveCount(0);
  await expect(page.locator("[data-findability-headline]")).toHaveCount(0);

  const exactHero = page.locator("[data-findability-lead-outcome='exact_official_product']");
  await expect(exactHero).toContainText("Exact official product page");
  // The mocked check ran on 12 Oct 2026, past the 14-day limit for a weekly check (X-25).
  await expect(exactHero.locator("[data-findability-lead-figure]")).toHaveText("33.3%*");
  await expect(exactHero.locator("[data-partial-figure='stale']")).toBeVisible();
  await expect(exactHero.locator("[data-figure-tip='findability-stale']")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /runs weekly and has not run since Oct 12, 2026/,
  );
  await expect(exactHero.locator("[data-status='bad']")).toContainText("Poor");
  await expect(exactHero.locator("[data-findability-lead-figure]")).toHaveAttribute("data-findability-exact", "2");
  await expect(exactHero.locator("[data-findability-lead-ratio]")).toHaveText("2 of 6");
  await expect(exactHero.locator("[data-citation-pie-disc='findability-exact_official_product']")).toBeVisible();
  await expect(exactHero.locator(".citation-pie-disc-findability")).toBeVisible();

  await expect(page.locator("[data-findability-lead-outcome='official_family_page'] [data-findability-lead-figure]")).toHaveText(
    "16.7%*",
  );
  await expect(page.locator("[data-findability-lead-outcome='completed_not_found'] [data-findability-lead-ratio]")).toHaveText(
    "1 of 6",
  );
  await expect(page.locator("[data-findability-lead-outcome='ambiguous_candidate']")).toBeVisible();
  await expect(page.locator("[data-findability-lead-outcome='not_checked']")).toBeVisible();

  const lastChecked = page.locator("[data-findability-last-checked]");
  await expect(lastChecked).toBeVisible();
  await expect(lastChecked).toHaveAttribute("data-findability-last-checked", "2026-10-12T20:27:46.000Z");
  await expect(lastChecked).toHaveText("Last checked Oct 12, 2026, 8:27 PM UTC.");
  await expect(page.locator("[data-findability-outcome='exact_official_product']")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#findability-listings")).toHaveCount(1);

  const outcomeTips: Array<{ outcome: string; title: string; desc: string }> = [
    {
      outcome: "exact_official_product",
      title: "Exact official product page",
      desc: "We found the fender.com page for this one product. An assistant can use that page's specs for this Amazon listing.",
    },
    {
      outcome: "official_family_page",
      title: "Official family page",
      desc: "We found a fender.com page for the whole line. Specs on it can belong to a different color or model.",
    },
    {
      outcome: "completed_not_found",
      title: "No Defensible Page",
      desc: "We finished looking and did not accept a page. This does not prove the product is missing from fender.com.",
    },
    {
      outcome: "ambiguous_candidate",
      title: "Ambiguous match",
      desc: "More than one fender.com page could fit, so we did not pick one.",
    },
    {
      outcome: "not_checked",
      title: "Unchecked",
      desc: "This listing was not checked and should be opened for that reason. A blank result is not a missing page.",
    },
  ];
  for (const { outcome, title, desc } of outcomeTips) {
    const leadTerm = page.locator(
      `[data-findability-lead-outcome='${outcome}'] span.ifai-term[data-ifai-tooltip-title='${title}']`,
    );
    await expect(leadTerm).toHaveAttribute("data-ifai-tooltip-desc", desc);
    await expect(leadTerm).toHaveAttribute("tabindex", "0");
    await expect(leadTerm).not.toHaveAttribute("title");

    const countTerm = page.locator(
      `[data-findability-outcome='${outcome}'] span.ifai-term[data-ifai-tooltip-title='${title}']`,
    );
    await expect(countTerm).toHaveAttribute("data-ifai-tooltip-desc", desc);
    await expect(countTerm).not.toHaveAttribute("title");
  }

  await expect(page.locator(".drilldown-desc")).toHaveCount(0);
  await expect(page.locator(".drilldown-title-main")).not.toContainText("finished search");
  await expect(page.locator(".drilldown-title-main")).not.toContainText("Machine Readability is a separate");
  await expect(page.getByText("No Defensible Page", { exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-findability-total]")).toHaveAttribute("data-findability-total", "6");
  await expect(page.locator(".findability-note").filter({ hasText: "Each listing is one outcome" })).toBeVisible();
  await expect(page.locator(".findability-note").filter({ hasText: "on Brand-Site Specs" })).toBeVisible();
  await expect(
    page.locator(".findability-note").filter({
      hasText: "Schema.org product data on each fender.com page is on Brand-Site Specs.",
    }),
  ).toBeVisible();

  const exact = page.locator("[data-findability-outcome='exact_official_product']");
  await expect(exact).toHaveAttribute("data-selected", "true");
  await expect(exact.locator("[data-findability-count]")).toHaveAttribute("aria-pressed", "true");
  await expect(exact.locator("[data-findability-count]")).toHaveAttribute("data-findability-count", "2");
  const table = page.locator("#findability-listings");
  await expect(table).toHaveCount(1);
  await expect(page.locator(".findability-panel .content-box-title")).toContainText("Exact official product page");
  await expect(table).toContainText("B00ZEBRA");
  await expect(table).toContainText("B00ALPHA");
  await expect(table).not.toContainText("B00FAMILY");
  await expect(table.locator("thead")).toContainText("Listing");
  // Seven columns fit 1280 px: the outcome is the box title, and related facts share a cell.
  await expect(table.locator("thead th[data-col-id]")).toHaveCount(7);
  await expect(table.locator("thead th[data-col-id='outcome']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='page']")).toContainText("Official page");
  await expect(table.locator("thead th[data-col-id='checked']")).toContainText("Checked");
  await expect(table.locator("thead th[data-col-id='confidence']")).toContainText("Confidence");
  await expect(table.locator("thead th[data-col-id='bundle']")).toContainText("Dealer bundle");
  await expect(table.locator("thead th[data-col-id='reason']")).toHaveCount(0);
  // The dealer-bundle caveat is in the header tooltip, not on screen.
  await expect(page.locator(".findability-panel")).not.toContainText("correlation");
  await expect(table.locator("thead .ifai-term[data-ifai-tooltip-title='Dealer bundle']")).toHaveAttribute(
    "data-ifai-tooltip-desc",
    /correlation, not a proven cause/,
  );

  const link = table.locator("[data-findability-official-url]").first();
  await expect(link).toHaveAttribute("href", /brand\.example/);
  await expect(link).toHaveAttribute("target", "_blank");
  const zebra = table.locator("[data-findability-asin='B00ZEBRA']");
  await expect(zebra.locator("td.asin-col a")).toHaveCount(0);
  await expect(zebra.locator("td.asin-col .asin-chip")).toHaveText("B00ZEBRA");
  // Variant SKU sits under the official page as text.
  await expect(zebra.locator("td").nth(2)).toContainText("Variant SKU 0140000001");
  await expect(zebra.locator("td").nth(2).locator(".findability-cell-sub a")).toHaveCount(0);

  await table.locator("thead").getByRole("button", { name: "Listing" }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Alpha Exact");

  await page.locator("[data-findability-outcome='official_family_page'] [data-findability-count]").click();
  await expect(exact).toHaveAttribute("data-selected", "false");
  await expect(page.locator("[data-findability-outcome='official_family_page']")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(table).toHaveCount(1);
  await expect(table).toContainText("B00FAMILY");
  await expect(table).toContainText("Official family page with 4 variants.");
  await expect(table).not.toContainText("B00ZEBRA");
  await expect(table.locator("thead")).not.toContainText("How it is counted");
  await expect(table.locator("[data-findability-official-url]")).toHaveAttribute(
    "href",
    "https://brand.example/products/family",
  );
  const skuHeader = table.locator("thead .ifai-term[data-ifai-tooltip-title='Official page']");
  await expect(skuHeader).toHaveAttribute("data-ifai-tooltip-desc", /The variant SKU is not the Amazon ASIN\./);
  await expect(skuHeader).toHaveAttribute("tabindex", "0");
  await expect(skuHeader).not.toHaveAttribute("title");
  await expect(table.locator("thead th[data-col-id='confidence']")).toContainText("Confidence");

  await page.locator("[data-findability-outcome='completed_not_found'] [data-findability-count]").click();
  await expect(table).toContainText("B00BUNDLE1");
  const bundleAsin = table.locator("[data-findability-asin='B00BUNDLE1'] td.asin-col a.listing-link");
  await expect(bundleAsin).toHaveAttribute("href", "https://www.amazon.com/dp/B00BUNDLE1");
  await expect(bundleAsin).toHaveAttribute("target", "_blank");
  await expect(bundleAsin).toHaveAttribute("rel", "noopener noreferrer");
  await expect(bundleAsin.locator(".asin-chip")).toHaveText("B00BUNDLE1");
  await expect(table.locator("[data-findability-address='finished-without-page']")).toHaveText("not found");
  await expect(table).toContainText("Search finished without a defensible official page.");
  await expect(table).toContainText("Yes");

  await page.locator("[data-findability-outcome='ambiguous_candidate'] [data-findability-count]").click();
  await expect(table).toContainText("B00AMBIG");
  await expect(table.locator("[data-findability-address='ambiguous']")).toHaveText("not found");

  await page.locator("[data-findability-outcome='not_checked'] [data-findability-count]").click();
  await expect(table).toContainText("B00UNCHECKED");
  await expect(table.locator("[data-findability-asin='B00UNCHECKED'] td.asin-col a")).toHaveCount(0);
  await expect(table.locator("[data-findability-asin='B00UNCHECKED'] td.asin-col .asin-chip")).toHaveText("B00UNCHECKED");
  await expect(table.locator("thead th").nth(0)).toHaveAttribute("data-col-id", "asin");
  await expect(table.locator("thead th").nth(1)).toHaveAttribute("data-col-id", "title");
  await expect(table.locator("thead th").nth(2)).toHaveAttribute("data-col-id", "reason");
  await expect(table.locator("thead th[data-col-id='page']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='http']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='checked']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='outcome']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='sku']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='confidence']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='source']")).toHaveCount(0);
  await expect(table.locator("thead")).not.toContainText("Variant SKU");
  await expect(table.locator("thead")).not.toContainText("Confidence");
  await expect(table.locator("thead")).not.toContainText("How it was matched");
  await expect(table.locator("thead th[data-col-id='category']")).toContainText("Category");
  await expect(table.locator("thead th[data-col-id='kind']")).toContainText("Product kind");
  await expect(table.locator("thead th[data-col-id='explanation']")).toContainText("Explanation");
  await expect(table.locator("thead th[data-col-id='bundle']")).toContainText("Dealer bundle");
  await expect(table.locator("[data-findability-address='unchecked']")).toHaveCount(0);
  await expect(table.locator("[data-findability-reason]")).toHaveText("Reason not recorded");
  await expect(table.locator("[data-findability-row='not_checked']")).not.toContainText("unsuccessful");
  await expect(table.locator("[data-findability-row='not_checked']")).not.toContainText("Not checked yet");
  await expect(table.locator("[data-findability-row='not_checked']")).toContainText("None");

  await page.locator("[data-findability-outcome='exact_official_product'] [data-findability-count]").click();
  await expect(exact).toHaveAttribute("data-selected", "true");
  await expect(page.locator("[data-findability-outcome='not_checked']")).toHaveAttribute("data-selected", "false");
  await expect(table).toHaveCount(1);
  await expect(table).toContainText("B00ZEBRA");
  await expect(table).not.toContainText("B00UNCHECKED");
  await expect(table.locator("thead th[data-col-id='page']")).toContainText("Official page");
  await expect(table.locator("thead th[data-col-id='checked']")).toContainText("Checked");
  await expect(table.locator("thead th[data-col-id='confidence']")).toContainText("Confidence");
  await expect(table.locator("thead th[data-col-id='reason']")).toHaveCount(0);
  await expect(table.locator("[data-findability-official-url]").first()).toHaveAttribute("href", /brand\.example/);
});

test("last checked shows Not available* when checked rows have no attempt time", async ({ page }) => {
  await mockCanvasRead(page, {
    findability: ROWS.map((row) =>
      row.latest_state === "not_checked" ? row : { ...row, latest_attempt_at: null },
    ),
  });
  await openFindability(page);

  await expect(page.locator("[data-findability-lead-outcome]")).toHaveCount(5);
  const lastChecked = page.locator("[data-findability-last-checked]");
  await expect(lastChecked).toBeVisible();
  await expect(lastChecked).toHaveAttribute("data-findability-last-checked", "");
  await expect(lastChecked).toContainText("Not available*");
  const tip = lastChecked.locator(".ifai-term");
  await expect(tip).toHaveAttribute("data-ifai-tooltip-title", "Last checked");
  await expect(tip).toHaveAttribute(
    "data-ifai-tooltip-desc",
    "This official-page read has no stored check time.",
  );
  await expect(tip).toHaveAttribute("tabindex", "0");
  await expect(tip).not.toHaveAttribute("title");
  await expect(page.locator("[data-findability-outcome='exact_official_product']")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#findability-listings")).toHaveCount(1);
  await expect(page.locator("#findability-listings")).toContainText("B00ZEBRA");
});

test("an empty official-page read does not describe unchecked as a finished search", async ({ page }) => {
  await mockCanvasRead(page, { findability: [] });
  await openFindability(page);

  await expect(page.locator("[data-findability-shape]")).toHaveAttribute("data-findability-shape", "empty");
  await expect(page.locator("[data-findability-empty]")).toContainText("no listings");
  await expect(page.locator("[data-findability-empty]")).not.toContainText("%");
  await expect(page.locator("[data-findability-lead-outcome]")).toHaveCount(0);
  for (const outcome of [
    "exact_official_product",
    "official_family_page",
    "completed_not_found",
    "ambiguous_candidate",
    "not_checked",
  ]) {
    await expect(page.locator(`[data-findability-outcome='${outcome}'] [data-findability-count]`)).toHaveAttribute(
      "data-findability-count",
      "0",
    );
  }

  const exact = page.locator("[data-findability-outcome='exact_official_product']");
  await expect(exact).toHaveAttribute("data-selected", "true");
  await expect(exact.locator("[data-findability-count]")).toHaveAttribute("aria-pressed", "true");
  const exactTable = page.locator("#findability-listings");
  await expect(exactTable).toHaveCount(1);
  await expect(exactTable).toContainText("No listings in this outcome.");
  await expect(exactTable.locator("thead th[data-col-id='page']")).toContainText("Official page");
  await expect(exactTable.locator("thead th[data-col-id='reason']")).toHaveCount(0);

  await page.locator("[data-findability-outcome='not_checked'] [data-findability-count]").click();
  await expect(exact).toHaveAttribute("data-selected", "false");
  const table = page.locator("#findability-listings");
  await expect(table).toHaveCount(1);
  await expect(table).toContainText("No listings in this outcome.");
  await expect(table.locator("thead th[data-col-id='reason']")).toHaveCount(1);
  await expect(table.locator("thead th[data-col-id='page']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='http']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='checked']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='outcome']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='sku']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='confidence']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='source']")).toHaveCount(0);
  await expect(table.locator("thead th[data-col-id='kind']")).toContainText("Product kind");
  await expect(table.locator("thead th[data-col-id='explanation']")).toContainText("Explanation");
  await expect(table).not.toContainText("no defensible page");
  await expect(table).not.toContainText("unsuccessful");
});

test("a partial read keeps zero outcomes separate from the rows that were checked", async ({ page }) => {
  await mockCanvasRead(page, {
    findability: ROWS.filter((row) => row.latest_state === "exact_official_product" || row.latest_state === "not_checked"),
  });
  await openFindability(page);

  await expect(page.locator("[data-findability-shape]")).toHaveAttribute("data-findability-shape", "partial");
  await expect(page.locator("[data-findability-total]")).toHaveAttribute("data-findability-total", "3");
  await expect(page.locator("[data-findability-lead-outcome]")).toHaveCount(5);
  await expect(
    page.locator("[data-findability-lead-outcome='official_family_page'] [data-findability-lead-figure]"),
  ).toHaveText("0.0%*");
  await expect(
    page.locator("[data-findability-lead-outcome='official_family_page'] [data-findability-lead-ratio]"),
  ).toHaveText("0 of 3");
  await expect(
    page.locator("[data-findability-lead-outcome='completed_not_found'] [data-findability-lead-ratio]"),
  ).toHaveText("0 of 3");
  await expect(page.getByText("No Defensible Page", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("A zero is a real count.")).toBeVisible();

  await expect(page.locator("[data-findability-outcome='exact_official_product']")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#findability-listings")).toContainText("B00ZEBRA");
  await page.locator("[data-findability-outcome='official_family_page'] [data-findability-count]").click();
  await expect(page.locator("[data-findability-outcome='exact_official_product']")).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(page.locator("[data-findability-outcome='official_family_page']")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#findability-listings")).toHaveCount(1);
  await expect(page.locator("#findability-listings")).toContainText("No listings in this outcome.");
  await expect(page.locator("#findability-listings")).not.toContainText("B00ZEBRA");
});

const OUTCOME_LISTINGS: Array<[string, string, string]> = [
  ["exact_official_product", "2", "B00ZEBRA"],
  ["official_family_page", "1", "B00FAMILY"],
  ["completed_not_found", "1", "B00BUNDLE1"],
  ["ambiguous_candidate", "1", "B00AMBIG"],
  ["not_checked", "1", "B00UNCHECKED"],
];

async function openFindabilityFromBubble(page: Page) {
  await page.locator("[data-graph-node-id='spoke-specs']").focus();
  const slot = page.locator("[data-hub-slot='opportunity']");
  await expect(slot.locator("[data-hub-slot-figure]")).toHaveText("2");
  await expect(slot).toContainText("1 family page");
  await expect(slot).toContainText("1 No Defensible Page");
  await expect(slot).toContainText("1 ambiguous match");
  await expect(slot).toContainText("1 unchecked listing");
  await expect(slot).not.toContainText("%");
  await expect(slot).not.toContainText("50.0%");
  await expect(slot).not.toContainText("29.2%");
  await expect(slot).not.toContainText("pages found");
  await slot.click();
}

async function chevronAngle(button: ReturnType<Page["locator"]>) {
  return button.locator(".retail-explore-chevron").evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    if (transform === "none") return 0;
    const match = transform.match(/matrix\(([^)]+)\)/);
    if (!match) return Number.NaN;
    const [a, b] = match[1].split(",").map((part) => Number(part.trim()));
    const degrees = Math.round((Math.atan2(b, a) * 180) / Math.PI);
    return ((degrees % 360) + 360) % 360;
  });
}

async function expectOutcomeChevron(page: Page, outcome: string, open: boolean) {
  const button = page.locator(`[data-findability-outcome='${outcome}'] [data-findability-count]`);
  await expect(button).toHaveAttribute("aria-expanded", open ? "true" : "false");
  await expect(button).toHaveAttribute("aria-pressed", open ? "true" : "false");
  await expect(button.locator(".retail-explore-chevron")).toHaveCount(1);
  await expect(page.locator(`[data-findability-outcome='${outcome}'] .ifai-term .retail-explore-chevron`)).toHaveCount(0);
  await expect.poll(() => chevronAngle(button)).toBe(open ? 180 : 0);
}

async function expectOpenOutcome(page: Page, outcome: string, count: string, listing: string) {
  await expectOutcomeChevron(page, outcome, true);
  await expect(page.locator(`[data-findability-outcome='${outcome}']`)).toHaveAttribute("data-selected", "true");
  await expect(page.locator("#findability-listings")).toHaveCount(1);
  await expect(page.locator(".content-box-title .tag-badge")).toHaveText(`${count} listings`);
  await expect(page.locator("#findability-listings tbody tr")).toHaveCount(Number(count));
  await expect(page.locator("#findability-listings")).toContainText(listing);
}

async function openOutcomeAndCount(page: Page, outcome: string, count: string, listing: string) {
  await expectOutcomeChevron(page, outcome, false);
  await page.locator(`[data-findability-outcome='${outcome}'] [data-findability-count]`).click();
  await expectOpenOutcome(page, outcome, count, listing);
}

for (const viewport of [
  { name: "desktop", width: 1600, height: 950 },
  { name: "laptop", width: 1280, height: 800 },
]) {
  test(`the findability widget and outcome chevrons work at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockCanvasRead(page, { findability: ROWS });
    const canvas = new Canvas(page);
    await canvas.open();

    await openFindabilityFromBubble(page);
    await expect(canvas.activeTab).toContainText("Findability");
    await expect(page.locator("[data-findability-total]")).toHaveAttribute("data-findability-total", "6");

    for (const [outcome, count, listing] of OUTCOME_LISTINGS) {
      if (outcome === "exact_official_product") {
        await expectOpenOutcome(page, outcome, count, listing);
      } else {
        await openOutcomeAndCount(page, outcome, count, listing);
      }
      await page.locator(`[data-findability-outcome='${outcome}'] [data-findability-count]`).click();
      await expectOutcomeChevron(page, outcome, false);
      await expect(page.locator("#findability-listings")).toHaveCount(0);
    }

    await page.locator(".hdr-btn[title='Toggle Light / Dark']").click();
    await expect(page.locator(".ifai-canvas.light-theme")).toHaveCount(1);
    for (const [outcome, count, listing] of OUTCOME_LISTINGS) {
      await openOutcomeAndCount(page, outcome, count, listing);
      await page.locator(`[data-findability-outcome='${outcome}'] [data-findability-count]`).click();
    }
  });
}

test("a stored other outcome uses the same chevron", async ({ page }) => {
  await mockCanvasRead(page, {
    findability: [
      ...ROWS,
      {
        asin: "B00BLOCK",
        title: "Blocked result",
        latest_state: "blocked",
        latest_canonical_url: null,
        counts_as_blocked: true,
        counts_as_unchecked: false,
        counts_as_confirmed: false,
        counts_as_finished_search: false,
        counts_as_ambiguous: false,
        counts_as_completed_not_found: false,
      },
    ],
  });
  await openFindability(page);
  const other = page.locator("[data-findability-outcome='other'] [data-findability-count]");
  await expect(other).toHaveAttribute("data-findability-count", "1");
  await expectOutcomeChevron(page, "other", false);
  await other.click();
  await expectOutcomeChevron(page, "other", true);
  await expect(page.locator(".content-box-title .tag-badge")).toHaveText("1 listings");
  await expect(page.locator("#findability-listings")).toContainText("B00BLOCK");
  await expect(page.locator("#findability-listings thead th[data-col-id='page']")).toContainText("Official page");
  await expect(page.locator("#findability-listings thead th[data-col-id='checked']")).toContainText("Checked");
  await expect(page.locator("#findability-listings thead th[data-col-id='confidence']")).toContainText("Confidence");
  await expect(page.locator("#findability-listings thead th[data-col-id='explanation']")).toContainText("Explanation");
  await expect(page.locator("#findability-listings thead th[data-col-id='reason']")).toHaveCount(0);
  await expect(page.locator("#findability-listings [data-findability-asin='B00BLOCK'] td.asin-col a")).toHaveCount(0);
  await expect(page.locator("#findability-listings [data-findability-asin='B00BLOCK'] td.asin-col .asin-chip")).toHaveText(
    "B00BLOCK",
  );
});

test("a 10-character ASIN opens its Amazon page from every Findability outcome table", async ({ page }) => {
  const variantSku = "B0VARSKU01";
  const outcomes: Array<{ outcome: string; asin: string; plain: string; row: Row }> = [
    {
      outcome: "exact_official_product",
      asin: "B0EXACT001",
      plain: "b0exact001",
      row: {
        latest_state: "exact_official_product",
        latest_canonical_url: EXACT,
        counts_as_confirmed: true,
        counts_as_finished_search: true,
      },
    },
    {
      outcome: "official_family_page",
      asin: "B0FAMILY01",
      plain: "B0FAMILY",
      row: {
        latest_state: "official_family_page",
        latest_canonical_url: "https://brand.example/products/family",
        counts_as_confirmed: true,
        counts_as_finished_search: true,
      },
    },
    {
      outcome: "completed_not_found",
      asin: "B0NOPAGE01",
      plain: "B0-NOPAGE1",
      row: {
        latest_state: "completed_not_found",
        counts_as_completed_not_found: true,
        counts_as_finished_search: true,
      },
    },
    {
      outcome: "ambiguous_candidate",
      asin: "B0AMBIG001",
      plain: "B00AMBIG",
      row: {
        latest_state: "ambiguous_candidate",
        counts_as_ambiguous: true,
        counts_as_finished_search: true,
      },
    },
    {
      outcome: "not_checked",
      asin: "B0UNCHECK1",
      plain: "B00UNCHECKED",
      row: {
        latest_state: "not_checked",
        counts_as_unchecked: true,
        counts_as_finished_search: false,
        product_kind: null,
        explanation: null,
      },
    },
    {
      outcome: "other",
      asin: "B0OTHER001",
      plain: "B0OTHER",
      row: {
        latest_state: "blocked",
        counts_as_blocked: true,
        counts_as_unchecked: false,
        counts_as_finished_search: false,
      },
    },
  ];

  const findability = outcomes.flatMap(({ asin, plain, row }) => [
    {
      title: `${asin} listing`,
      category: "Solid Body",
      product_kind: "instrument",
      latest_canonical_url: null,
      latest_variant_sku: variantSku,
      confidence: "sku",
      explanation: "Stored explanation.",
      source_method: "derived_handle",
      http_status: 200,
      latest_attempt_at: "2026-10-12T20:27:42.000Z",
      jsonld_status: "not_checked",
      counts_as_confirmed: false,
      counts_as_finished_search: false,
      counts_as_ambiguous: false,
      counts_as_unchecked: false,
      counts_as_completed_not_found: false,
      ...row,
      asin,
    },
    {
      title: `${plain} listing`,
      category: "Solid Body",
      product_kind: "instrument",
      latest_canonical_url: null,
      latest_variant_sku: variantSku,
      confidence: "sku",
      explanation: "Stored explanation.",
      source_method: "derived_handle",
      http_status: 200,
      latest_attempt_at: "2026-10-12T20:27:42.000Z",
      jsonld_status: "not_checked",
      counts_as_confirmed: false,
      counts_as_finished_search: false,
      counts_as_ambiguous: false,
      counts_as_unchecked: false,
      counts_as_completed_not_found: false,
      ...row,
      asin: plain,
    },
  ]);

  await mockCanvasRead(page, { findability });
  await openFindability(page);
  await expect(page.locator("[data-findability-outcome='exact_official_product']")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#findability-listings")).toHaveCount(1);

  for (const { outcome, asin, plain } of outcomes) {
    const card = page.locator(`[data-findability-outcome='${outcome}']`);
    if ((await card.getAttribute("data-selected")) !== "true") {
      await card.locator("[data-findability-count]").click();
    }
    await expect(card).toHaveAttribute("data-selected", "true");
    const table = page.locator("#findability-listings");
    await expect(table).toHaveCount(1);
    const linked = table.locator(`[data-findability-asin='${asin}'] td.asin-col a.listing-link`);
    await expect(linked).toHaveCount(1);
    await expect(linked).toHaveAttribute("href", `https://www.amazon.com/dp/${asin}`);
    await expect(linked).toHaveAttribute("target", "_blank");
    await expect(linked).toHaveAttribute("rel", "noopener noreferrer");
    await expect(linked.locator(".asin-chip")).toHaveText(asin);

    const plainCell = table.locator(`[data-findability-asin='${plain}'] td.asin-col`);
    await expect(plainCell.locator("a")).toHaveCount(0);
    await expect(plainCell.locator(".asin-chip")).toHaveText(plain);
    await expect(table.locator("a.listing-link")).toHaveCount(1);
    await expect(table.locator(`a[href='https://www.amazon.com/dp/${variantSku}']`)).toHaveCount(0);

    if (outcome === "not_checked") {
      await expect(table.locator("thead th[data-col-id='sku']")).toHaveCount(0);
      await expect(table.locator("thead")).not.toContainText("Variant SKU");
      await expect(table.locator("thead th").nth(6)).toHaveAttribute("data-col-id", "bundle");
    } else {
      // The variant SKU sits under the official page, as text.
      await expect(table.locator("thead th").nth(2)).toHaveAttribute("data-col-id", "page");
      const skuLine = table.locator(`[data-findability-asin='${asin}'] td`).nth(2).locator(".findability-cell-sub");
      await expect(skuLine).toHaveText(`Variant SKU ${variantSku}`);
      await expect(skuLine.locator("a")).toHaveCount(0);
    }
  }
});
