/* Ledlenser's canvas views use brand-neutral names (brand_win, brand_site_url).
   The dashboard code was written against Fender's views (fender_win,
   fender_url). This file translates between the two at the HTTP layer, so every
   screen reads Ledlenser rows in the shape it already knows.

   Requests: column names and outcome values in the query string are renamed to
   Ledlenser's, and columns that only Fender has (Musician's Friend) are dropped
   from select lists. Responses: Ledlenser names are renamed back. */

/** Dashboard (Fender) name -> Ledlenser name. Longest names first. */
const COLUMN_PAIRS: Array<[string, string]> = [
  ["probe_fender_sku", "probe_brand_sku"],
  ["spec_avg_fender_pct", "spec_avg_brand_site_pct"],
  ["spec_fender_found_pct", "spec_brand_site_found_pct"],
  ["spec_fender_found", "spec_brand_site_found"],
  ["fender_win_disqualified", "brand_win_disqualified"],
  ["fender_win_pct", "brand_win_pct"],
  ["fender_wins", "brand_wins"],
  ["fender_win", "brand_win"],
  ["fender_completeness_pct", "brand_site_completeness_pct"],
  ["fender_fields_expected", "brand_site_fields_expected"],
  ["fender_fields_found", "brand_site_fields_found"],
  ["fender_found", "brand_site_found"],
  ["fender_identity_match", "brand_site_identity_match"],
  ["fender_missing_fields", "brand_site_missing_fields"],
  ["fender_page_source", "brand_site_page_source"],
  ["fender_rating_markup", "brand_site_rating_markup"],
  ["fender_spec_values", "brand_site_spec_values"],
  ["fender_url", "brand_site_url"],
  ["fender_variant_sku", "brand_site_variant_sku"],
];

/** Columns Fender's views have and Ledlenser's do not. Dropped from select lists. */
const FENDER_ONLY_COLUMNS = new Set([
  "mf_checked",
  "mf_leaks",
  "mf_priced",
  "mf_price",
  "mf_leakage",
  "mf_checked_at",
]);

const TO_CLIENT = new Map(COLUMN_PAIRS);
const TO_DASHBOARD = new Map(COLUMN_PAIRS.map(([a, b]) => [b, a]));

/** Row values that are names, not data: outcome codes and the spec source. */
const VALUE_TO_DASHBOARD: Record<string, Record<string, string>> = {
  outcome: { brand_win: "fender_win", brand_win_disqualified: "fender_win_disqualified" },
  source: { brand_site: "fender" },
};

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;

function renameIdentifiers(text: string): string {
  return text.replace(IDENT, (word) => TO_CLIENT.get(word) ?? word);
}

function dropFenderOnly(select: string): string {
  return select
    .split(",")
    .filter((part) => !FENDER_ONLY_COLUMNS.has(part.trim()))
    .join(",");
}

/** Rewrites a PostgREST URL from dashboard names to Ledlenser names. */
export function toClientUrl(input: string): string {
  const url = new URL(input);
  if (!url.pathname.includes("/rest/v1/")) return input;
  const next = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    let v = value;
    if (key === "select") v = dropFenderOnly(v);
    // `source=eq.fender` style filters on the spec missing-fields view.
    if (key === "source") v = v.replace(/\.fender$/, ".brand_site");
    next.append(renameIdentifiers(key), renameIdentifiers(v));
  }
  url.search = next.toString();
  return url.toString();
}

function renameRow(row: unknown): unknown {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    const name = TO_DASHBOARD.get(key) ?? key;
    const values = VALUE_TO_DASHBOARD[name];
    out[name] = values && typeof value === "string" && values[value] ? values[value] : value;
  }
  return out;
}

/** Renames a PostgREST JSON body (row, rows, or anything else) to dashboard names. */
export function toDashboardBody(body: unknown): unknown {
  return Array.isArray(body) ? body.map(renameRow) : renameRow(body);
}

/** fetch for the Ledlenser client: renames on the way out and on the way back. */
export function aliasingFetch(base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const rewritten = toClientUrl(raw);
    const request = typeof input === "string" || input instanceof URL ? rewritten : new Request(rewritten, input);
    const response = await base(request, init);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("json") || !response.ok) return response;
    const text = await response.text();
    if (!text) return new Response(text, response);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(text, response);
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(toDashboardBody(body)), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
