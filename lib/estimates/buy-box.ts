// Line 2, the Buy Box figure: R-06 and R-07 (Brian Magazu, 23 Nov 2026).
//
// Forward-looking. For each listing Amazon withholds the Buy Box from today:
//   sales per Buy Box day = its sales in the last 30 days / the days in those 30 it held the Buy Box
//   figure                = sales per Buy Box day x the days in the period x the share of sales lost
//                           while the Buy Box is withheld (70% low, 80% mid, 90% high)
// The period is the shared date pill's (R-07, lib/estimates/period.ts). Phase 1 and the other
// yearly figures count a year, 365 days. This replaces the backward-looking line 2 (days without a
// Buy Box in the last 12 months), so the dashboard has one Buy Box dollar figure.
//
// Sales source order (R-06, 2 Nov 2026): the brand's reported Amazon sales, then SmartScout. The
// brand's reported sales are not collected per listing for the last 30 days yet, so SmartScout's
// last 30 days is the source. Keepa gives the day counts only. A listing with no Keepa days, no
// SmartScout record, or fewer than 7 days with the Buy Box in the last 30 reads Not available* and
// is never $0. A listing SmartScout tracks with no sales in the last 30 days is measured, no sales,
// at $0 (decision 113). Nothing here names a client.

import { BUY_BOX_LOST_SHARE } from "./benchmarks";
import { assembleLine, times, type LinePiece } from "./line";
import type { ClientEstimates } from "./live-inputs";
import { MIN_IN_STOCK_DAYS_30, type SalesContext } from "./sales-coverage";
import type { EstimateListingInput, EstimateRange, EstimateResult } from "./types";

/** The period Phase 1 and every yearly figure count. */
export const YEAR_DAYS = 365;
/** The window the sales rate is read over. */
export const BUY_BOX_RATE_WINDOW_DAYS = 30;
/** Days with the Buy Box needed in the last 30 before sales are divided by them (the view's 30-day rule). */
export const MIN_BUY_BOX_DAYS_30 = MIN_IN_STOCK_DAYS_30;

export type BuyBoxRateMissing = "no_keepa_days" | "no_sales_source" | "too_few_buy_box_days";

export type BuyBoxRate =
  | { ok: true; salesLast30: number; buyBoxDays30: number; perDay: number; reportedNoSales: boolean }
  | { ok: false; reason: BuyBoxRateMissing; buyBoxDays30: number | null };

const num = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
const exact = (x: number): EstimateRange => ({ low: x, mid: x, high: x });
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Days in the last 30 the listing held the Buy Box (Keepa): in-stock days minus days with stock and no Buy Box. */
export function buyBoxDays30(l: Pick<EstimateListingInput, "inStockDays30" | "noBuyBoxDays30">): number | null {
  if (!num(l.inStockDays30) || !num(l.noBuyBoxDays30)) return null;
  return Math.max(0, l.inStockDays30 - l.noBuyBoxDays30);
}

/** One listing's sales per Buy Box day over the last 30 days, or why it has none. */
export function buyBoxRate(l: EstimateListingInput): BuyBoxRate {
  const days = buyBoxDays30(l);
  if (days == null) return { ok: false, reason: "no_keepa_days", buyBoxDays30: null };
  if (!l.smartscoutHasRecord) return { ok: false, reason: "no_sales_source", buyBoxDays30: days };
  if (days < MIN_BUY_BOX_DAYS_30) return { ok: false, reason: "too_few_buy_box_days", buyBoxDays30: days };
  const sales = num(l.smartscoutMonthlyRevenue) && l.smartscoutMonthlyRevenue > 0 ? l.smartscoutMonthlyRevenue : 0;
  return { ok: true, salesLast30: sales, buyBoxDays30: days, perDay: sales / days, reportedNoSales: sales === 0 };
}

/** Why a listing reads Not available*, in plain words, for its tooltip. */
export function buyBoxMissingText(rate: Extract<BuyBoxRate, { ok: false }>): string {
  if (rate.reason === "no_keepa_days") return "Keepa has no day history for this listing in the last 30 days, so the days it held the Buy Box are not known.";
  if (rate.reason === "no_sales_source") return "SmartScout has no sales record for this listing and no brand-reported sales are on file, so it has no sales rate.";
  const n = rate.buyBoxDays30 ?? 0;
  return `It held the Buy Box on ${n} of the last 30 days. A daily sales rate needs at least ${MIN_BUY_BOX_DAYS_30}.`;
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
  let salesLast30 = 0;
  let buyBoxDays = 0;
  let perDay = 0;
  for (const l of listings) {
    if (l.buyBoxWithheld !== true) continue;
    const rate = buyBoxRate(l);
    const touched = rate.ok ? exact(rate.perDay * days) : null;
    if (rate.ok) {
      salesLast30 += rate.salesLast30;
      buyBoxDays += rate.buyBoxDays30;
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
        salesLast30: rate.ok ? rate.salesLast30 : null,
        buyBoxDays30: rate.buyBoxDays30,
        salesPerBuyBoxDay: rate.ok ? Math.round(rate.perDay * 100) / 100 : null,
        periodDays: days,
        notAvailable: rate.ok ? null : buyBoxMissingText(rate),
      },
    });
  }
  const asOf = ctx.dataAsOf ?? null;
  const notes = [
    "It assumes each listing stays withheld for the whole period and, once the Buy Box is back, sells as it did on its Buy Box days in the last 30.",
    `A listing needs at least ${MIN_BUY_BOX_DAYS_30} days with the Buy Box in the last 30 for a daily sales rate. One with fewer, or with no SmartScout record, reads Not available* and is left out, never counted as $0.`,
    "Only listings withheld today count. Listings that lost the Buy Box on earlier days and have it back today are not in this figure.",
    "Sales in the last 30 days can include a few sales made without the Buy Box, so the daily rate can run a little high.",
  ];
  if (days === YEAR_DAYS) notes.push("Phase 1 and the other yearly figures count a year, 365 days. Suppressed Listings and Action Items count the days in the date pill.");
  return assembleLine(
    {
      lineId: "buy_box",
      title: "Buy Box withheld",
      means: `Sales the brand can win back ${periodPhrase(days)} by getting the Buy Box back on every listing Amazon withholds it from today.`,
      formula: buyBoxFormula(days),
      inputs: [
        { key: "sales_last_30", label: "Sales in the last 30 days (SmartScout)", value: Math.round(salesLast30), unit: "usd", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_monthly_revenue", asOf },
        { key: "buy_box_days_30", label: "Days with the Buy Box in the last 30 (Keepa), listings added", value: buyBoxDays, unit: "days", kind: "collected", source: "canvas_listing_sales_loss_v2.in_stock_days_30 minus no_buy_box_days_30", asOf },
        { key: "sales_per_buy_box_day", label: "Sales per Buy Box day, listings added", value: Math.round(perDay * 100) / 100, unit: "usd_per_day", kind: "derived", source: "sales in the last 30 days / days with the Buy Box, per listing" },
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
