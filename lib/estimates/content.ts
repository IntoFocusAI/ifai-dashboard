// Lines 4 to 7: added sales in a year from fixing a listing's content.
//   4 splintered      a bundle with no parent ASIN, nested under the official parent
//   5 missing specs   required Amazon fields filled
//   6 miscategorized  refiled under the right product type (held until the D-12 check exists)
//   7 A+ content      added where it is absent
//
// Each is: the listing's annual sales x a lift.
//
// Overlap rule 3 (content lifts combine, they do not stack). A listing with more than one content
// problem gets (1 + lift) x (1 + lift) ... minus 1, capped at 30% of its sales. That combined lift
// is shared among the listing's lines in proportion to each line's own lift, so the lines add up to
// the combined figure and no listing is credited with more than the cap.

import { APLUS_LIFT, CONTENT_LIFT_CAP, MISCATEGORIZED_LIFT, RANK_CURVE_METHOD_SOURCES, SPEC_LIFT_BANDS, SPLINTERED_LIFT } from "./benchmarks";
import { assembleLine, times, type LinePiece, type LineSpec } from "./line";
import { resolveListingSales, type SalesContext } from "./sales-coverage";
import type { Benchmark, EstimateListingInput, EstimateRange, EstimateResult } from "./types";

export type ContentLineId = "splintered" | "missing_specs" | "miscategorized" | "aplus";

export type ContentEstimates = Record<ContentLineId, EstimateResult>;

/** The spec band a completeness percentage falls in, or null at 100% or when not checked. */
export function specLiftBand(completenessPct: number | null | undefined): (typeof SPEC_LIFT_BANDS)[number] | null {
  if (typeof completenessPct !== "number" || !Number.isFinite(completenessPct) || completenessPct >= 100) return null;
  return SPEC_LIFT_BANDS.find((b) => completenessPct >= b.minPct && completenessPct < b.maxPct) ?? null;
}

/** The content problems a listing has, each with its own lift. */
export function contentLifts(l: EstimateListingInput): Array<{ lineId: ContentLineId; lift: Benchmark }> {
  const lifts: Array<{ lineId: ContentLineId; lift: Benchmark }> = [];
  if (l.isBundle === true && !l.parentAsin) lifts.push({ lineId: "splintered", lift: SPLINTERED_LIFT });
  const band = specLiftBand(l.amazonCompletenessPct);
  if (band) lifts.push({ lineId: "missing_specs", lift: band.benchmark });
  if (l.miscategorized === true) lifts.push({ lineId: "miscategorized", lift: MISCATEGORIZED_LIFT });
  if (l.aplusState === "absent") lifts.push({ lineId: "aplus", lift: APLUS_LIFT });
  return lifts;
}

/**
 * Overlap rule 3 for one listing: each line's share of the listing's sales after the lifts are
 * combined and capped. With one lift and no cap hit, the share is the lift itself.
 */
export function combinedLiftShares(lifts: Array<{ lineId: ContentLineId; lift: Benchmark }>): { shares: Map<ContentLineId, EstimateRange>; capped: boolean } {
  const shares = new Map<ContentLineId, EstimateRange>(lifts.map((x) => [x.lineId, { low: 0, mid: 0, high: 0 }]));
  let capped = false;
  for (const level of ["low", "mid", "high"] as const) {
    const sum = lifts.reduce((s, x) => s + x.lift[level], 0);
    if (!(sum > 0)) continue;
    const compounded = lifts.reduce((p, x) => p * (1 + x.lift[level]), 1) - 1;
    const combined = Math.min(compounded, CONTENT_LIFT_CAP[level]);
    if (compounded > CONTENT_LIFT_CAP[level]) capped = true;
    for (const x of lifts) shares.get(x.lineId)![level] = (combined * x.lift[level]) / sum;
  }
  return { shares, capped };
}

const COMBINE_NOTE =
  "A listing with more than one content problem gets its lifts combined, not stacked, and capped at 30% of its sales. The combined lift is shared among its lines in proportion to each line's own lift.";

const SPECS: Record<ContentLineId, LineSpec> = {
  splintered: {
    lineId: "splintered",
    title: "Splintered listings",
    means: "Added sales in a year if bundles with no usable parent ASIN were nested under the official parent, where they share its reviews.",
    formula: "For each splintered listing: its annual sales x the lift from pooled reviews. Then add the listings.",
    inputs: [
      { key: "annual_sales", label: "Annual sales of the listing", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue" },
      { key: "splintered", label: "Bundle with no parent ASIN", value: "per listing", unit: "text", kind: "collected", source: "canvas_retail_listings.is_bundle, parent_asin" },
    ],
    benchmarks: [SPLINTERED_LIFT, CONTENT_LIFT_CAP],
    confidence: "low",
    confidenceReason: "The lift is an IntoFocus assumption. We do not yet store each listing's review count reliably.",
    mostImprovedBy: "Review counts per listing and per parent, so the lift can follow the published review curve listing by listing.",
    notes: [COMBINE_NOTE, "A splintered listing with no recorded sales is not priced. Some of that is the splintering itself, which this formula cannot see."],
    countsInTotal: true,
  },
  missing_specs: {
    lineId: "missing_specs",
    title: "Missing Amazon specs",
    means: "Added Amazon sales in a year if listings filled the required fields for their product type.",
    formula: "For each listing below 100% complete: its annual sales x the lift for its completeness band. Then add the listings.",
    inputs: [
      { key: "annual_sales", label: "Annual sales of the listing", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue" },
      { key: "completeness", label: "Amazon spec completeness", value: "per listing", unit: "text", kind: "collected", source: "canvas_spec_readiness.amazon_completeness_pct" },
    ],
    benchmarks: [...SPEC_LIFT_BANDS.map((b) => b.benchmark), CONTENT_LIFT_CAP],
    confidence: "low",
    confidenceReason: "The lifts are IntoFocus assumptions. Published evidence is thin.",
    mostImprovedBy: "Our own before-and-after results: when a listing's completeness rises, its sales in the next 60 days against similar listings that did not change.",
    notes: [COMBINE_NOTE, "Completeness is not yet counted against the approved field lists (decision 107), so this will move when that lands."],
    countsInTotal: true,
  },
  miscategorized: {
    lineId: "miscategorized",
    title: "Miscategorized listings",
    means: "Added sales in a year if listings filed under the wrong Amazon product type were refiled.",
    formula: "For each flagged listing: its annual sales x the lift from refiling. Then add the listings.",
    inputs: [{ key: "annual_sales", label: "Annual sales of the listing", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue" }],
    benchmarks: [MISCATEGORIZED_LIFT, CONTENT_LIFT_CAP],
    confidence: "low",
    confidenceReason: "The lift is an IntoFocus assumption. No study measures it.",
    mostImprovedBy: "The D-12 check itself, then our own before-and-after results.",
    notes: [COMBINE_NOTE, "Held until the D-12 check exists. It does not count in the total."],
    // Approval 13: hold this dollar until D-12 exists.
    countsInTotal: false,
  },
  aplus: {
    lineId: "aplus",
    title: "Weak or missing A+ content",
    means: "Added Amazon sales in a year if listings without A+ content had it.",
    formula: "For each listing with no A+ content: its annual sales x the lift from adding it. Then add the listings.",
    inputs: [
      { key: "annual_sales", label: "Annual sales of the listing", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue" },
      { key: "aplus_absent", label: "A+ content absent", value: "per listing", unit: "text", kind: "collected", source: "canvas_listing_content.aplus_state" },
    ],
    benchmarks: [APLUS_LIFT, CONTENT_LIFT_CAP],
    confidence: "medium",
    confidenceReason: "The lift is Amazon's own figure for its own program, used as a ceiling.",
    mostImprovedBy: "The brand's own Amazon sales by listing (onboarding question 4), in place of SmartScout.",
    notes: [COMBINE_NOTE],
    countsInTotal: true,
  },
};

/** Lines 4 to 7, with overlap rule 3 applied listing by listing. */
export function estimateContent(listings: EstimateListingInput[], ctx: SalesContext = {}): ContentEstimates {
  const pieces: Record<ContentLineId, LinePiece[]> = { splintered: [], missing_specs: [], miscategorized: [], aplus: [] };
  for (const l of listings) {
    const lifts = contentLifts(l);
    if (lifts.length === 0) continue;
    const sales = resolveListingSales(l, ctx);
    const { shares, capped } = combinedLiftShares(lifts);
    for (const x of lifts) {
      const share = shares.get(x.lineId)!;
      pieces[x.lineId].push({
        listing: l,
        quantity: sales.annual,
        annual: sales.annual,
        reportedNoSales: sales.reportedNoSales,
        touched: sales.annual ? sales.annual.range : null,
        range: sales.annual ? times(sales.annual.range, share) : null,
        detail: {
          lift: x.lift.mid,
          liftAfterCombining: share.mid,
          contentProblems: lifts.length,
          cappedAt30Pct: capped,
          ...(x.lineId === "missing_specs" ? { amazonCompletenessPct: l.amazonCompletenessPct ?? null } : {}),
          ...sales.detail,
        },
      });
    }
  }
  return {
    splintered: assembleLine(SPECS.splintered, pieces.splintered, RANK_CURVE_METHOD_SOURCES, ctx.dataAsOf ?? null),
    missing_specs: assembleLine(SPECS.missing_specs, pieces.missing_specs, RANK_CURVE_METHOD_SOURCES, ctx.dataAsOf ?? null),
    miscategorized: assembleLine(SPECS.miscategorized, pieces.miscategorized, RANK_CURVE_METHOD_SOURCES, ctx.dataAsOf ?? null),
    aplus: assembleLine(SPECS.aplus, pieces.aplus, RANK_CURVE_METHOD_SOURCES, ctx.dataAsOf ?? null),
  };
}
