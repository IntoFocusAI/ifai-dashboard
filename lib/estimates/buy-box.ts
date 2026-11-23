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
// Sales source order (R-06, 2 Nov 2026; Brian Magazu, 23 Nov 2026, final): the brand's reported
// Amazon sales are not collected per listing yet, so each listing takes the first rate it has:
//   1. SmartScout's last 30 days / Buy Box days in the last 30   (7 or more Buy Box days)
//   2. SmartScout's last 12 months / Buy Box days in the last 365 (30 or more, the sales view's rule)
//   3. the estimate the other lines use when SmartScout has no sales: Amazon's bought-in-past-month
//      figure, else tracked listings with a similar sales rank (sales-coverage.ts), per in-stock day,
//      with that estimate's own low and high carried into the range
//   4. Not available*, with its reason, never $0
// A blank (null) SmartScout revenue is unknown, not $0, for this figure (Brian Magazu, 23 Nov 2026,
// overriding decision 113 here only): the window is skipped. A real 0 stays a measured $0. Keepa
// gives the day counts. Nothing here names a client.

import { formatInt, formatMoneyShort, formatMoneySpan, formatUsd } from "@/lib/fender-canvas/format";
import { BUY_BOX_LOST_SHARE, KEEPA_MONTHLY_SOLD_MULTIPLIER, RANK_CURVE_METHOD_SOURCES } from "./benchmarks";
import { assembleLine, times, type LinePiece } from "./line";
import type { ClientEstimates } from "./live-inputs";
import { estimatedSalesPerInStockDay, MIN_IN_STOCK_DAYS_30, type EstimatedSales, type SalesContext } from "./sales-coverage";
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

/** Which SmartScout window a listing's measured rate came from. */
export type BuyBoxMeasuredWindow = "last_30_days" | "last_12_months";
/** Where a listing's rate came from: a SmartScout window, or the estimate from Amazon's sales data. */
export type BuyBoxRateWindow = BuyBoxMeasuredWindow | "amazon_estimate";
/** The estimate's two sources, as the other lines name them. */
export type BuyBoxEstimateSource = EstimatedSales["source"];

/** The window in plain words, for the trail and the table. */
export const BUY_BOX_RATE_WORDS: Readonly<Record<BuyBoxRateWindow, string>> = {
  last_30_days: "last 30 days",
  last_12_months: "last 12 months",
  amazon_estimate: "Amazon sales rank",
};

/** The first words of each priced listing's tooltip, by source (Brian Magazu, 23 Nov 2026). */
export const BUY_BOX_RATE_LEAD: Readonly<Record<BuyBoxMeasuredWindow | BuyBoxEstimateSource, string>> = {
  last_30_days: "Rate from the last 30 days.",
  last_12_months: "Rate from the last 12 months.",
  sales_rank_curve: "Estimated from Amazon sales rank.",
  keepa_monthly_sold: "Estimated from Amazon's bought-in-past-month figure.",
};

export type BuyBoxRateMissing = "no_keepa_days" | "no_sales_source" | "blank_revenue" | "too_few_buy_box_days";

export type BuyBoxRate =
  | { ok: true; window: BuyBoxMeasuredWindow; sales: number; buyBoxDays: number; perDay: number; reportedNoSales: boolean }
  | { ok: true; window: "amazon_estimate"; estimate: EstimatedSales; perDay: number }
  | { ok: false; reason: BuyBoxRateMissing; buyBoxDays30: number | null; buyBoxDays365: number | null; estimateMissing: string | null };

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
 * Why the estimate from Amazon's sales data does not price a listing either, in plain words, or null
 * when the estimate is switched off (measured sales only).
 */
function estimateMissingText(l: EstimateListingInput, ctx: SalesContext): string | null {
  if (ctx.salesSources === "measured_only") return null;
  if (!num(l.price) || l.price <= 0) return "There is no Amazon price for it, so it cannot be estimated from Amazon sales rank either.";
  if (!num(l.salesRank) || l.salesRank <= 0) return "It has no Amazon sales rank or bought-in-past-month figure, so it cannot be estimated from them either.";
  return "Its Amazon sales rank has no match among the listings SmartScout tracks, so it cannot be estimated from sales rank either.";
}

/**
 * One listing's sales per day, from the first source that has a rate (Brian Magazu, 23 Nov 2026):
 * SmartScout's last 30 days when it held the Buy Box on 7 or more of them; else SmartScout's last
 * 12 months when it held the Buy Box on 30 or more of the last 365; else the estimate from Amazon's
 * sales data the other lines use; else why it has none. A blank SmartScout revenue skips its window.
 */
export function buyBoxRate(l: EstimateListingInput, ctx: SalesContext = {}): BuyBoxRate {
  const days30 = buyBoxDays30(l);
  const days365 = buyBoxDays365(l);
  const has30 = days30 != null && days30 >= MIN_BUY_BOX_DAYS_30;
  const has365 = days365 != null && days365 >= MIN_BUY_BOX_DAYS_365;
  if (l.smartscoutHasRecord && has30 && num(l.smartscoutMonthlyRevenue)) {
    const sales = positive(l.smartscoutMonthlyRevenue);
    return { ok: true, window: "last_30_days", sales, buyBoxDays: days30, perDay: sales / days30, reportedNoSales: sales === 0 };
  }
  if (l.smartscoutHasRecord && has365 && num(l.smartscoutTtmRevenue)) {
    const sales = positive(l.smartscoutTtmRevenue);
    return { ok: true, window: "last_12_months", sales, buyBoxDays: days365, perDay: sales / days365, reportedNoSales: sales === 0 };
  }
  const estimate = estimatedSalesPerInStockDay(l, ctx, { blankSmartscoutIsUnknown: true });
  if (estimate) return { ok: true, window: "amazon_estimate", estimate, perDay: estimate.perInStockDay.mid };
  const blank30 = !num(l.smartscoutMonthlyRevenue);
  const blank365 = !num(l.smartscoutTtmRevenue);
  const reason: BuyBoxRateMissing = !l.smartscoutHasRecord
    ? "no_sales_source"
    : (has30 && blank30) || (has365 && blank365) || (blank30 && blank365)
      ? "blank_revenue"
      : days30 == null && days365 == null
        ? "no_keepa_days"
        : "too_few_buy_box_days";
  // A listing SmartScout prices in some window has sales figures, so sales rank does not apply to it.
  const estimateMissing = reason === "no_sales_source" || reason === "blank_revenue" ? estimateMissingText(l, ctx) : null;
  return { ok: false, reason, buyBoxDays30: days30, buyBoxDays365: days365, estimateMissing };
}

const RATE_RULE = `A daily sales rate needs at least ${MIN_BUY_BOX_DAYS_30} days with the Buy Box in the last 30, or at least ${MIN_BUY_BOX_DAYS_365} in the last 365.`;

/** Why a listing reads Not available*, in plain words, for its tooltip. */
export function buyBoxMissingText(rate: Extract<BuyBoxRate, { ok: false }>): string {
  const then = rate.estimateMissing ? ` ${rate.estimateMissing}` : "";
  if (rate.reason === "no_keepa_days") return "Keepa has no day history for this listing, so the days it held the Buy Box are not known.";
  if (rate.reason === "no_sales_source")
    return `SmartScout has no sales record for this listing and no brand-reported sales are on file, so it has no sales rate for the last 30 days or the last 12 months.${then}`;
  if (rate.reason === "blank_revenue") return `SmartScout has no revenue figure for this listing, so its sales are not known.${then}`;
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
  if (d.rateWindow === "amazon_estimate") return buyBoxEstimateMath(row);
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

const units = (x: number) => (x >= 10 ? formatInt(Math.round(x)) : String(Math.round(x * 10) / 10));

/** An estimated listing's math: the estimate's own low and high carried with 70% and 90%. */
function buyBoxEstimateMath(row: Pick<EstimateListingRow, "detail" | "range">): string {
  const d = row.detail;
  const n = (x: unknown) => (typeof x === "number" ? x : 0);
  const rank = d.estimateSource === "sales_rank_curve";
  const lead = rank ? BUY_BOX_RATE_LEAD.sales_rank_curve : BUY_BOX_RATE_LEAD.keepa_monthly_sold;
  const price = n(d.price);
  const sold = rank
    ? `Listings SmartScout tracks with a similar sales rank (${formatInt(n(d.salesRank))}) sell ${units(n(d.unitsLow))} to ${units(n(d.unitsHigh))} units per 30 days in stock, ${units(n(d.unitsMid))} mid.`
    : `Amazon shows ${formatInt(n(d.keepaMonthlySold))} bought in the past month; at ${KEEPA_MONTHLY_SOLD_MULTIPLIER.low} to ${KEEPA_MONTHLY_SOLD_MULTIPLIER.high} times that (${KEEPA_MONTHLY_SOLD_MULTIPLIER.mid} mid) over ${formatInt(n(d.inStockDays30Used))} days in stock, it sells ${units(n(d.unitsLow))} to ${units(n(d.unitsHigh))} units per 30 days in stock.`;
  const r = row.range;
  const b = BUY_BOX_LOST_SHARE;
  if (!r) return `${lead} ${sold}`;
  return (
    `${lead} ${sold} At ${formatUsd(price)} that is ${formatUsd(n(d.salesPerDayLow))} to ${formatUsd(n(d.salesPerDayHigh))} a day, ${formatUsd(n(d.salesPerBuyBoxDay))} mid. ` +
    `Times ${formatInt(n(d.periodDays))} days times ${pct(b.mid)} is ${formatMoneyShort(r.mid)}; the low uses the estimate's low and ${pct(b.low)}, the high its high and ${pct(b.high)}: ${formatMoneySpan(r.low, r.high)}.`
  );
}

/** How the withheld listings were priced, by source, for the headline's N of M tooltip. */
export function buyBoxRateSplitText(line: EstimateResult): string {
  const rows = line.trail.listings.filter((row) => row.range);
  const count = (pred: (row: EstimateListingRow) => boolean) => rows.filter(pred).length;
  const on30 = count((row) => row.detail.rateWindow === "last_30_days");
  const on12 = count((row) => row.detail.rateWindow === "last_12_months");
  const onRank = count((row) => row.detail.estimateSource === "sales_rank_curve");
  const onSold = count((row) => row.detail.estimateSource === "keepa_monthly_sold");
  const missing = line.trail.listings.length - rows.length;
  const parts = [`${on30} priced on their last 30 days`, `${on12} on their last 12 months`, `${onRank} estimated from Amazon sales rank`];
  if (onSold > 0) parts.push(`${onSold} estimated from Amazon's bought-in-past-month figure`);
  return `${parts.join(", ")}, ${missing} Not available*.`;
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
    "When SmartScout gives neither rate, estimate what it sells on a day in stock from its Amazon sales rank or bought-in-past-month figure, as the other estimates do. " +
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
  const estimated = { sales_rank_curve: 0, keepa_monthly_sold: 0, perDay: 0 };
  let perDay = 0;
  for (const l of listings) {
    if (l.buyBoxWithheld !== true) continue;
    const rate = buyBoxRate(l, ctx);
    const est = rate.ok && rate.window === "amazon_estimate" ? rate.estimate : null;
    // An estimate carries its own low and high: low x 70%, mid x 80%, high x 90%.
    const touched = !rate.ok ? null : est ? times(est.perInStockDay, days) : exact(rate.perDay * days);
    if (rate.ok) {
      perDay += rate.perDay;
      if (rate.window === "amazon_estimate") {
        estimated[rate.estimate.source] += 1;
        estimated.perDay += rate.perDay;
      } else {
        sum[rate.window].listings += 1;
        sum[rate.window].sales += rate.sales;
        sum[rate.window].buyBoxDays += rate.buyBoxDays;
      }
    }
    const measured = rate.ok && rate.window !== "amazon_estimate" ? rate : null;
    pieces.push({
      listing: l,
      quantity: !rate.ok ? null : est ? { source: est.source, range: est.perInStockDay } : { source: "smartscout", range: exact(rate.perDay) },
      annual: num(l.smartscoutTtmRevenue) && l.smartscoutTtmRevenue > 0 ? { source: "smartscout", range: exact(l.smartscoutTtmRevenue) } : null,
      reportedNoSales: measured?.reportedNoSales ?? false,
      touched,
      range: touched ? times(touched, BUY_BOX_LOST_SHARE) : null,
      detail: {
        rateWindow: rate.ok ? rate.window : null,
        rateUsed: rate.ok ? BUY_BOX_RATE_WORDS[rate.window] : null,
        sales: measured ? measured.sales : null,
        buyBoxDays: measured ? measured.buyBoxDays : null,
        buyBoxDays30: rate.ok ? buyBoxDays30(l) : rate.buyBoxDays30,
        buyBoxDays365: rate.ok ? buyBoxDays365(l) : rate.buyBoxDays365,
        salesPerBuyBoxDay: rate.ok ? Math.round(rate.perDay * 100) / 100 : null,
        periodDays: days,
        notAvailableReason: rate.ok ? null : rate.reason,
        notAvailable: rate.ok ? null : buyBoxMissingText(rate),
        ...(est
          ? {
              ...est.detail,
              estimateSource: est.source,
              unitsLow: est.unitsPer30InStockDays.low,
              unitsMid: est.unitsPer30InStockDays.mid,
              unitsHigh: est.unitsPer30InStockDays.high,
              salesPerDayLow: Math.round(est.perInStockDay.low * 100) / 100,
              salesPerDayHigh: Math.round(est.perInStockDay.high * 100) / 100,
            }
          : {}),
      },
    });
  }
  const asOf = ctx.dataAsOf ?? null;
  const notes = [
    "It assumes each listing stays withheld for the whole period and, once the Buy Box is back, sells as it did on its Buy Box days.",
    `Each listing uses its last 30 days when it held the Buy Box on at least ${MIN_BUY_BOX_DAYS_30} of them. Otherwise it uses its last 12 months when it held the Buy Box on at least ${MIN_BUY_BOX_DAYS_365} of the last 365. Otherwise it is estimated from Amazon sales rank, or from Amazon's bought-in-past-month figure when Amazon shows one. The table says which one each listing used.`,
    "A blank SmartScout revenue is not known, so that window is skipped rather than counted as $0. A SmartScout revenue of 0 counts as a measured $0.",
    "An estimated listing carries the estimate's own low and high: its low uses the estimate's low and 70%, its high the estimate's high and 90%. Sales rank and Amazon's bought-in-past-month figure show how a listing sells now, while the Buy Box is withheld, so an estimate can run low.",
    "A listing with no rate and no estimate reads Not available* and is left out, never counted as $0.",
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
        { key: "listings_rate_sales_rank", label: "Listings estimated from Amazon sales rank", value: estimated.sales_rank_curve, unit: "count", kind: "derived", source: "no SmartScout rate in either window; tracked listings with a similar sales rank (rank curve)" },
        ...(estimated.keepa_monthly_sold > 0
          ? [{ key: "listings_rate_monthly_sold", label: "Listings estimated from Amazon's bought-in-past-month figure", value: estimated.keepa_monthly_sold, unit: "count" as const, kind: "derived" as const, source: "no SmartScout rate in either window; Keepa monthly_sold" }]
          : []),
        { key: "estimated_sales_per_day", label: "Their estimated sales per day in stock, added (mid)", value: Math.round(estimated.perDay * 100) / 100, unit: "usd_per_day", kind: "derived", source: "the estimate the other lines use (sales-coverage)" },
        { key: "sales_per_buy_box_day", label: "Sales per day, listings added (mid)", value: Math.round(perDay * 100) / 100, unit: "usd_per_day", kind: "derived", source: "each listing's sales / its days with the Buy Box in the window it used, or its estimate" },
        { key: "period_days", label: "Days in the period", value: days, unit: "days", kind: "derived", source: days === YEAR_DAYS ? "a year, for Phase 1" : "the shared date pill" },
      ],
      benchmarks: estimated.keepa_monthly_sold > 0 ? [BUY_BOX_LOST_SHARE, KEEPA_MONTHLY_SOLD_MULTIPLIER] : [BUY_BOX_LOST_SHARE],
      confidence: "medium",
      confidenceReason:
        "Sales and Buy Box days are measured for each listing SmartScout prices; the rest are estimated from Amazon sales rank. The share of sales lost while the Buy Box is withheld is an IntoFocus assumption with a peer-reviewed study behind its direction.",
      mostImprovedBy: "IntoFocus's own measurement of each listing's sales with and without the Buy Box, to replace the 70% to 90% share.",
      notes,
      countsInTotal: true,
    },
    pieces,
    RANK_CURVE_METHOD_SOURCES,
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
  const reasons = { no_sales_source: 0, blank_revenue: 0, too_few_buy_box_days: 0, no_keepa_days: 0 };
  for (const row of rows) {
    const reason = row.range ? null : row.detail.notAvailableReason;
    if (reason === "no_sales_source" || reason === "blank_revenue" || reason === "too_few_buy_box_days" || reason === "no_keepa_days") reasons[reason] += 1;
  }
  const anyEstimated = rows.some((row) => row.range && row.detail.rateWindow === "amazon_estimate");
  const who = anyEstimated ? "its sales data show" : "SmartScout reports";
  const lead =
    priced === 0
      ? `None of the ${plural(rows.length, "withheld listing", "withheld listings")} could be priced.`
      : `${priced} of ${plural(rows.length, "withheld listing", "withheld listings")} could be priced, and ${who} no sales for ${priced === 1 ? "it" : "them"}, so the figure is not known rather than $0.`;
  const rest = [
    reasons.no_sales_source ? `${plural(reasons.no_sales_source, "has", "have")} no SmartScout sales record and no sales rank estimate` : null,
    reasons.blank_revenue ? `${plural(reasons.blank_revenue, "has", "have")} no SmartScout revenue figure and no sales rank estimate` : null,
    reasons.too_few_buy_box_days ? `${plural(reasons.too_few_buy_box_days, "held", "held")} the Buy Box on too few days (${MIN_BUY_BOX_DAYS_30} of the last 30 or ${MIN_BUY_BOX_DAYS_365} of the last 365 are needed)` : null,
    reasons.no_keepa_days ? `${plural(reasons.no_keepa_days, "has", "have")} no Keepa day history` : null,
  ].filter((part): part is string => part != null);
  if (rest.length === 0) return lead;
  return priced === 0 ? `${lead.slice(0, -1)}: ${rest.join("; ")}.` : `${lead} Of the rest, ${rest.join("; ")}.`;
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
