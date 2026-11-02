import type { Page } from "@playwright/test";

/**
 * One mocked canvas read, shared by the specs that drive the AI Readiness spoke.
 * The rows are small on purpose: four spec rows (one true, one false, one null
 * flag) and four missing-field rows, which is enough to prove the filters and
 * the collapsed field list without a live database.
 */

export type Row = Record<string, unknown>;

export const METRICS = {
  catalog_skus: 4,
  catalog_bundles: 1,
  spec_checked: 4,
  spec_fender_found: 2,
  spec_fender_found_pct: 50,
  spec_avg_amazon_pct: 48.8,
  // Field totals: not inventable as 48.8% × 4 × 13 ≈ 25.4.
  spec_amazon_fields_found: 26,
  spec_amazon_fields_expected: 52,
  spec_avg_fender_pct: 40,
  spec_missing_additional_property: 1,
  division_count: 1,
};

/** The live percentage and ratio the fender.com page found pill must show. */
export const FOUND_RESULT = "50.0% (2 of 4)";

export const SPEC_ROWS: Row[] = [
  {
    asin: "B00NULLFLG",
    title: "Unchecked flag",
    amazon_completeness_pct: 5,
    amazon_checked: true,
    amazon_fields_found: 1,
    amazon_fields_expected: 13,
    amazon_missing_fields: "",
    fender_found: null,
    fender_missing_fields: "additionalProperty",
    fender_url: null,
  },
  {
    asin: "B00MISSING",
    title: "Missing Page Guitar",
    amazon_completeness_pct: 20,
    amazon_checked: true,
    amazon_fields_found: 3,
    amazon_fields_expected: 13,
    amazon_missing_fields: "color",
    fender_found: false,
    fender_missing_fields: null,
    fender_url: null,
  },
  {
    asin: "B00CLEAR01",
    title: "Clear Page",
    amazon_completeness_pct: 80,
    amazon_checked: true,
    amazon_fields_found: 10,
    amazon_fields_expected: 13,
    amazon_missing_fields: "",
    fender_found: true,
    fender_missing_fields: "scale_length",
    fender_url: "https://www.fender.com/en-US/clear",
  },
  {
    asin: "B00FOUND01",
    title: "Found Strat",
    amazon_completeness_pct: 90,
    amazon_checked: true,
    amazon_fields_found: 12,
    amazon_fields_expected: 13,
    amazon_missing_fields: "",
    fender_found: true,
    fender_missing_fields: "neck; additionalProperty",
    fender_url: "https://www.fender.com/en-US/found",
  },
];

/** Ordered by sku_count, the way the live query returns them. */
export const MISSING_FIELD_ROWS: Row[] = [
  { field: "scale_length", sku_count: 3, source: "amazon" },
  { field: "additionalProperty", sku_count: 2, source: "fender" },
  { field: "neck_material", sku_count: 2, source: "amazon" },
  { field: "pickup_configuration", sku_count: 1, source: "amazon" },
];

export const BUNDLE: Row = {
  asin: "B00BUNDLE1",
  model_name: "Twin Amp Bundle",
  title: "Twin Amp Bundle",
  bundle_name: "Amp plus cable",
  parent_asin: null,
  product_url: "https://www.amazon.com/dp/B00BUNDLE1",
  is_bundle: true,
};

export function specRowsFor(url: URL): Row[] {
  const found = url.searchParams.get("fender_found");
  const missing = url.searchParams.get("fender_missing_fields") ?? "";
  let rows = SPEC_ROWS;
  if (found === "eq.false") rows = rows.filter((row) => row.fender_found === false);
  if (found === "eq.true") rows = rows.filter((row) => row.fender_found === true);
  if (missing.startsWith("like.")) {
    const token = missing.slice("like.".length).replaceAll("%", "").replaceAll("*", "");
    rows = rows.filter((row) => String(row.fender_missing_fields ?? "").includes(token));
  }
  return rows;
}

function bodyFor(url: URL, accept: string, findability: Row[]): { body: unknown; count: number } {
  const table = url.pathname.split("/").pop() ?? "";
  if (table === "canvas_metrics") {
    if (accept.includes("vnd.pgrst.object")) return { body: METRICS, count: 1 };
    return { body: [{ catalog_bundles: METRICS.catalog_bundles }], count: 1 };
  }
  if (table === "canvas_spec_missing_fields") {
    return { body: MISSING_FIELD_ROWS, count: MISSING_FIELD_ROWS.length };
  }
  if (table === "canvas_freshness") {
    return {
      body: [{ job_key: "spec_readiness", last_run_at: "2026-10-08T00:00:00.000Z" }],
      count: 1,
    };
  }
  if (table === "canvas_retail_listings") {
    const select = url.searchParams.get("select") ?? "";
    if (select.includes("is_bundle")) return { body: [BUNDLE], count: 1 };
    return { body: [], count: 0 };
  }
  if (table === "canvas_spec_readiness") {
    const rows = specRowsFor(url);
    return { body: rows, count: rows.length };
  }
  if (table === "canvas_spec_findability") {
    return { body: findability, count: findability.length };
  }
  return { body: [], count: 0 };
}

/** Routes every Supabase call to the fixture above. Returns the URLs seen. */
export async function mockCanvasRead(page: Page, options?: { findability?: Row[] }): Promise<string[]> {
  const findability = options?.findability ?? [];
  const seen: string[] = [];
  await page.route("**/*supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    seen.push(`${url.pathname}?${url.searchParams.toString()}`);
    if (!url.pathname.includes("/rest/v1/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }
    const { body, count } = bodyFor(url, request.headers().accept ?? "", findability);
    const rows = Array.isArray(body) ? body : [body];
    const range = rows.length === 0 ? `*/${count}` : `0-${rows.length - 1}/${count}`;
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
  return seen;
}
