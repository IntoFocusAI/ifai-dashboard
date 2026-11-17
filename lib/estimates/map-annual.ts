// Line 3: MAP leakage, the retail value given away in a year by Amazon prices below MAP.
//
// Overlap rule 2: this is not lost brand revenue (R-09). It is shown beside the total and never in
// it. When a low price elsewhere causes a suppression, the lost sales are in the Buy Box line only.

import { MAP_VOLUME_KEPT, RANK_CURVE_METHOD_SOURCES } from "./benchmarks";
import { assembleLine, times, type LinePiece } from "./line";
import { resolveListingSales, type SalesContext } from "./sales-coverage";
import type { EstimateListingInput, EstimateResult } from "./types";

/**
 * For each listing priced below MAP on Amazon: gap below MAP x units a month x 12 x the share of
 * units still sold when the price returns to MAP.
 */
export function estimateMapLeakage(listings: EstimateListingInput[], ctx: SalesContext = {}): EstimateResult {
  const pieces: LinePiece[] = [];
  let monthlyValue = 0;
  for (const l of listings) {
    if (typeof l.amzLeakage !== "number" || !(l.amzLeakage < 0)) continue;
    const gap = -l.amzLeakage;
    const sales = resolveListingSales(l, ctx);
    const units = sales.monthlyUnits;
    // Touched: a year of the gap at today's units, before any volume is lost at the higher price.
    const touched = units ? times(units.range, gap * 12) : null;
    if (units) monthlyValue += units.range.mid * gap;
    pieces.push({
      listing: l,
      quantity: units,
      annual: sales.annual,
      reportedNoSales: sales.reportedNoSales,
      touched,
      range: touched ? times(touched, MAP_VOLUME_KEPT) : null,
      detail: { gapBelowMap: gap, monthlyUnits: units ? units.range.mid : null, ...sales.detail },
    });
  }
  return assembleLine(
    {
      lineId: "map_leakage",
      title: "MAP leakage (retail value below MAP)",
      means: "The retail value given away in a year by Amazon prices below MAP. It is not lost brand revenue, so it sits beside the total.",
      formula:
        "For each listing below MAP on Amazon: gap below MAP x units sold a month x 12 x the share of units still sold when the price returns to MAP. Then add the listings.",
      inputs: [
        { key: "gap_below_map", label: "Gap below MAP", value: "per listing", unit: "text", kind: "collected", source: "canvas_retail_listings.amz_leakage" },
        { key: "monthly_units", label: "Units sold, last 30 days", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_monthly_units" },
        { key: "monthly_value", label: "Value below MAP a month, today", value: Math.round(monthlyValue * 100) / 100, unit: "usd", kind: "derived", source: "sum of listings" },
      ],
      benchmarks: [MAP_VOLUME_KEPT],
      confidence: "medium",
      confidenceReason: "The gap and the units are measured. The figure assumes today's gap and last month's units hold for a year.",
      notes: ["Units are the last 30 days, so a strong or weak month moves the annual figure."],
      countsInTotal: false,
    },
    pieces,
    RANK_CURVE_METHOD_SOURCES,
  );
}
