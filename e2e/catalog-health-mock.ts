import type { Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockSetAsides, type SetAsideMock } from "./set-aside-mock";
import { METRICS, type Row } from "./spec-read-mock";

/**
 * A small Catalog Health read: four divisions with the catalog listings behind their
 * Buy Box counts, and six MAP listings with one Walmart price. Set-aside routes fall
 * through to the set-aside mock, which the spec registers first.
 */

/** A check a minute ago: inside every recheck window, so no mocked figure carries the stale asterisk. */
const FRESH_AT = new Date(Date.now() - 60_000).toISOString();
const FRESH_DAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export const DIVISIONS: Row[] = [
  { division: "Electric Guitar Kits", monitored_skus: 4, buybox_pct: 50, splinter_bundles: 3, schema_sync_pct: 0, primary_threat: null, strategic_action: null },
  { division: "Hollow & Semi-Hollow Body", monitored_skus: 69, buybox_pct: 0, splinter_bundles: 13, schema_sync_pct: 0, primary_threat: null, strategic_action: null },
  { division: "Solid Body", monitored_skus: 3292, buybox_pct: 50, splinter_bundles: 719, schema_sync_pct: 0, primary_threat: null, strategic_action: null },
  { division: "Tuning Pegs", monitored_skus: 1, buybox_pct: 0, splinter_bundles: 0, schema_sync_pct: 0, primary_threat: null, strategic_action: null },
];

function listing(asin: string, category: string, status: string, seller: string | null): Row {
  return {
    asin,
    model_name: `${category} listing`,
    title: `${category} listing`,
    bundle_name: null,
    parent_asin: null,
    product_url: null,
    is_bundle: false,
    category,
    buybox_seller_name: seller,
    buybox_seller_id: status === "3P Confirmed" ? "A1B2C3D4E5F6G" : null,
    buybox_status: status,
    featured_offer_state: status === "No Active Offer" ? "no_active_offer" : "present",
    featured_offer_checked_at: FRESH_AT,
  };
}

/** No category, so the division census skips them. */
function bundleRow(asin: string, parent: string | null, state: string | null): Row {
  return {
    asin,
    model_name: `Bundle ${asin.slice(-2)}`,
    title: `Bundle ${asin.slice(-2)}`,
    bundle_name: "Guitar plus amp",
    parent_asin: parent,
    product_url: `https://www.amazon.com/dp/${asin}`,
    is_bundle: true,
    category: null,
    buybox_seller_name: null,
    buybox_seller_id: null,
    buybox_status: state === "no_active_offer" ? "No Active Offer" : "3P Confirmed",
    featured_offer_state: state,
    featured_offer_checked_at: FRESH_AT,
  };
}

/** Five bundle listings, three with a live offer; two of those three have no parent. */
export const BUNDLE_ROWS: Row[] = [
  bundleRow("B00BUN0001", null, "present"),
  bundleRow("B00BUN0002", null, "withheld"),
  bundleRow("B00BUN0003", "B00PARENT1", "present"),
  bundleRow("B00BUN0004", null, "no_active_offer"),
  bundleRow("B00BUN0005", null, null),
];

export const CATALOG_ROWS: Row[] = [
  ...BUNDLE_ROWS,
  listing("B00KIT0001", "Electric Guitar Kits", "Amazon 1P", "Amazon.com"),
  listing("B00KIT0002", "Electric Guitar Kits", "3P Confirmed", "Kit Seller"),
  listing("B00HOL0001", "Hollow & Semi-Hollow Body", "3P Confirmed", "GearTree"),
  listing("B00SOL0001", "Solid Body", "Amazon 1P", "Amazon.com"),
  listing("B00SOL0002", "Solid Body", "3P Confirmed", "Liberty Music Inc"),
  listing("B00SOL0003", "Solid Body", "No Active Offer", null),
  listing("B00PEG0001", "Tuning Pegs", "No Active Offer", null),
];

function mapRow(asin: string, map: number | null, amz: number | null, wmt: number | null = null): Row {
  const leaks = [amz, wmt].filter((value): value is number => value != null);
  const worst = leaks.length ? Math.min(...leaks) : null;
  return {
    asin,
    model_name: `MAP listing ${asin.slice(-2)}`,
    title: `MAP listing ${asin.slice(-2)}`,
    map_price: map,
    offer_price: map != null && amz != null ? map + amz : null,
    amz_leakage: amz,
    worst_leakage: worst,
    wmt_price: map != null && wmt != null ? map + wmt : null,
    wmt_leakage: wmt,
    wmt_url: wmt != null ? `https://www.walmart.com/ip/${asin}` : null,
    mf_price: null,
    mf_leakage: null,
    is_map_violation: worst != null && worst < 0,
    featured_offer_checked_at: FRESH_AT,
    wmt_checked_at: FRESH_AT,
    mf_checked_at: null,
  };
}

/** Three listings below MAP out of five with a stored comparison; one has no MAP price. */
export const MAP_ROWS: Row[] = [
  mapRow("B00MAP0001", 1000, -100),
  mapRow("B00MAP0002", 800, -50, -80),
  mapRow("B00MAP0003", 600, -20),
  mapRow("B00MAP0004", 500, 0, 5),
  mapRow("B00MAP0005", 400, 10),
  mapRow("B00MAP0006", null, null),
];

/**
 * SmartScout monthly unit estimates for the listings below MAP (R-09): five units on the first,
 * two on the second, and no SmartScout record for the third. Discounted retail value is
 * $100 x 5 + $50 x 2 = $600 a month, with 2 of 3 listings estimated and 1 awaiting inputs.
 */
export const MAP_UNIT_ROWS: Row[] = [
  { asin: "B00MAP0001", smartscout_monthly_units: 5, smartscout_snapshot_date: FRESH_DAY },
  { asin: "B00MAP0002", smartscout_monthly_units: 2, smartscout_snapshot_date: FRESH_DAY },
];

const MAP_UNITS_SELECT = "asin,smartscout_monthly_units,smartscout_snapshot_date";

const CHANNEL_PRICES: Row[] = MAP_ROWS.filter((row) => row.wmt_price != null).map((row) => ({
  asin: row.asin,
  channel: "walmart",
  price: row.wmt_price,
  url: row.wmt_url,
  checked_at: "2026-11-03T12:00:00.000Z",
}));

const CHECKED_AT = FRESH_AT;

function suppressionRow(asin: string, withheld: boolean): Row {
  return {
    asin,
    model_name: `Offer listing ${asin.slice(-2)}`,
    title: `Offer listing ${asin.slice(-2)}`,
    offer_price: 200,
    buybox_status: withheld ? "Unknown/Not Harvested" : "3P Confirmed",
    featured_offer_state: withheld ? "withheld" : "present",
    featured_offer_withheld: withheld,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: withheld ? 20000 : 9000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

/** Four current Buy Box readings, one withheld. */
export const SUPPRESSION_ROWS: Row[] = [
  suppressionRow("B00OFR0001", true),
  suppressionRow("B00OFR0002", false),
  suppressionRow("B00OFR0003", false),
  suppressionRow("B00OFR0004", false),
];

function retailRows(url: URL): Row[] {
  const select = url.searchParams.get("select") ?? "";
  if (select.includes("featured_offer_withheld")) return SUPPRESSION_ROWS;
  if (select.includes("buybox_status") && select.includes("category")) return CATALOG_ROWS;
  if (select.startsWith("asin,map_price")) return MAP_ROWS;
  if (select === "*") {
    const sorted = [...MAP_ROWS].sort(
      (a, b) => Number(a.worst_leakage ?? Infinity) - Number(b.worst_leakage ?? Infinity),
    );
    if (url.searchParams.get("is_map_violation") === "eq.true") return sorted.filter((row) => row.is_map_violation);
    return sorted;
  }
  if (select === "asin") {
    if (url.searchParams.get("wmt_price") === "gt.0") return MAP_ROWS.filter((row) => Number(row.wmt_price) > 0);
    return MAP_ROWS;
  }
  return [];
}

/** Four Amazon spec readings: three checked (one missing a field), one not checked. */
export const SPEC_ROWS: Row[] = [
  { asin: "B00SPC0001", title: "Spec listing 01", amazon_checked: true, amazon_missing_fields: "scale_length", checked_at: FRESH_AT },
  { asin: "B00SPC0002", title: "Spec listing 02", amazon_checked: true, amazon_missing_fields: null, checked_at: FRESH_AT },
  { asin: "B00SPC0003", title: "Spec listing 03", amazon_checked: true, amazon_missing_fields: null, checked_at: FRESH_AT },
  { asin: "B00SPC0004", title: "Spec listing 04", amazon_checked: false, amazon_missing_fields: null, checked_at: FRESH_AT },
];

function bodyFor(url: URL, accept: string): unknown[] | Row {
  const table = url.pathname.split("/").pop() ?? "";
  if (table === "canvas_spec_readiness" && url.searchParams.get("select") === "asin,title,amazon_checked,amazon_missing_fields,checked_at") {
    return SPEC_ROWS;
  }
  if (table === "canvas_metrics") {
    return accept.includes("vnd.pgrst.object") ? METRICS : [{ catalog_bundles: METRICS.catalog_bundles }];
  }
  if (table === "canvas_divisions") return DIVISIONS;
  if (table === "canvas_retail_listings") return retailRows(url);
  if (table === "canvas_listing_channel_price") return CHANNEL_PRICES;
  if (table === "canvas_listing_sales_loss_v2" && url.searchParams.get("select") === MAP_UNITS_SELECT) {
    return MAP_UNIT_ROWS;
  }
  return [];
}

export async function mockCatalogHealthRead(page: Page): Promise<void> {
  await page.route("**/*supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (/\/rest\/v1\/(rpc\/|canvas_issue_set_asides|canvas_set_aside_reasons)/.test(url.pathname)) {
      await route.fallback();
      return;
    }
    if (!url.pathname.includes("/rest/v1/")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }
    const body = bodyFor(url, request.headers().accept ?? "");
    const rows = Array.isArray(body) ? body : [body];
    const range = rows.length === 0 || request.method() === "HEAD" ? `*/${rows.length}` : `0-${rows.length - 1}/${rows.length}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": range,
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
      },
      body: JSON.stringify(body),
    });
  });
}

/** Opens the canvas with every Supabase read mocked. `errors` collects page and console errors. */
export async function openCatalogHealthCanvas(
  page: Page,
): Promise<{ canvas: Canvas; setAsides: SetAsideMock; errors: string[] }> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error).split("\n")[0]));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  const setAsides = await mockSetAsides(page);
  await mockCatalogHealthRead(page);
  const canvas = new Canvas(page);
  await canvas.open();
  return { canvas, setAsides, errors };
}
