// The one place that reads a client's listings into the estimate formulas (decision 112, E3).
//
// Reads the four canvas views the proposal's section 2 table names, through the active client's
// canvas client (lib/supabase/canvas-client), joins them per listing into EstimateListingInput, and
// runs lines 1 to 7 and the rollups. Nothing here names a client: the schema, column names and rank
// category come from the client's settings record.
//
//   Phase 1      lines 1, 2, 4, 5, 7 added (rollupPhase1)
//   MAP          line 3, shown beside Phase 1, never added (overlap rule 2)
//   Held         line 6, miscategorized listings, until the D-12 check exists
//
// A listing with no sales figure is counted as Not available*, never $0.

import { RANK_CURVES } from "./benchmarks";
import { calibrateRankCurve, type RankCurve } from "./rank-curve";
import { estimateListingLines, type ListingEstimates } from "./rollup";
import { rankCurvePoints, type SalesContext } from "./sales-coverage";
import type { EstimateLineId, EstimateListingInput, EstimateRange, EstimateResult } from "./types";

/** canvas_listing_sales_loss_v2: one row per listing (live listings plus the retail read). */
export type SalesLossInputRow = {
  asin: string;
  title?: string | null;
  current_price?: number | string | null;
  sales_rank_current?: number | string | null;
  smartscout_snapshot_date?: string | null;
  smartscout_ttm_revenue?: number | string | null;
  smartscout_monthly_units?: number | string | null;
  baseline_daily_revenue?: number | string | null;
  est_lost_revenue_oos_365?: number | string | null;
  in_stock_days_30?: number | string | null;
  in_stock_days_365?: number | string | null;
  oos_days_365?: number | string | null;
  no_buy_box_days_365?: number | string | null;
  observed_days_365?: number | string | null;
  is_bundle?: boolean | null;
};

/** canvas_retail_listings: the Amazon offer read. */
export type RetailInputRow = {
  asin: string;
  title?: string | null;
  offer_price?: number | string | null;
  sales_rank?: number | string | null;
  monthly_sold?: number | string | null;
  amz_leakage?: number | string | null;
  is_bundle?: boolean | null;
  parent_asin?: string | null;
};

/** canvas_spec_readiness: Amazon spec completeness. */
export type SpecInputRow = {
  asin: string;
  amazon_checked?: boolean | null;
  amazon_completeness_pct?: number | string | null;
};

/** canvas_listing_content: A+ content state. */
export type ContentInputRow = {
  asin: string;
  aplus_state?: string | null;
};

export type EstimateViewRows = {
  sales: SalesLossInputRow[];
  retail: RetailInputRow[];
  spec: SpecInputRow[];
  content: ContentInputRow[];
};

/** The columns each view is read with. Kept to what the formulas use. */
export const ESTIMATE_VIEW_COLUMNS = {
  canvas_listing_sales_loss_v2:
    "asin,title,current_price,sales_rank_current,smartscout_snapshot_date,smartscout_ttm_revenue,smartscout_monthly_units,baseline_daily_revenue,est_lost_revenue_oos_365,in_stock_days_30,in_stock_days_365,oos_days_365,no_buy_box_days_365,observed_days_365,is_bundle",
  canvas_retail_listings: "asin,title,offer_price,sales_rank,monthly_sold,amz_leakage,is_bundle,parent_asin",
  canvas_spec_readiness: "asin,amazon_checked,amazon_completeness_pct",
  canvas_listing_content: "asin,aplus_state",
} as const;

export type EstimateView = keyof typeof ESTIMATE_VIEW_COLUMNS;

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Joins the four views into one input per listing. The population is every listing in any of the
 * views. Price is the sales view's current price, else the retail read's offer price; sales rank
 * likewise. Spec completeness counts only when Amazon was checked.
 */
export function joinEstimateListings(rows: EstimateViewRows, rankCategory: string | null): EstimateListingInput[] {
  const byAsin = new Map<string, EstimateListingInput>();
  const get = (asin: string) => {
    let l = byAsin.get(asin);
    if (!l) {
      l = { asin, rankCategory };
      byAsin.set(asin, l);
    }
    return l;
  };
  for (const r of rows.sales) {
    if (!r.asin) continue;
    const l = get(r.asin);
    l.title = r.title ?? l.title ?? null;
    l.price = num(r.current_price);
    l.salesRank = num(r.sales_rank_current);
    l.smartscoutHasRecord = Boolean(r.smartscout_snapshot_date);
    l.smartscoutTtmRevenue = num(r.smartscout_ttm_revenue);
    l.smartscoutMonthlyUnits = num(r.smartscout_monthly_units);
    l.baselineDailyRevenue = num(r.baseline_daily_revenue);
    l.missedSalesOos365 = num(r.est_lost_revenue_oos_365);
    l.inStockDays30 = num(r.in_stock_days_30);
    l.inStockDays365 = num(r.in_stock_days_365);
    l.oosDays365 = num(r.oos_days_365);
    l.noBuyBoxDays365 = num(r.no_buy_box_days_365);
    l.observedDays365 = num(r.observed_days_365);
    if (r.is_bundle != null) l.isBundle = r.is_bundle;
  }
  for (const r of rows.retail) {
    if (!r.asin) continue;
    const l = get(r.asin);
    l.title = l.title ?? r.title ?? null;
    if (l.price == null) l.price = num(r.offer_price);
    if (l.salesRank == null) l.salesRank = num(r.sales_rank);
    l.keepaMonthlySold = num(r.monthly_sold);
    l.amzLeakage = num(r.amz_leakage);
    if (r.is_bundle != null) l.isBundle = r.is_bundle;
    l.parentAsin = r.parent_asin ?? null;
  }
  for (const r of rows.spec) {
    if (!r.asin) continue;
    get(r.asin).amazonCompletenessPct = r.amazon_checked === true ? num(r.amazon_completeness_pct) : null;
  }
  for (const r of rows.content) {
    if (!r.asin) continue;
    get(r.asin).aplusState = r.aplus_state ?? null;
  }
  return [...byAsin.values()];
}

/**
 * The rank curve for the client's catalog: calibrated from its own tracked listings when there are
 * enough of them, else the stored curve for its rank category. null when neither exists.
 */
export function clientRankCurves(listings: EstimateListingInput[], rankCategory: string | null, dataAsOf: string): Record<string, RankCurve> | undefined {
  if (!rankCategory) return undefined;
  const points = rankCurvePoints(listings);
  const live = calibrateRankCurve(points, {
    category: rankCategory,
    calibratedOn: dataAsOf,
    basis: `${points.length} listings SmartScout tracks, ${points.filter((p) => p.unitsPer30InStockDays > 0).length} of them with sales`,
  });
  if (live) return { [rankCategory]: live };
  const stored = RANK_CURVES[rankCategory];
  return stored ? { [rankCategory]: stored } : undefined;
}

/** One listing's part of every line it sits in. Line ranges are null when the listing is Not available*. */
export type ListingEstimate = {
  asin: string;
  title: string | null;
  lines: Partial<Record<EstimateLineId, EstimateRange | null>>;
  /** The listing's part of Phase 1 (lines 1, 2, 4, 5, 7). null when none of its Phase 1 lines is priced. */
  phase1: EstimateRange | null;
};

export type ClientEstimates = ListingEstimates & {
  /** Every line, in the proposal's order, for a table or a list of triggers. */
  lines: EstimateResult[];
  /** By ASIN: each listing's part of each line. */
  byListing: Map<string, ListingEstimate>;
  /** Listings read. */
  listingCount: number;
  dataAsOf: string;
};

const LISTING_LINES: Array<keyof Pick<ListingEstimates, "outOfStock" | "buyBox" | "mapLeakage" | "splintered" | "missingSpecs" | "miscategorized" | "aplus">> = [
  "outOfStock",
  "buyBox",
  "mapLeakage",
  "splintered",
  "missingSpecs",
  "miscategorized",
  "aplus",
];

function byListing(est: ListingEstimates): Map<string, ListingEstimate> {
  const out = new Map<string, ListingEstimate>();
  for (const key of LISTING_LINES) {
    const line = est[key];
    for (const row of line.trail.listings) {
      let entry = out.get(row.asin);
      if (!entry) {
        entry = { asin: row.asin, title: row.title, lines: {}, phase1: null };
        out.set(row.asin, entry);
      }
      entry.lines[line.lineId] = row.range;
      if (row.range && line.countsInTotal && est.phase1.parts?.some((p) => p.lineId === line.lineId)) {
        const p = entry.phase1 ?? { low: 0, mid: 0, high: 0 };
        entry.phase1 = { low: p.low + row.range.low, mid: p.mid + row.range.mid, high: p.high + row.range.high };
      }
    }
  }
  return out;
}

/** Lines 1 to 7, Phase 1 and the per-listing parts for one client's joined listings. */
export function buildClientEstimates(
  listings: EstimateListingInput[],
  opts: { rankCategory: string | null; dataAsOf: string; salesSources?: SalesContext["salesSources"] },
): ClientEstimates {
  const ctx: SalesContext = {
    dataAsOf: opts.dataAsOf,
    salesSources: opts.salesSources ?? "all",
    rankCurves: opts.salesSources === "measured_only" ? undefined : clientRankCurves(listings, opts.rankCategory, opts.dataAsOf),
  };
  const est = estimateListingLines(listings, ctx);
  return {
    ...est,
    lines: [est.outOfStock, est.buyBox, est.mapLeakage, est.splintered, est.missingSpecs, est.miscategorized, est.aplus],
    byListing: byListing(est),
    listingCount: listings.length,
    dataAsOf: opts.dataAsOf,
  };
}

/** The read client: enough of supabase-js for paged selects. */
export type EstimateReadClient = {
  from: (view: string) => {
    select: (columns: string, options?: { count?: "exact" }) => {
      order: (column: string, options?: { ascending?: boolean }) => {
        range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }>;
      };
    };
  };
};

const PAGE = 1000;
const MAX_PAGES = 50;

async function readAll<T>(client: EstimateReadClient, view: EstimateView): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await client
      .from(view)
      .select(ESTIMATE_VIEW_COLUMNS[view])
      .order("asin", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`${view}: ${error.message}`);
    const batch = (Array.isArray(data) ? data : []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Reads the four views. Any failed read fails the estimate, so no line is priced on part of the data. */
export async function loadEstimateViewRows(client: EstimateReadClient): Promise<EstimateViewRows> {
  const [sales, retail, spec, content] = await Promise.all([
    readAll<SalesLossInputRow>(client, "canvas_listing_sales_loss_v2"),
    readAll<RetailInputRow>(client, "canvas_retail_listings"),
    readAll<SpecInputRow>(client, "canvas_spec_readiness"),
    readAll<ContentInputRow>(client, "canvas_listing_content"),
  ]);
  return { sales, retail, spec, content };
}

/** Reads and prices one client's listings. The client comes from the read client and the settings passed. */
export async function loadClientEstimates(
  client: EstimateReadClient,
  settings: { amazon_rank_category?: string | null },
  dataAsOf: string = todayIso(),
): Promise<ClientEstimates> {
  const rankCategory = settings.amazon_rank_category ?? null;
  const rows = await loadEstimateViewRows(client);
  return buildClientEstimates(joinEstimateListings(rows, rankCategory), { rankCategory, dataAsOf });
}

/** Today's date as the trail's as-of date: "2026-11-18". */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
