/**
 * Out-of-stock and missed-sales reading for Catalog Health (worker 18.6).
 * Rows come from public.canvas_listing_sales_loss_v2 (one per listing: live listings plus every
 * listing in the retail read, including listings with no active offer) and
 * public.canvas_listing_offer_state_v2 (the dated stretches behind each row).
 * Day counts are Keepa. Sales come from one named source per listing, in order: the brand's own
 * reported Amazon sales (brand-led clients only, not collected yet), then SmartScout. A listing with
 * neither is awaiting inputs, never $0. Dollar figures are analyst estimates. No 80% factor applies
 * here; that is the R-06 suppression figure.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import { combineStale, mergePartial, RECHECK_DAYS, rowsStale } from "@/lib/fender-canvas/row-stale";
import { getCanvasSupabase } from "../supabase/canvas-client";

export type RevenueSource = "brand_reported" | "smartscout";

export type AwaitingInputsReason =
  | "no_keepa_history"
  | "no_sales_source"
  | "smartscout_reports_no_sales"
  | "too_few_in_stock_days";

export type StockLossRow = {
  asin: string;
  title: string | null;
  featured_offer_state: string | null;
  offline_now: boolean | null;
  current_oos_days: number | null;
  smartscout_snapshot_date: string | null;
  smartscout_monthly_revenue: number | null;
  smartscout_ttm_revenue: number | null;
  history_through: string | null;
  in_stock_days_30: number | null;
  oos_days_30: number | null;
  oos_days_90: number | null;
  observed_days_365: number | null;
  in_stock_days_365: number | null;
  oos_days_365: number | null;
  no_buy_box_days_365: number | null;
  revenue_source: RevenueSource | null;
  baseline_method: "smartscout_ttm" | "smartscout_30d" | null;
  in_stock_days_used: number | null;
  baseline_daily_revenue: number | null;
  est_lost_revenue_oos_30: number | null;
  est_lost_revenue_oos_90: number | null;
  est_lost_revenue_oos_365: number | null;
  awaiting_inputs_reason: AwaitingInputsReason | null;
};

export type StockEpisode = {
  asin: string;
  state: "out_of_stock" | "no_buy_box";
  start_day: string;
  end_day: string;
  days: number;
  ongoing: boolean;
};

/** Lookback windows, in days. Each is also the estimate for the next period of the same length. */
export type LossWindow = 30 | 90 | 365;
export const LOSS_WINDOWS: readonly LossWindow[] = [30, 90, 365];

export const WINDOW_LABELS: Record<LossWindow, string> = {
  30: "last 30 days",
  90: "last 90 days",
  365: "last 12 months",
};

export const REVENUE_SOURCE_LABELS: Record<RevenueSource, string> = {
  brand_reported: "Brand-reported",
  smartscout: "SmartScout",
};

export const STOCK_LOSS_COLUMNS =
  "asin,title,featured_offer_state,offline_now,current_oos_days,smartscout_snapshot_date,smartscout_monthly_revenue,smartscout_ttm_revenue,history_through,in_stock_days_30,oos_days_30,oos_days_90,observed_days_365,in_stock_days_365,oos_days_365,no_buy_box_days_365,revenue_source,baseline_method,in_stock_days_used,baseline_daily_revenue,est_lost_revenue_oos_30,est_lost_revenue_oos_90,est_lost_revenue_oos_365,awaiting_inputs_reason";

const SALES_LOSS_VIEW = "canvas_listing_sales_loss_v2";
const OFFER_STATE_VIEW = "canvas_listing_offer_state_v2";
const PAGE_SIZE = 1000;

/** Listings with at least one out-of-stock day in the last 365. */
export function stockLossRowsQuery(page = 0, size = PAGE_SIZE) {
  return getCanvasSupabase()
    .from(SALES_LOSS_VIEW)
    .select(STOCK_LOSS_COLUMNS, { count: "exact" })
    .gt("oos_days_365", 0)
    .order("asin")
    .range(page * size, page * size + size - 1);
}

/** Every listing in the population, so the coverage line can say how many are not shown. */
export function stockLossPopulationCountQuery() {
  return getCanvasSupabase().from(SALES_LOSS_VIEW).select("asin", { count: "exact", head: true });
}

export function stockEpisodesQuery(asin: string) {
  return getCanvasSupabase()
    .from(OFFER_STATE_VIEW)
    .select("asin,state,start_day,end_day,days,ongoing")
    .eq("asin", asin)
    .order("start_day", { ascending: false });
}

export async function loadStockLossRows(): Promise<
  { available: false } | { available: true; rows: StockLossRow[]; populationCount: number | null }
> {
  const rows: StockLossRow[] = [];
  for (let page = 0; page < 10; page += 1) {
    const { data, error, count } = await stockLossRowsQuery(page, PAGE_SIZE);
    if (error) return { available: false };
    const batch = (data ?? []) as unknown as StockLossRow[];
    rows.push(...batch);
    if (rows.length >= (count ?? rows.length) || batch.length < PAGE_SIZE) {
      const population = await stockLossPopulationCountQuery();
      return { available: true, rows, populationCount: population.error ? null : population.count };
    }
  }
  return { available: false };
}

export function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function oosDays(row: StockLossRow, window: LossWindow): number | null {
  if (window === 30) return num(row.oos_days_30);
  if (window === 90) return num(row.oos_days_90);
  return num(row.oos_days_365);
}

/** Missed sales for one window, or null when the listing is awaiting inputs. */
export function lostSales(row: StockLossRow, window: LossWindow = 365): number | null {
  if (!row.revenue_source) return null;
  if (window === 30) return num(row.est_lost_revenue_oos_30);
  if (window === 90) return num(row.est_lost_revenue_oos_90);
  return num(row.est_lost_revenue_oos_365);
}

/**
 * Totals for one window, kept apart by sales source. Awaiting-inputs listings drop out of every
 * total and are counted on their own. An empty source has no dollar (null), never $0.
 */
export type LostSalesSum = {
  window: LossWindow;
  /** One total per source that has at least one listing. */
  bySource: { source: RevenueSource; total: number; count: number }[];
  /** Listings with a sales source. */
  estimatedCount: number;
  /** Listings with no sales source (not in any total). */
  awaitingCount: number;
  /** Listings out of stock at least one day in the last 12 months (the row set). */
  affectedCount: number;
};

const SOURCE_ORDER: readonly RevenueSource[] = ["brand_reported", "smartscout"];

export function sumLostSales(rows: readonly StockLossRow[], window: LossWindow = 365): LostSalesSum {
  const totals = new Map<RevenueSource, { total: number; count: number }>();
  let awaitingCount = 0;
  for (const row of rows) {
    const lost = lostSales(row, window);
    if (lost == null || !row.revenue_source) {
      awaitingCount += 1;
      continue;
    }
    const entry = totals.get(row.revenue_source) ?? { total: 0, count: 0 };
    entry.total += lost;
    entry.count += 1;
    totals.set(row.revenue_source, entry);
  }
  const bySource = SOURCE_ORDER.filter((source) => totals.has(source)).map((source) => ({
    source,
    ...totals.get(source)!,
  }));
  return {
    window,
    bySource,
    estimatedCount: bySource.reduce((n, s) => n + s.count, 0),
    awaitingCount,
    affectedCount: rows.length,
  };
}

/** Pie of estimated vs awaiting inputs among the out-of-stock population. */
export function lostSalesPopulationPie(sum: LostSalesSum): PieDiscData | null {
  if (sum.affectedCount <= 0) return null;
  return {
    id: "stock-loss-population",
    title: "Out-of-stock listings",
    total: sum.affectedCount,
    totalLabel: "listings out of stock at least one day in the last 12 months",
    slices: [
      { key: "matched", label: "Estimated", count: sum.estimatedCount },
      { key: "contradicted", label: "Awaiting inputs", count: sum.awaitingCount },
    ].filter((slice) => slice.count > 0),
  };
}

/** Larger 12-month estimate first. Awaiting-inputs listings follow, most out-of-stock days first. */
export function defaultStockLossOrder(rows: readonly StockLossRow[]): StockLossRow[] {
  return [...rows].sort((a, b) => {
    const la = lostSales(a);
    const lb = lostSales(b);
    if (la != null && lb != null && la !== lb) return lb - la;
    if (la != null && lb == null) return -1;
    if (la == null && lb != null) return 1;
    return (num(b.oos_days_365) ?? 0) - (num(a.oos_days_365) ?? 0);
  });
}

/** The sales input in words, e.g. "SmartScout revenue, last 12 months". */
export function baselineInput(row: StockLossRow): { label: string; value: number | null; days: number | null } {
  if (row.baseline_method === "smartscout_30d") {
    return {
      label: "SmartScout revenue, last 30 days",
      value: num(row.smartscout_monthly_revenue),
      days: num(row.in_stock_days_used),
    };
  }
  return {
    label: "SmartScout revenue, last 12 months",
    value: num(row.smartscout_ttm_revenue),
    days: num(row.in_stock_days_used),
  };
}

/** Why a listing is awaiting inputs. Never a zero. */
export function awaitingInputsReason(row: StockLossRow): string {
  switch (row.awaiting_inputs_reason) {
    case "no_keepa_history":
      return "Keepa has no daily history for this listing yet.";
    case "no_sales_source":
      return "No sales source covers this listing: SmartScout does not track it, and the brand's own Amazon sales are not available because the brand is not the seller.";
    case "smartscout_reports_no_sales":
      return "SmartScout tracks this listing but reports no sales for it.";
    case "too_few_in_stock_days":
      return "Too few in-stock days to set a sales rate (30 in the last year, or 7 in the last 30 days).";
    default:
      return "No sales source covers this listing.";
  }
}

const AWAITING_REASON_PHRASE: Record<AwaitingInputsReason, string> = {
  no_keepa_history: "with no Keepa history yet",
  no_sales_source: "with no sales source",
  smartscout_reports_no_sales: "where SmartScout reports no sales",
  too_few_in_stock_days: "with too few in-stock days to set a sales rate",
};

const AWAITING_REASON_ORDER: readonly AwaitingInputsReason[] = [
  "no_sales_source",
  "smartscout_reports_no_sales",
  "too_few_in_stock_days",
  "no_keepa_history",
];

/**
 * How many listings are awaiting inputs, by reason, as one sentence for the total's tooltip.
 * Null when every listing is estimated.
 */
export function awaitingInputsBreakdown(rows: readonly StockLossRow[], window: LossWindow = 365): string | null {
  const counts = new Map<AwaitingInputsReason, number>();
  let awaiting = 0;
  for (const row of rows) {
    if (lostSales(row, window) != null && row.revenue_source) continue;
    awaiting += 1;
    const reason = row.awaiting_inputs_reason ?? "no_sales_source";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  if (awaiting === 0) return null;
  const parts = AWAITING_REASON_ORDER.filter((reason) => counts.has(reason)).map(
    (reason) => `${new Intl.NumberFormat("en-US").format(counts.get(reason)!)} ${AWAITING_REASON_PHRASE[reason]}`,
  );
  const count = new Intl.NumberFormat("en-US").format(awaiting);
  return `${count} ${awaiting === 1 ? "listing is" : "listings are"} awaiting inputs and ${awaiting === 1 ? "is" : "are"} not counted as $0: ${parts.join("; ")}.`;
}

export function noActiveOffer(row: StockLossRow): boolean {
  return row.featured_offer_state === "no_active_offer";
}

export const EPISODE_STATE_LABELS: Record<StockEpisode["state"], string> = {
  out_of_stock: "Out of stock",
  no_buy_box: "No Buy Box",
};

/** The dated-stretch table's columns, shared by the screen and its CSV. */
export const EPISODE_COLUMNS = [
  { id: "state", name: "What happened", sort: "text", width: 150 },
  { id: "started", name: "Started", sort: "date", width: 130 },
  { id: "ended", name: "Ended", sort: "date", width: 130 },
  { id: "days", name: "Days", sort: "number", width: 90 },
] as const;

/** The React key of one stretch, and its row key in a download. */
export function episodeKey(episode: Pick<StockEpisode, "state" | "start_day">): string {
  return `${episode.state}-${episode.start_day}`;
}

export function episodeEndLabel(episode: Pick<StockEpisode, "ongoing" | "end_day">): string {
  return episode.ongoing ? "Still going" : (formatDay(episode.end_day) ?? "");
}

export function keepaHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://keepa.com/#!product/1-${asin}` : null;
}

export function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(day: string | null | undefined): string | null {
  if (!day) return null;
  const at = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(at.getTime()) ? dayFormat.format(at) : null;
}

/**
 * X-25 per-row stale reading for the lost-sales totals. Each listing in a total has its own
 * Keepa history (history_through, rechecked daily) and, when SmartScout supplies its sales, its
 * own SmartScout snapshot (smartscout_snapshot_date, rechecked every 7 days).
 */
export function lostSalesStale(
  rows: readonly StockLossRow[],
  window: LossWindow = 365,
  now: number = Date.now(),
): PartialFigure | null {
  const estimated = rows.filter((row) => row.revenue_source && lostSales(row, window) != null);
  const smartscout = estimated.filter((row) => row.revenue_source === "smartscout");
  return combineStale(
    [
      {
        label: "Keepa stock history",
        stale: rowsStale(
          estimated,
          (row) => row.history_through,
          { intervalDays: RECHECK_DAYS.keepa, check: "Keepa history update", source: "canvas_listing_sales_loss_v2", figure: "missed-sales totals" },
          now,
        ),
      },
      {
        label: "SmartScout unit estimates",
        stale: rowsStale(
          smartscout,
          (row) => row.smartscout_snapshot_date,
          { intervalDays: RECHECK_DAYS.smartscout, check: "SmartScout snapshot", source: "canvas_listing_sales_loss_v2", figure: "missed-sales totals" },
          now,
        ),
      },
    ],
    "missed-sales totals",
  );
}

/** The X-25 asterisk on a lost-sales total: the listings it leaves out, and the older inputs it includes. */
export function lostSalesPartial(
  rows: readonly StockLossRow[],
  sum: LostSalesSum,
  now: number = Date.now(),
): PartialFigure | null {
  const missing = awaitingInputsBreakdown(rows, sum.window);
  const coverage: PartialFigure | null = missing
    ? {
        reason: "coverage",
        missing,
        coverage: `${formatInt(sum.estimatedCount)} of ${formatInt(sum.affectedCount)} listings out of stock at least one day in the last 12 months`,
        source: "SmartScout sales and Keepa stock history",
        effect: "The total covers only the estimated listings, so it is lower than the full figure.",
      }
    : null;
  return mergePartial(coverage, lostSalesStale(rows, sum.window, now));
}
