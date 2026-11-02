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
  await expect(exactHero.locator("[data-findability-lead-figure]")).toHaveText("33.3%");
  await expect(exactHero.locator("[data-findability-lead-figure]")).toHaveAttribute("data-findability-exact", "2");
  await expect(exactHero.locator("[data-findability-lead-ratio]")).toHaveText("2 of 6");
  await expect(exactHero.locator("[data-citation-pie-disc='findability-exact_official_product']")).toBeVisible();
  await expect(exactHero.locator(".citation-pie-disc-findability")).toBeVisible();

  await expect(page.locator("[data-findability-lead-outcome='official_family_page'] [data-findability-lead-figure]")).toHaveText(
    "16.7%",
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
  await expect(page.locator("#findability-listings")).toHaveCount(0);

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
      desc: "We have not looked at this listing yet. A blank result is not a missing page.",
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
  await expect(exact.locator("[data-findability-count]")).toHaveAttribute("data-findability-count", "2");
  await exact.locator("[data-findability-count]").click();
  const table = page.locator("#findability-listings");
  await expect(table).toContainText("B00ZEBRA");
  await expect(table).toContainText("B00ALPHA");
  await expect(table).not.toContainText("B00FAMILY");
  await expect(table.locator("thead")).toContainText("Listing");
  await expect(table.locator("thead")).toContainText("Official page");

  const link = table.locator("[data-findability-official-url]").first();
  await expect(link).toHaveAttribute("href", /brand\.example/);
  await expect(link).toHaveAttribute("target", "_blank");

  await table.locator("thead").getByRole("button", { name: "Listing" }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Alpha Exact");

  await page.locator("[data-findability-outcome='official_family_page'] [data-findability-count]").click();
  await expect(table).toContainText("B00FAMILY");
  await expect(table).toContainText("Official family page with 4 variants.");
  await expect(table).not.toContainText("B00ZEBRA");
  await expect(table.locator("thead")).not.toContainText("How it is counted");
  await expect(table.locator("[data-findability-official-url]")).toHaveAttribute(
    "href",
    "https://brand.example/products/family",
  );
  const skuHeader = table.locator("thead .ifai-term[data-ifai-tooltip-title='Variant SKU']");
  await expect(skuHeader).toHaveAttribute(
    "data-ifai-tooltip-desc",
    "The brand's variant code stored with this official-page match. It is not the Amazon ASIN.",
  );
  await expect(skuHeader).toHaveAttribute("tabindex", "0");
  await expect(skuHeader).not.toHaveAttribute("title");

  await page.locator("[data-findability-outcome='completed_not_found'] [data-findability-count]").click();
  await expect(table).toContainText("B00BUNDLE1");
  await expect(table.locator("[data-findability-address='finished-without-page']")).toHaveText("not found");
  await expect(table).toContainText("Search finished without a defensible official page.");
  await expect(table).toContainText("Yes");

  await page.locator("[data-findability-outcome='ambiguous_candidate'] [data-findability-count]").click();
  await expect(table).toContainText("B00AMBIG");
  await expect(table.locator("[data-findability-address='ambiguous']")).toHaveText("not found");

  await page.locator("[data-findability-outcome='not_checked'] [data-findability-count]").click();
  await expect(table).toContainText("B00UNCHECKED");
  await expect(table.locator("[data-findability-address='unchecked']")).toHaveText("not checked");
  await expect(table.locator("[data-findability-address='unchecked']")).not.toContainText("no defensible page");
  await expect(table.locator("[data-findability-row='not_checked']")).not.toContainText("unsuccessful");
  await expect(table.locator("[data-findability-row='not_checked']")).toContainText("None");
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
  await expect(page.locator("#findability-listings")).toHaveCount(0);
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

  await page.locator("[data-findability-outcome='not_checked'] [data-findability-count]").click();
  const table = page.locator("#findability-listings");
  await expect(table).toContainText("No listings in this outcome.");
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
  ).toHaveText("0.0%");
  await expect(
    page.locator("[data-findability-lead-outcome='official_family_page'] [data-findability-lead-ratio]"),
  ).toHaveText("0 of 3");
  await expect(
    page.locator("[data-findability-lead-outcome='completed_not_found'] [data-findability-lead-ratio]"),
  ).toHaveText("0 of 3");
  await expect(page.getByText("No Defensible Page", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("A zero is a real count.")).toBeVisible();

  await page.locator("[data-findability-outcome='official_family_page'] [data-findability-count]").click();
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

async function openOutcomeAndCount(page: Page, outcome: string, count: string, listing: string) {
  await expectOutcomeChevron(page, outcome, false);
  await page.locator(`[data-findability-outcome='${outcome}'] [data-findability-count]`).click();
  await expectOutcomeChevron(page, outcome, true);
  await expect(page.locator(".content-box-title .tag-badge")).toHaveText(`${count} listings`);
  await expect(page.locator("#findability-listings tbody tr")).toHaveCount(Number(count));
  await expect(page.locator("#findability-listings")).toContainText(listing);
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
      await openOutcomeAndCount(page, outcome, count, listing);
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
});
