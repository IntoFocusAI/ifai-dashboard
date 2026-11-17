// Rollups: near-term upside (Phase 1) and the measured total.
//
// Overlap rules applied here:
//   2  MAP sits beside the total, never in it (its line has countsInTotal false).
//   6  Brand-site pages, Actuation and Roadmap dollars are shares of the AI lines and are never added.
//   7  The retailer share of AI sources is removed from the AI lines before they join the total,
//      because listing fixes already carry it.
//   8  The low total adds the lows and the high total adds the highs. That is wider than the truth,
//      since not every line lands low at once.

import { RANK_CURVE_METHOD_SOURCES } from "./benchmarks";
import { estimateBuyBox, estimateOutOfStock } from "./availability";
import { estimateContent } from "./content";
import { add, roundRange, uniqueSources, ZERO } from "./line";
import { estimateMapLeakage } from "./map-annual";
import { catalogSalesCoverage, emptySalesSplit, type CatalogSalesCoverage, type SalesContext } from "./sales-coverage";
import type { EstimateConfidence, EstimateLineId, EstimateListingInput, EstimateRange, EstimateResult, SalesSource } from "./types";

/** The lines Phase 1 adds, in the proposal's order. Line 6 joins when the D-12 check exists. */
export const PHASE_1_LINES: EstimateLineId[] = ["out_of_stock", "buy_box", "splintered", "missing_specs", "aplus"];

function rollup(
  lineId: "phase_1" | "measured_total",
  spec: { title: string; means: string; formula: string; confidence: EstimateConfidence; confidenceReason: string; mostImprovedBy: string; notes: string[] },
  parts: EstimateResult[],
  range: EstimateRange | null,
  catalog: CatalogSalesCoverage,
  dataAsOf: string | null,
): EstimateResult {
  const split = emptySalesSplit();
  for (const p of parts) {
    for (const key of Object.keys(split) as SalesSource[]) {
      split[key].estimate = (split[key].estimate ?? 0) + (p.trail.salesSources[key].estimate ?? 0);
    }
  }
  // Listings and annual sales are the catalog's, since one listing can sit in several lines.
  for (const key of Object.keys(split) as SalesSource[]) {
    split[key].listings = catalog.salesSources[key].listings;
    split[key].annualSales = catalog.salesSources[key].annualSales;
  }
  const benchmarks = [...new Map(parts.flatMap((p) => p.trail.benchmarks).map((b) => [b.id, b])).values()];
  const partial = catalog.after.partial || parts.some((p) => p.asterisk);
  return {
    lineId,
    status: range ? "estimated" : "not_available",
    range: range ? roundRange(range) : null,
    label: "analyst estimate",
    asterisk: partial,
    countsInTotal: false,
    parts,
    trail: {
      lineId,
      title: spec.title,
      means: spec.means,
      formula: spec.formula,
      inputs: [
        ...parts.map((p) => ({
          key: p.lineId,
          label: p.trail.title,
          value: p.range ? p.range.mid : null,
          unit: "usd" as const,
          kind: "derived" as const,
          source: p.lineId,
          asOf: dataAsOf,
        })),
        { key: "measured_annual_sales", label: "Amazon sales we measure, last 12 months", value: Math.round(catalog.measuredAnnualSales), unit: "usd", kind: "collected", source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue", asOf: dataAsOf },
        { key: "annual_sales", label: "Amazon sales, measured plus estimated", value: Math.round(catalog.annualSales.mid), unit: "usd", kind: "derived", source: "sales coverage", asOf: dataAsOf },
      ],
      coverage: catalog.after,
      salesSources: split,
      benchmarks,
      sources: uniqueSources(benchmarks, catalog.after.estimated > 0 ? RANK_CURVE_METHOD_SOURCES : []),
      confidence: spec.confidence,
      confidenceReason: spec.confidenceReason,
      mostImprovedBy: spec.mostImprovedBy,
      notes: spec.notes,
      listings: [],
    },
  };
}

/**
 * Near-term upside (Phase 1): every listing fix, with no further haircut. Adds the lines that count
 * in the total and have a figure. A line that reads Not available* adds nothing and is never $0.
 */
export function rollupPhase1(lines: EstimateResult[], catalog: CatalogSalesCoverage, dataAsOf: string | null = null): EstimateResult {
  const parts = PHASE_1_LINES.map((id) => lines.find((l) => l.lineId === id)).filter((l): l is EstimateResult => Boolean(l && l.countsInTotal));
  const priced = parts.filter((p) => p.range);
  const range = priced.length > 0 ? priced.reduce((sum, p) => add(sum, p.range!), ZERO) : null;
  const missing = parts.filter((p) => !p.range).map((p) => p.trail.title);
  return rollup(
    "phase_1",
    {
      title: "Near-term upside (Phase 1)",
      means: "Added sales in a year from every listing fix: out of stock, Buy Box, splintered listings, missing specs and A+ content.",
      formula: "Out of stock + Buy Box + splintered listings + missing Amazon specs + A+ content. The low figure adds the lows and the high figure adds the highs.",
      confidence: "medium",
      confidenceReason: "The availability lines rest on measured days. The content lines rest on IntoFocus lift assumptions.",
      mostImprovedBy: "The brand's own Amazon sales by listing (onboarding question 4), in place of SmartScout.",
      notes: [
        "MAP leakage is retail value below MAP, not lost brand revenue. It is shown beside this figure and never added to it.",
        "Adding the lows and the highs is wider than the truth, since not every line lands low at once.",
        ...(missing.length > 0 ? [`Not available* and left out: ${missing.join(", ")}.`] : []),
      ],
    },
    parts,
    range,
    catalog,
    dataAsOf,
  );
}

/** The AI lines as chunk E5 will supply them. Ranges are null when a line reads On track or Not available*. */
export type AiLinesInput = {
  unbranded: EstimateRange | null;
  branded: EstimateRange | null;
  /** The share of AI sources that are retailers, 0 to 1 (overlap rule 7). */
  retailerShare: number;
};

/** Measured total: Phase 1 + (line 8 + line 9) x (1 minus the retailer share of AI sources). */
export function rollupMeasuredTotal(phase1: EstimateResult, ai: AiLinesInput, catalog: CatalogSalesCoverage, dataAsOf: string | null = null): EstimateResult {
  const keep = 1 - Math.min(1, Math.max(0, ai.retailerShare));
  const aiSum = add(ai.unbranded ?? ZERO, ai.branded ?? ZERO);
  const aiNet: EstimateRange = { low: aiSum.low * keep, mid: aiSum.mid * keep, high: aiSum.high * keep };
  const hasAi = Boolean(ai.unbranded || ai.branded);
  const range = phase1.range || hasAi ? add(phase1.range ?? ZERO, aiNet) : null;
  const result = rollup(
    "measured_total",
    {
      title: "Measured total",
      means: "Near-term upside plus the AI Search lines, on the sales we measure.",
      formula: "Near-term upside + (Unbranded Discovery gap + Branded Consideration gap) x (1 minus the retailer share of AI sources).",
      confidence: "medium",
      confidenceReason: "The listing fixes carry most of the figure. The AI lines rest on the share of shopping an AI answer shapes, the widest range in the estimates.",
      mostImprovedBy: "The brand's sales in every channel (onboarding question 1).",
      notes: [
        "The retailer share of AI sources is removed from the AI lines, because listing fixes already carry it.",
        "Brand-site pages, Actuation and Roadmap dollars are shares of the AI lines and are never added.",
      ],
    },
    phase1.parts ?? [],
    range,
    catalog,
    dataAsOf,
  );
  result.trail.inputs.push(
    { key: "ai_unbranded", label: "AI Search: Unbranded Discovery gap", value: ai.unbranded ? Math.round(ai.unbranded.mid) : null, unit: "usd", kind: "derived", source: "ai_unbranded" },
    { key: "ai_branded", label: "AI Search: Branded Consideration", value: ai.branded ? Math.round(ai.branded.mid) : null, unit: "usd", kind: "derived", source: "ai_branded" },
    { key: "retailer_share", label: "Retailer share of AI sources", value: ai.retailerShare, unit: "share", kind: "collected", source: "canvas_site_types.site_type" },
  );
  return result;
}

export type ListingEstimates = {
  outOfStock: EstimateResult;
  buyBox: EstimateResult;
  /** Beside the total, never in it. */
  mapLeakage: EstimateResult;
  splintered: EstimateResult;
  missingSpecs: EstimateResult;
  /** Held until the D-12 check exists. */
  miscategorized: EstimateResult;
  aplus: EstimateResult;
  phase1: EstimateResult;
  catalog: CatalogSalesCoverage;
};

/** Lines 1 to 7 and Phase 1 for one client's listings. */
export function estimateListingLines(listings: EstimateListingInput[], ctx: SalesContext = {}): ListingEstimates {
  const catalog = catalogSalesCoverage(listings, ctx);
  const outOfStock = estimateOutOfStock(listings, ctx);
  const buyBox = estimateBuyBox(listings, ctx);
  const mapLeakage = estimateMapLeakage(listings, ctx);
  const content = estimateContent(listings, ctx);
  const phase1 = rollupPhase1([outOfStock, buyBox, content.splintered, content.missing_specs, content.aplus], catalog, ctx.dataAsOf ?? null);
  return {
    outOfStock,
    buyBox,
    mapLeakage,
    splintered: content.splintered,
    missingSpecs: content.missing_specs,
    miscategorized: content.miscategorized,
    aplus: content.aplus,
    phase1,
    catalog,
  };
}
