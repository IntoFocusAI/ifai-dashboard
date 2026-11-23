import type { SupabaseClient } from "@supabase/supabase-js";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";
import {
  assembleCanvasBundle,
  BUNDLE_READ_KEYS,
  CANVAS_READ_TIMEOUT_MS,
  withReadTimeout,
  type BundleReadKey,
  type CanvasReadResult,
} from "@/lib/fender-canvas/canvas-reads";
import { loadActuationBasis } from "@/lib/fender-canvas/actuation-basis-read";
import { WITHHELD_CAUSE_COLUMNS } from "@/lib/fender-canvas/buy-box-cause";
import { loadListingContent, type ListingContentClient } from "@/lib/fender-canvas/listing-content";
import { loadSpecPages, type SpecPageClient } from "@/lib/fender-canvas/machine-readability";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * Each read settles on its own, so one failed or hung view leaves the rest of the
 * bundle (and the map) standing. Throws only when every bundle read fails.
 */
export async function loadCanvas(
  client?: SupabaseClient,
  timeoutMs = CANVAS_READ_TIMEOUT_MS,
): Promise<CanvasBundle> {
  const supabase = client ?? getCanvasSupabase();
  const limit = <T>(read: PromiseLike<T>) => withReadTimeout(read, timeoutMs);
  const specPages = Promise.allSettled([limit(loadSpecPages(supabase as unknown as SpecPageClient))]);
  const listingContent = Promise.allSettled([
    limit(loadListingContent(supabase as unknown as ListingContentClient)),
  ]);
  // SC-03: the Actuation basis rides with the bundle so every Consensus figure reads the same one.
  const actuation = limit(loadActuationBasis()).catch(() => null);
  const queries: Record<BundleReadKey, PromiseLike<CanvasReadResult>> = {
    m: supabase.from("canvas_metrics").select("*").single(),
    cats: supabase.from("canvas_ai_category").select("*").order("fender_win_pct"),
    engines: supabase.from("canvas_ai_engine").select("*"),
    sov: supabase.from("canvas_competitor_sov").select("*").order("wins", { ascending: false }),
    divisions: supabase
      .from("canvas_divisions")
      .select("*")
      .order("monitored_skus", { ascending: false }),
    missing: supabase
      .from("canvas_spec_missing_fields")
      .select("*")
      .order("sku_count", { ascending: false }),
    fresh: supabase.from("canvas_freshness").select("*"),
  };

  const settled = await Promise.allSettled(BUNDLE_READ_KEYS.map((key) => limit(queries[key])));
  const reads = Object.fromEntries(
    BUNDLE_READ_KEYS.map((key, index) => [key, settled[index]]),
  ) as Record<BundleReadKey, PromiseSettledResult<CanvasReadResult>>;
  const [[specPagesRead], [listingContentRead], actuationRead] = await Promise.all([specPages, listingContent, actuation]);
  return {
    ...assembleCanvasBundle(reads, { specPages: specPagesRead, listingContent: listingContentRead }),
    actuation: actuationRead,
  };
}

export function listingsQuery(
  page = 0,
  size = 50,
  filter?: { status?: string; violationsOnly?: boolean; bundlesOnly?: boolean },
) {
  const supabase = getCanvasSupabase();
  let q = supabase
    .from("canvas_retail_listings")
    .select("*", { count: "exact" })
    .order("worst_leakage", { ascending: true, nullsFirst: false })
    .range(page * size, page * size + size - 1);
  if (filter?.status) q = q.eq("buybox_status", filter.status);
  if (filter?.violationsOnly) q = q.eq("is_map_violation", true);
  if (filter?.bundlesOnly) q = q.eq("is_bundle", true);
  return q;
}

/** A retailer the MAP channel lines count carried listings for. */
export type RetailCarryChannel = "amazon" | "walmart" | "musiciansfriend";

/**
 * Head count of the retail listing read.
 * No options: every listing in the read.
 * `carriedBy` keeps the listings that retailer carries: Walmart has a stored page URL or a price
 * above zero; Musician's Friend has a price above zero (no page is stored); every listing is an
 * Amazon listing.
 * `priced` keeps rows whose price at that retailer is greater than zero. A null or non-positive
 * price is not in that count.
 */
export function retailListingHeadCountQuery(options?: {
  carriedBy?: RetailCarryChannel;
  priced?: RetailCarryChannel;
}) {
  const supabase = getCanvasSupabase();
  let query = supabase
    .from("canvas_retail_listings")
    .select("asin", { count: "exact", head: true });
  const priceColumn = { amazon: "offer_price", walmart: "wmt_price", musiciansfriend: "mf_price" } as const;
  if (options?.carriedBy === "walmart") query = query.or("wmt_price.gt.0,wmt_url.like.http%");
  else if (options?.carriedBy === "musiciansfriend") query = query.gt("mf_price", 0);
  if (options?.priced) query = query.gt(priceColumn[options.priced], 0);
  return query;
}

/**
 * One existing row, so a view without the Featured Offer state columns stays a normal
 * listing read instead of a filtered request for a column the view does not have yet.
 */
export async function featuredOfferColumnProbe(): Promise<{
  present: boolean;
  error: { message: string } | null;
}> {
  const supabase = getCanvasSupabase();
  const { data, error } = await supabase.from("canvas_retail_listings").select("*").limit(1);
  if (error) return { present: false, error };
  const sample = (data ?? [])[0] as Record<string, unknown> | undefined;
  return { present: sample != null && "featured_offer_state" in sample, error: null };
}

/**
 * Every listing whose current Featured Offer state is withheld. Confirmed high-price
 * suppression is the subset the reading can compare against Amazon's outside price,
 * and the table marks it. A withheld listing with no benchmark still belongs here. The stored cause
 * and the stored outside prices ride along for the cause split (buy-box-cause.ts).
 */
export function suppressedListingsQuery(page = 0, size = 1000) {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_retail_listings")
    .select(WITHHELD_CAUSE_COLUMNS, { count: "exact" })
    .eq("featured_offer_state", "withheld")
    .order("asin")
    .range(page * size, page * size + size - 1);
}

/** Listings the Featured Offer collector has classified. Zero means no reading is stored yet. */
export function featuredOfferReadingCountQuery() {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_retail_listings")
    .select("asin", { count: "exact", head: true })
    .not("featured_offer_state", "is", null);
}

/** Flagged simulation rows, including stored root_cause text. Pages through the read. */
export async function hallucinationCauseRowsQuery() {
  const supabase = getCanvasSupabase();
  const pageSize = 1000;
  const rows: Array<{
    root_cause: string | null;
    engine: string | null;
    category: string | null;
    prompt: string | null;
  }> = [];

  for (let page = 0; page < 20; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("canvas_ai_simulations")
      .select("root_cause,engine,category,prompt")
      .eq("hallucination_flag", true)
      .range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return { data: rows, error: null };
}

export function simulationsQuery(category?: string, page = 0, size = 50) {
  const supabase = getCanvasSupabase();
  let q = supabase
    .from("canvas_ai_simulations")
    .select(
      "id,engine,category,prompt,winner,is_resolved,hallucination_flag,root_cause,remediation_patch,created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  if (category) q = q.eq("category", category);
  return q;
}

export function simulationDetailQuery(id: string) {
  const supabase = getCanvasSupabase();
  return supabase
    .from("canvas_ai_simulations")
    .select("answer_text,citation_urls,root_cause,remediation_patch")
    .eq("id", id)
    .single();
}

export type SpecRowsFilter = {
  /** Checked SKUs with no stored fender.com page. A null flag stays out. */
  missingFenderPage?: boolean;
};

/**
 * Catalog Readiness is the only tab that may ask for this filter.
 * A null fender_found stays out.
 */
export function specRowsFilter(
  catalogReadiness: boolean,
  missingPagesOnly: boolean,
): SpecRowsFilter | undefined {
  if (!catalogReadiness || !missingPagesOnly) return undefined;
  return { missingFenderPage: true };
}

type SpecReadResult = PromiseLike<{
  data: unknown;
  count: number | null;
  error: { message: string } | null;
}>;

type SpecReadOrdered = SpecReadResult & {
  eq: (column: "fender_found", value: false) => SpecReadOrdered;
  range: (from: number, to: number) => SpecReadOrdered;
};

type SpecReadClient = {
  from: (table: string) => {
    select: (
      columns: string,
      options: { count: "exact" },
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => SpecReadOrdered;
    };
  };
};

export function specRowsQuery(
  page = 0,
  size = 50,
  filter?: SpecRowsFilter,
  client?: SpecReadClient,
) {
  const supabase = client ?? (getCanvasSupabase() as unknown as SpecReadClient);
  let query = supabase
    .from("canvas_spec_readiness")
    .select("*", { count: "exact" })
    .order("amazon_completeness_pct", { ascending: true });
  if (filter?.missingFenderPage) query = query.eq("fender_found", false);
  return query.range(page * size, page * size + size - 1);
}

