import type { Page } from "@playwright/test";
import { Canvas } from "./fixtures";
import { mockSetAsides, type SetAsideMock } from "./set-aside-mock";
import { METRICS, type Row } from "./spec-read-mock";

/**
 * A small Catalog Health read: four divisions with the catalog listings behind their
 * Buy Box counts, and six MAP listings with one Walmart price. Set-aside routes fall
 * through to the set-aside mock, which the spec registers first.
 */

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
  };
}

export const CATALOG_ROWS: Row[] = [
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

const CHANNEL_PRICES: Row[] = MAP_ROWS.filter((row) => row.wmt_price != null).map((row) => ({
  asin: row.asin,
  channel: "walmart",
  price: row.wmt_price,
  url: row.wmt_url,
  checked_at: "2026-11-03T12:00:00.000Z",
}));

function retailRows(url: URL): Row[] {
  const select = url.searchParams.get("select") ?? "";
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

function bodyFor(url: URL, accept: string): unknown[] | Row {
  const table = url.pathname.split("/").pop() ?? "";
  if (table === "canvas_metrics") {
    return accept.includes("vnd.pgrst.object") ? METRICS : [{ catalog_bundles: METRICS.catalog_bundles }];
  }
  if (table === "canvas_divisions") return DIVISIONS;
  if (table === "canvas_retail_listings") return retailRows(url);
  if (table === "canvas_listing_channel_price") return CHANNEL_PRICES;
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
