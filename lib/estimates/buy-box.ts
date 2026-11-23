// Line 2, the Buy Box figure: R-06 and R-07 (Brian Magazu, 23 Nov 2026).
//
// Forward-looking. For each listing Amazon withholds the Buy Box from today:
//   sales per Buy Box day = its sales in the last 30 days / the days in those 30 it held the Buy Box,
//                           or, when that rate is not available (fallback, Brian Magazu 23 Nov 2026),
//                           its sales in the last 12 months / the days in the last 365 it held the Buy Box
//   figure                = sales per Buy Box day x the days in the period x the share of sales lost
//                           while the Buy Box is withheld (70% low, 80% mid, 90% high)
// The period is the shared date pill's (R-07, lib/estimates/period.ts). Phase 1 and the other
// yearly figures count a year, 365 days. This replaces the backward-looking line 2 (days without a
// Buy Box in the last 12 months x a share), so the dashboard has one Buy Box dollar figure.
//
// Sales source order (R-06, 2 Nov 2026): the brand's reported Amazon sales, then SmartScout. The
// brand's reported sales are not collected per listing yet, so SmartScout is the source: its last 30
// days, else its last 12 months. Keepa gives the day counts only. The 30-day rate needs 7 or more
// Buy Box days in the last 30 (the view's 30-day rule); the 12-month rate needs 30 or more in the
// last 365 (the sales view's own rule before it divides 12-month sales by days). A listing with
// neither rate reads Not available* with its reason and is never $0. A listing SmartScout tracks
// with no sales is measured, no sales, at $0 (decision 113). Nothing here names a client.

import { formatInt, formatMoneyShort, formatMoneySpan, formatUsd } from "@/lib/fender-canvas/format";
import { BUY_BOX_LOST_SHARE } from "./benchmarks";
import { assembleLine, times, type LinePiece } from "./line";
import type { ClientEstimates } from "./live-inputs";
import { MIN_IN_STOCK_DAYS_30, type SalesContext } from "./sales-coverage";
import type { EstimateListingInput, EstimateListingRow, EstimateRange, EstimateResult } from "./types";

/** The period Phase 1 and every yearly figure count. */
export const YEAR_DAYS = 365;
/** The window the sales rate is read over first. */
export const BUY_BOX_RATE_WINDOW_DAYS = 30;
/** Days with the Buy Box needed in the last 30 before sales are divided by them (the view's 30-day rule). */
export const MIN_BUY_BOX_DAYS_30 = MIN_IN_STOCK_DAYS_30;
/**
 * Days with the Buy Box needed in the last 365 for the 12-month rate: the 30 days the sales view
 * needs before it divides SmartScout's 12-month sales by in-stock days. Fewer would let a handful of
 * Buy Box days carry a year of sales.
 */
export const MIN_BUY_BOX_DAYS_365 = 30;

/** Which window a listing's rate came from. */
export type BuyBoxRateWindow = "last_30_days" | "last_12_months";

/** The window in plain words, for the trail and the table. */
export const BUY_BOX_RATE_WORDS: Readonly<Record<BuyBoxRateWindow, string>> = {
  last_30_days: "last 30 days",
  last_12_months: "last 12 months",
};

export type BuyBoxRateMissing = "no_keepa_days" | "no_sales_source" | "too_few_buy_box_days";

export type BuyBoxRate =
  | { ok: true; window: BuyBoxRateWindow; sales: number; buyBoxDays: number; perDay: number; reportedNoSales: boolean }
  | { ok: false; reason: BuyBoxRateMissing; buyBoxDays30: number | null; buyBoxDays365: number | null };

const num = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
const exact = (x: number): EstimateRange => ({ low: x, mid: x, high: x });
const pct = (x: number) => `${Math.round(x * 100)}%`;
const positive = (x: number | null | undefined) => (num(x) && x > 0 ? x : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Days in the last 30 the listing held the Buy Box (Keepa): in-stock days minus days with stock and no Buy Box. */
export function buyBoxDays30(l: Pick<EstimateListingInput, "inStockDays30" | "noBuyBoxDays30">): number | null {
  if (!num(l.inStockDays30) || !num(l.noBuyBoxDays30)) return null;
  return Math.max(0, l.inStockDays30 - l.noBuyBoxDays30);
}

/** Days in the last 365 the listing held the Buy Box (Keepa), counted the same way. */
export function buyBoxDays365(l: Pick<EstimateListingInput, "inStockDays365" | "noBuyBoxDays365">): number | null {
  if (!num(l.inStockDays365) || !num(l.noBuyBoxDays365)) return null;
  return Math.max(0, l.inStockDays365 - l.noBuyBoxDays365);
}

/**
 * One listing's sales per Buy Box day: the last 30 days when it held the Buy Box on 7 or more of
 * them; only when that rate is not available, the last 12 months when it held the Buy Box on 30 or
 * more of the last 365; else why it has neither.
 */
export function buyBoxRate(l: EstimateListingInput): BuyBoxRate {
  const days30 = buyBoxDays30(l);
  const days365 = buyBoxDays365(l);
  const missing = (reason: BuyBoxRateMissing): BuyBoxRate => ({ ok: false, reason, buyBoxDays30: days30, buyBoxDays365: days365 });
  if (days30 == null && days365 == null) return missing("no_keepa_days");
  if (!l.smartscoutHasRecord) return missing("no_sales_source");
  if (days30 != null && days30 >= MIN_BUY_BOX_DAYS_30) {
    const sales = positive(l.smartscoutMonthlyRevenue);
    return { ok: true, window: "last_30_days", sales, buyBoxDays: days30, perDay: sales / days30, reportedNoSales: sales === 0 };
  }
  if (days365 != null && days365 >= MIN_BUY_BOX_DAYS_365) {
    const sales = positive(l.smartscoutTtmRevenue);
    return { ok: true, window: "last_12_months", sales, buyBoxDays: days365, perDay: sales / days365, reportedNoSales: sales === 0 };
  }
  return missing("too_few_buy_box_days");
}

const RATE_RULE = `A daily sales rate needs at least ${MIN_BUY_BOX_DAYS_30} days with the Buy Box in the last 30, or at least ${MIN_BUY_BOX_DAYS_365} in the last 365.`;

/** Why a listing reads Not available*, in plain words, for its tooltip. */
export function buyBoxMissingText(rate: Extract<BuyBoxRate, { ok: false }>): string {
  if (rate.reason === "no_keepa_days") return "Keepa has no day history for this listing, so the days it held the Buy Box are not known.";
  if (rate.reason === "no_sales_source")
    return "SmartScout has no sales record for this listing and no brand-reported sales are on file, so it has no sales rate for the last 30 days or the last 12 months.";
  const d30 = rate.buyBoxDays30 == null ? "Keepa has no day history for it in the last 30 days" : `It held the Buy Box on ${rate.buyBoxDays30} of the last 30 days`;
  const d365 = rate.buyBoxDays365 == null ? "none for the last 365" : `${rate.buyBoxDays365} of the last 365`;
  return `${d30} and ${d365}. ${RATE_RULE}`;
}

/**
 * One priced listing's math in plain words, naming the window its rate came from: "last 30 days" or
 * "last 12 months". For the Estimate cell's tooltip in the Suppressed Listings table.
 */
export function buyBoxListingMath(row: Pick<EstimateListingRow, "detail" | "range">): string {
  const d = row.detail;
  const twelve = d.rateWindow === "last_12_months";
  const window = twelve ? "last 12 months" : "last 30 days";
  const of = twelve ? "of the last 365" : "of the last 30";
  const sales = typeof d.sales === "number" ? d.sales : 0;
  const days = typeof d.buyBoxDays === "number" ? d.buyBoxDays : 0;
  const rate = typeof d.salesPerBuyBoxDay === "number" ? d.salesPerBuyBoxDay : 0;
  const period = typeof d.periodDays === "number" ? d.periodDays : 0;
  const used = `Rate from the ${window}.`;
  if (sales === 0 || !row.range) return `${used} SmartScout reports no sales for this listing in the ${window}, so it adds $0. It held the Buy Box on ${days} ${of} days.`;
  const b = BUY_BOX_LOST_SHARE;
  const r = row.range;
  return (
    `${used} ${formatUsd(sales)} in the ${window} over the ${days} ${of} days it held the Buy Box is ${formatUsd(rate)} a day. ` +
    `Times ${formatInt(period)} days times ${pct(b.mid)} is ${formatMoneyShort(r.mid)}; with ${pct(b.low)} to ${pct(b.high)}, ${formatMoneySpan(r.low, r.high)}.`
  );
}

/** How the withheld listings were priced, by window: "8 priced on their last 30 days, 16 on their last 12 months, 41 Not available*." */
export function buyBoxRateSplitText(line: EstimateResult): string {
  const rows = line.trail.listings;
  const on30 = rows.filter((row) => row.range && row.detail.rateWindow === "last_30_days").length;
  const on12 = rows.filter((row) => row.range && row.detail.rateWindow === "last_12_months").length;
  const missing = rows.length - on30 - on12;
  return `${on30} priced on their last 30 days, ${on12} on their last 12 months, ${missing} Not available*.`;
}

/** "a year" for Phase 1, else "the next 30 days". */
export function periodPhrase(periodDays: number): string {
  return periodDays === YEAR_DAYS ? "in a year" : `over the next ${periodDays} ${periodDays === 1 ? "day" : "days"}`;
}

/** The formula in one plain-language passage, for an e-commerce operator. */
export function buyBoxFormula(periodDays: number): string {
  const b = BUY_BOX_LOST_SHARE;
  const period = periodDays === YEAR_DAYS ? "365 days (a year)" : `${periodDays} ${periodDays === 1 ? "day" : "days"}, the period in the date pill`;
  return (
    "For each listing Amazon withholds the Buy Box from today: take its sales in the last 30 days and divide by the days in those 30 it held the Buy Box. " +
    `When it held the Buy Box on fewer than ${MIN_BUY_BOX_DAYS_30} of those days, take its sales in the last 12 months and divide by the days in the last 365 it held the Buy Box instead. ` +
    `That is what it sells on a normal day. Multiply by ${period}, then by the share of sales a listing loses while its Buy Box is withheld ` +
    `(${pct(b.low)} low, ${pct(b.mid)} mid, ${pct(b.high)} high). Then add the listings.`
  );
}

/**
 * Line 2 for the listings withheld today, over `periodDays` (default a year, for Phase 1). Listings
 * whose Buy Box is not withheld today are not in it, whatever their earlier days.
 */
export function estimateBuyBox(listings: EstimateListingInput[], ctx: SalesContext = {}, periodDays: number = YEAR_DAYS): EstimateResult {
  const days = Math.max(1, Math.round(periodDays));
  const pieces: LinePiece[] = [];
  const sum = {
    last_30_days: { listings: 0, sales: 0, buyBoxDays: 0 },
    last_12_months: { listings: 0, sales: 0, buyBoxDays: 0 },
  };
  let perDay = 0;
  for (const l of listings) {
    if (l.buyBoxWithheld !== true) continue;
    const rate = buyBoxRate(l);
    const touched = rate.ok ? exact(rate.perDay * days) : null;
    if (rate.ok) {
      sum[rate.window].listings += 1;
      sum[rate.window].sales += rate.sales;
      sum[rate.window].buyBoxDays += rate.buyBoxDays;
      perDay += rate.perDay;
    }
    pieces.push({
      listing: l,
      quantity: rate.ok ? { source: "smartscout", range: exact(rate.perDay) } : null,
      annual: num(l.smartscoutTtmRevenue) && l.smartscoutTtmRevenue > 0 ? { source: "smartscout", range: exact(l.smartscoutTtmRevenue) } : null,
      reportedNoSales: rate.ok && rate.reportedNoSales,
      touched,
      range: touched ? times(touched, BUY_BOX_LOST_SHARE) : null,
      detail: {
        rateWindow: rate.ok ? rate.window : null,
        rateUsed: rate.ok ? BUY_BOX_RATE_WORDS[rate.window] : null,
        sales: rate.ok ? rate.sales : null,
        buyBoxDays: rate.ok ? rate.buyBoxDays : null,
        buyBoxDays30: rate.ok ? buyBoxDays30(l) : rate.buyBoxDays30,
        buyBoxDays365: rate.ok ? buyBoxDays365(l) : rate.buyBoxDays365,
        salesPerBuyBoxDay: rate.ok ? Math.round(rate.perDay * 100) / 100 : null,
        periodDays: days,
        notAvailableReason: rate.ok ? null : rate.reason,
        notAvailable: rate.ok ? null : buyBoxMissingText(rate),
      },
    });
  }
  const asOf = ctx.dataAsOf ?? null;
  const notes = [
    "It assumes each listing stays withheld for the whole period and, once the Buy Box is back, sells as it did on its Buy Box days.",
    `Each listing uses its last 30 days when it held the Buy Box on at least ${MIN_BUY_BOX_DAYS_30} of them. Otherwise it uses its last 12 months when it held the Buy Box on at least ${MIN_BUY_BOX_DAYS_365} of the last 365. The table says which one each listing used.`,
    "A listing with neither, or with no SmartScout record, reads Not available* and is left out, never counted as $0.",
    "Only listings withheld today count. Listings that lost the Buy Box on earlier days and have it back today are not in this figure.",
    "Sales in a window can include a few sales made without the Buy Box, so the daily rate can run a little high. A 12-month rate also runs high for a listing Keepa has followed for less than a year.",
  ];
  if (days === YEAR_DAYS) notes.push("Phase 1 and the other yearly figures count a year, 365 days. Suppressed Listings and Action Items count the days in the date pill.");
  const line = assembleLine(
    {
      lineId: "buy_box",
      title: "Buy Box withheld",
      means: `Sales the brand can win back ${periodPhrase(days)} by getting the Buy Box back on every listing Amazon withholds it from today.`,
      formula: buyBoxFormula(days),
      inputs: [
        { key: "listings_rate_30", label: "Listings priced on their last 30 days", value: sum.last_30_days.listings, unit: "count", kind: "derived", source: `at least ${MIN_BUY_BOX_DAYS_30} days with the Buy Box in the last 30` },
        { key: "sales_last_30", label: "Their sales in the last 30 days (SmartScout)", value: Math.round(sum.last_30_days.sales), unit: "usd", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_monthly_revenue", asOf },
        { key: "buy_box_days_30", label: "Their days with the Buy Box in the last 30 (Keepa), added", value: sum.last_30_days.buyBoxDays, unit: "days", kind: "collected", source: "canvas_listing_sales_loss_v2.in_stock_days_30 minus no_buy_box_days_30", asOf },
        { key: "listings_rate_12_months", label: "Listings priced on their last 12 months", value: sum.last_12_months.listings, unit: "count", kind: "derived", source: `fewer than ${MIN_BUY_BOX_DAYS_30} days with the Buy Box in the last 30, at least ${MIN_BUY_BOX_DAYS_365} in the last 365` },
        { key: "sales_last_12_months", label: "Their sales in the last 12 months (SmartScout)", value: Math.round(sum.last_12_months.sales), unit: "usd", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue", asOf },
        { key: "buy_box_days_365", label: "Their days with the Buy Box in the last 365 (Keepa), added", value: sum.last_12_months.buyBoxDays, unit: "days", kind: "collected", source: "canvas_listing_sales_loss_v2.in_stock_days_365 minus no_buy_box_days_365", asOf },
        { key: "sales_per_buy_box_day", label: "Sales per Buy Box day, listings added", value: Math.round(perDay * 100) / 100, unit: "usd_per_day", kind: "derived", source: "each listing's sales / its days with the Buy Box, in the window it used" },
        { key: "period_days", label: "Days in the period", value: days, unit: "days", kind: "derived", source: days === YEAR_DAYS ? "a year, for Phase 1" : "the shared date pill" },
      ],
      benchmarks: [BUY_BOX_LOST_SHARE],
      confidence: "medium",
      confidenceReason:
        "Sales and Buy Box days are measured for each listing. The share of sales lost while the Buy Box is withheld is an IntoFocus assumption with a peer-reviewed study behind its direction.",
      mostImprovedBy: "IntoFocus's own measurement of each listing's sales with and without the Buy Box, to replace the 70% to 90% share.",
      notes,
      countsInTotal: true,
    },
    pieces,
    [],
    asOf,
  );
  // Never $0 for unknown (Brian Magazu, 23 Nov 2026): when no priced listing has sales, the figure is
  // not known. It reads Not available* everywhere, and Phase 1 leaves it out. Each listing priced at a
  // measured $0 keeps its own $0 row.
  if (line.status !== "estimated" || buyBoxHasSales(line)) return line;
  return { ...line, status: "not_available", range: null, trail: { ...line.trail, notes: [...line.trail.notes, buyBoxUnknownText(line)] } };
}

/** True when at least one priced listing has sales, so the figure is more than a string of measured $0s. */
export function buyBoxHasSales(line: EstimateResult): boolean {
  return line.trail.listings.some((row) => (row.range?.mid ?? 0) > 0);
}

/**
 * The tooltip when no priced listing has sales: how many listings could be priced, and why the
 * rest could not. The headline then reads Not available*, never $0 (Brian Magazu, 23 Nov 2026).
 */
export function buyBoxUnknownText(line: EstimateResult): string {
  const rows = line.trail.listings;
  const priced = rows.filter((row) => row.range).length;
  const reasons = { no_sales_source: 0, too_few_buy_box_days: 0, no_keepa_days: 0 };
  for (const row of rows) {
    const reason = row.range ? null : row.detail.notAvailableReason;
    if (reason === "no_sales_source" || reason === "too_few_buy_box_days" || reason === "no_keepa_days") reasons[reason] += 1;
  }
  const lead =
    priced === 0
      ? `None of the ${plural(rows.length, "withheld listing", "withheld listings")} could be priced.`
      : `${priced} of ${plural(rows.length, "withheld listing", "withheld listings")} could be priced, and SmartScout reports no sales for ${priced === 1 ? "it" : "them"}, so the figure is not known rather than $0.`;
  const rest = [
    reasons.no_sales_source ? `${plural(reasons.no_sales_source, "has", "have")} no SmartScout sales record` : null,
    reasons.too_few_buy_box_days ? `${plural(reasons.too_few_buy_box_days, "held", "held")} the Buy Box on too few days (${MIN_BUY_BOX_DAYS_30} of the last 30 or ${MIN_BUY_BOX_DAYS_365} of the last 365 are needed)` : null,
    reasons.no_keepa_days ? `${plural(reasons.no_keepa_days, "has", "have")} no Keepa day history` : null,
  ].filter((part): part is string => part != null);
  return rest.length ? `${lead} Of the rest, ${rest.join("; ")}.` : lead;
}

const periodCache = new WeakMap<ClientEstimates, Map<number, EstimateResult>>();

/**
 * Line 2 for a period (R-07), from the client's joined listings. `keep` narrows it to some of the
 * withheld listings (an Action Items cause row); the caller caches those.
 */
export function buyBoxForPeriod(est: ClientEstimates, periodDays: number, keep?: (asin: string) => boolean): EstimateResult {
  if (keep) return estimateBuyBox(est.inputs.filter((l) => keep(l.asin)), est.ctx, periodDays);
  let byDays = periodCache.get(est);
  if (!byDays) {
    byDays = new Map();
    periodCache.set(est, byDays);
  }
  const hit = byDays.get(periodDays);
  if (hit) return hit;
  const line = estimateBuyBox(est.inputs, est.ctx, periodDays);
  byDays.set(periodDays, line);
  return line;
}

/** The 30-day mid (Priorities, the map, rank ties), or null when it is not known: never $0 for unknown. */
export function buyBoxKnownMid(line: EstimateResult): number | null {
  return buyBoxHasSales(line) ? (line.range?.mid ?? null) : null;
}
