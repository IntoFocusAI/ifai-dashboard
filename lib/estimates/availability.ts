// Lines 1 and 2: sales the brand loses on days a listing could not be bought normally.
//
// Overlap rule 1 (one day, one cause): Keepa counts a day as out of stock (no new offer) or as
// without a Buy Box (an offer, no Buy Box), never both, so the two lines never price the same day.
// Overlap rule 4: these lines price days with no sale; the content lines lift sales that did happen.

import { BRAND_LOSS_SHARE, BUY_BOX_LOST_SHARE, RANK_CURVE_METHOD_SOURCES } from "./benchmarks";
import { assembleLine, times, type LinePiece } from "./line";
import { resolveListingSales, type SalesContext } from "./sales-coverage";
import type { EstimateListingInput, EstimateRange, EstimateResult } from "./types";

const pos = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;
const exact = (x: number): EstimateRange => ({ low: x, mid: x, high: x });

/**
 * Line 1, out of stock. For each listing: sales per in-stock day x out-of-stock days in the last 12
 * months (the R-17 figure) x the share of missed sales the brand loses.
 */
export function estimateOutOfStock(listings: EstimateListingInput[], ctx: SalesContext = {}): EstimateResult {
  const pieces: LinePiece[] = [];
  for (const l of listings) {
    if (!pos(l.oosDays365)) continue;
    const sales = resolveListingSales(l, ctx);
    const rate = sales.perInStockDay;
    let touched: EstimateRange | null = null;
    if (rate) {
      // The view's own figure where it exists, so the line matches the Out of Stock tab to the cent.
      touched = rate.source === "smartscout" && pos(l.missedSalesOos365) ? exact(l.missedSalesOos365) : times(rate.range, l.oosDays365);
    }
    pieces.push({
      listing: l,
      quantity: rate,
      annual: sales.annual,
      reportedNoSales: sales.reportedNoSales,
      touched,
      range: touched ? times(touched, BRAND_LOSS_SHARE) : null,
      detail: { oosDays365: l.oosDays365, salesPerInStockDay: rate ? rate.range.mid : null, ...sales.detail },
    });
  }
  return assembleLine(
    {
      lineId: "out_of_stock",
      title: "Out of stock",
      means: "The brand's Amazon sales lost in a year because listings had no new unit for sale.",
      formula:
        "For each listing: sales per in-stock day x out-of-stock days in the last 12 months x the share of missed sales the brand loses. Then add the listings.",
      inputs: [
        { key: "sales_per_in_stock_day", label: "Sales per in-stock day", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.baseline_daily_revenue" },
        { key: "oos_days", label: "Out-of-stock days, last 12 months", value: pieces.reduce((s, p) => s + (p.range ? (p.listing.oosDays365 ?? 0) : 0), 0), unit: "days", kind: "collected", source: "canvas_listing_sales_loss_v2.oos_days_365" },
      ],
      benchmarks: [BRAND_LOSS_SHARE],
      confidence: "high",
      confidenceReason: "Sales per in-stock day and out-of-stock days are both measured per listing.",
      notes: [
        "Some shoppers buy another of the brand's listings or buy the product elsewhere, and the brand keeps that sale. The figure counts only the shopper who switches brand or does not buy.",
        "If the pattern of the last 12 months holds, this is next year's figure too.",
      ],
      countsInTotal: true,
    },
    pieces,
    RANK_CURVE_METHOD_SOURCES,
  );
}

/**
 * Line 2, Buy Box withheld or suppressed. For each listing: sales per in-stock day x days with stock
 * and no Buy Box in the last 12 months x the share lost without a Buy Box x the brand-loss share.
 */
export function estimateBuyBox(listings: EstimateListingInput[], ctx: SalesContext = {}): EstimateResult {
  const pieces: LinePiece[] = [];
  for (const l of listings) {
    if (!pos(l.noBuyBoxDays365)) continue;
    const sales = resolveListingSales(l, ctx);
    const rate = sales.perInStockDay;
    const touched = rate ? times(rate.range, l.noBuyBoxDays365) : null;
    pieces.push({
      listing: l,
      quantity: rate,
      annual: sales.annual,
      reportedNoSales: sales.reportedNoSales,
      touched,
      range: touched ? times(times(touched, BUY_BOX_LOST_SHARE), BRAND_LOSS_SHARE) : null,
      detail: { noBuyBoxDays365: l.noBuyBoxDays365, salesPerInStockDay: rate ? rate.range.mid : null, ...sales.detail },
    });
  }
  return assembleLine(
    {
      lineId: "buy_box",
      title: "Buy Box withheld or suppressed",
      means: "The brand's Amazon sales lost in a year on days when a listing had stock but Amazon showed no Buy Box.",
      formula:
        "For each listing: sales per in-stock day x days with stock and no Buy Box in the last 12 months x the share of sales lost without a Buy Box x the share of missed sales the brand loses. Then add the listings.",
      inputs: [
        { key: "sales_per_in_stock_day", label: "Sales per in-stock day", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.baseline_daily_revenue" },
        { key: "no_buy_box_days", label: "Days with stock and no Buy Box, last 12 months", value: pieces.reduce((s, p) => s + (p.range ? (p.listing.noBuyBoxDays365 ?? 0) : 0), 0), unit: "days", kind: "collected", source: "canvas_listing_sales_loss_v2.no_buy_box_days_365" },
      ],
      benchmarks: [BUY_BOX_LOST_SHARE, BRAND_LOSS_SHARE],
      confidence: "medium",
      confidenceReason: "The days are measured. The share of sales lost without a Buy Box is an assumption with one good study behind its direction.",
      notes: [
        "The monthly R-06 figure on a listing's row is the same money seen from today. It is never added to this line.",
        "Sales per in-stock day counts days without a Buy Box as in-stock days, so it runs a little low for a listing that often has no Buy Box, and so does this figure.",
      ],
      countsInTotal: true,
    },
    pieces,
    RANK_CURVE_METHOD_SOURCES,
  );
}
