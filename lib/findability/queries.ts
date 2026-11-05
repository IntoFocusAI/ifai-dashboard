import type { FindabilityRow } from "@/lib/findability/outcomes";
import type { FindabilityRead } from "@/lib/findability/copy";
import { activeClient } from "@/lib/client/active-client";

export const FINDABILITY_COLUMNS = [
  "asin",
  "title",
  "category",
  "product_kind",
  "latest_state",
  "latest_canonical_url",
  "latest_variant_sku",
  "confidence",
  "explanation",
  "source_method",
  "http_status",
  "latest_attempt_at",
  "jsonld_status",
  "counts_as_confirmed",
  "counts_as_finished_search",
  "counts_as_ambiguous",
  "counts_as_unchecked",
  "counts_as_completed_not_found",
  "counts_as_blocked",
  "counts_as_timeout",
  "counts_as_parse_failure",
  "counts_as_unsupported",
].join(",");

export const DEALER_BUNDLE_COLUMNS = "asin,is_bundle";

const PAGE = 1000;
const MAX_PAGES = 20;

type ReadResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

type Ranged = ReadResult & {
  range: (from: number, to: number) => ReadResult;
};

export type FindabilityClient = {
  from: (view: string) => {
    select: (columns: string) => {
      order: (column: string, options?: { ascending?: boolean }) => Ranged;
    };
  };
};

async function readAll(
  client: FindabilityClient,
  view: string,
  columns: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await client
      .from(view)
      .select(columns)
      .order("asin", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${view}: ${error.message}`);
    const batch = (data ?? []) as unknown[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function asRow(value: unknown): FindabilityRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<FindabilityRow>;
  if (typeof row.asin !== "string" || !row.asin) return null;
  return {
    asin: row.asin,
    title: row.title ?? null,
    category: row.category ?? null,
    product_kind: row.product_kind ?? null,
    latest_state: row.latest_state ?? null,
    latest_canonical_url: row.latest_canonical_url ?? null,
    latest_variant_sku: row.latest_variant_sku ?? null,
    confidence: row.confidence ?? null,
    explanation: row.explanation ?? null,
    source_method: row.source_method ?? null,
    http_status: typeof row.http_status === "number" ? row.http_status : null,
    latest_attempt_at: row.latest_attempt_at ?? null,
    jsonld_status: row.jsonld_status ?? null,
    counts_as_confirmed: row.counts_as_confirmed ?? null,
    counts_as_finished_search: row.counts_as_finished_search ?? null,
    counts_as_ambiguous: row.counts_as_ambiguous ?? null,
    counts_as_unchecked: row.counts_as_unchecked ?? null,
    counts_as_completed_not_found: row.counts_as_completed_not_found ?? null,
    counts_as_blocked: row.counts_as_blocked ?? null,
    counts_as_timeout: row.counts_as_timeout ?? null,
    counts_as_parse_failure: row.counts_as_parse_failure ?? null,
    counts_as_unsupported: row.counts_as_unsupported ?? null,
    ...(typeof row.on_brand_sheet === "boolean" ? { on_brand_sheet: row.on_brand_sheet } : {}),
  };
}

/** Columns for the brand on screen. Only brand-led clients' views carry on_brand_sheet. */
export function findabilityColumns(): string {
  return activeClient().key === "fender" ? FINDABILITY_COLUMNS : `${FINDABILITY_COLUMNS},on_brand_sheet`;
}

function dealerBundleMap(rows: unknown[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const row = value as { asin?: unknown; is_bundle?: unknown };
    if (typeof row.asin !== "string" || !row.asin) continue;
    if (typeof row.is_bundle === "boolean") map.set(row.asin, row.is_bundle);
  }
  return map;
}

/**
 * Reads public.canvas_spec_findability. Dealer-bundle flags are attached from
 * the retail read when that query succeeds. A failed retail read does not
 * drop the official-page rows.
 */
export async function loadFindabilityRead(client: FindabilityClient): Promise<FindabilityRead> {
  try {
    const columns = findabilityColumns();
    let stored: unknown[];
    try {
      stored = await readAll(client, "canvas_spec_findability", columns);
    } catch (error) {
      // A view without the sheet flag still loads; the sheet context is simply not shown.
      if (columns === FINDABILITY_COLUMNS) throw error;
      stored = await readAll(client, "canvas_spec_findability", FINDABILITY_COLUMNS);
    }
    const rows = stored.map(asRow).filter((row): row is FindabilityRow => row != null);
    let bundles: Map<string, boolean> | null = null;
    try {
      bundles = dealerBundleMap(await readAll(client, "canvas_retail_listings", DEALER_BUNDLE_COLUMNS));
    } catch {
      bundles = null;
    }
    const withContext = bundles
      ? rows.map((row) => ({
          ...row,
          dealer_bundle: bundles.has(row.asin) ? bundles.get(row.asin)! : null,
        }))
      : rows;
    return { phase: "ready", rows: withContext, dealerBundleLoaded: bundles != null };
  } catch (error) {
    return {
      phase: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
