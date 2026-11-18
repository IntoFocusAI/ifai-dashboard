// Lines 8 and 9: the AI Search gaps (proposal section 3, decision 112, chunk E5 light v1, approved 18 Nov).
//
//   8  Unbranded Discovery gap: brand sales x share of sales shaped by an unbranded AI answer
//      x relative gap to target x share of added recommendations that become purchases.
//      Target: the top rival's rate when the brand trails it, otherwise the dashboard's Good band (65%).
//   9  Branded Consideration gap: the same, with the Branded Consideration rate and a target of 90%.
//
// The relative gap is (target minus current) / current, capped at 100% (AI_RELATIVE_GAP_CAP). A rate
// at or above its target prices at $0 and the trail says it is at target. The rates are the brand's
// in the date-pill window, read the same way as the Briefing lead; this file takes them as numbers
// and names no client.
//
// Overlap rules: the two lines are separate pools (rule 5); before they join Enterprise Potential the
// retailer share of AI sources is removed, because listing fixes already carry it (rule 7). Neither
// line is ever added to Phase 1.

import { AI_BRANDED_SHARE, AI_RECOMMENDATION_CONVERSION, AI_RELATIVE_GAP_CAP, AI_UNBRANDED_SHARE, BRAND_PAGES_SOURCE_SHARE } from "./benchmarks";
import { benchmarkInput, uniqueSources } from "./line";
import { emptySalesSplit, type CatalogSalesCoverage } from "./sales-coverage";
import type { Benchmark, EstimateRange, EstimateResult, EstimateTrailInput, SalesSource } from "./types";

/** The dashboard's Good bands (lib/ai-search/summary.ts): Unbranded Discovery 65%, Branded Consideration 90%. */
export const UNBRANDED_GOOD_BAND = 0.65;
export const BRANDED_GOOD_BAND = 0.9;

/** Answers the brand led, of resolved answers, in the date-pill window. */
export type AiRateCount = { wins: number; resolved: number };

/** What lines 8 and 9 read from the AI answers in the date-pill window. */
export type AiGapInputs = {
  unbranded: AiRateCount;
  branded: AiRateCount;
  /** The rival named most in Unbranded Discovery, with its wins of the same resolved answers. */
  topRival: { brand: string; wins: number; resolved: number } | null;
  /**
   * Citations in Unbranded Discovery answers a rival led, and how many are retailer sites. The
   * retailer share of AI sources is retailers / citations x (1 minus the 15% planned for the brand's
   * own pages), as in the proposal's line 11 table.
   */
  rivalLedCitations: { total: number; retailer: number };
  /** The window's last date, for the trail's as-of. */
  asOf: string | null;
};

/** The AI lines as a screen reads them. error: the AI read failed, so both lines read Not available*. */
export type AiEstimatesRead =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; unbranded: EstimateResult; branded: EstimateResult; retailerShare: number | null; rates: { unbranded: EstimateRange | null; branded: EstimateRange | null } };

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const rateText = (c: AiRateCount) => `${c.wins} of ${c.resolved} resolved answers (${pct(c.wins / c.resolved)})`;

/** Retailer share of AI sources (overlap rule 7). null when no rival-led answer cited a source. */
export function retailerShareOf(c: AiGapInputs["rivalLedCitations"]): number | null {
  if (c.total <= 0) return null;
  return (c.retailer / c.total) * (1 - BRAND_PAGES_SOURCE_SHARE.mid);
}

/** The target for line 8: the top rival's rate when it leads the brand, else the Good band. */
export function unbrandedTarget(inputs: Pick<AiGapInputs, "unbranded" | "topRival">): { rate: number; basis: string } {
  const current = inputs.unbranded.resolved > 0 ? inputs.unbranded.wins / inputs.unbranded.resolved : 0;
  const rival = inputs.topRival && inputs.topRival.resolved > 0 ? inputs.topRival.wins / inputs.topRival.resolved : null;
  if (inputs.topRival && rival != null && rival > current) {
    return { rate: rival, basis: `${inputs.topRival.brand}, the rival named most: ${inputs.topRival.wins} of ${inputs.topRival.resolved} (${pct(rival)})` };
  }
  return { rate: UNBRANDED_GOOD_BAND, basis: `The dashboard's Good band, ${pct(UNBRANDED_GOOD_BAND)}` };
}

/** (target minus current) / current, capped. 0 at or above target. */
export function relativeGap(current: number, target: number): { gap: number; capped: boolean } {
  if (current >= target) return { gap: 0, capped: false };
  const cap = AI_RELATIVE_GAP_CAP.mid;
  const raw = current > 0 ? (target - current) / current : Number.POSITIVE_INFINITY;
  return raw > cap ? { gap: cap, capped: true } : { gap: raw, capped: false };
}

/** Share of sales the line adds per dollar of brand sales: share x gap x conversion, low, mid and high. */
function lineRate(share: Benchmark, gap: number): EstimateRange {
  return {
    low: share.low * gap * AI_RECOMMENDATION_CONVERSION.low,
    mid: share.mid * gap * AI_RECOMMENDATION_CONVERSION.mid,
    high: share.high * gap * AI_RECOMMENDATION_CONVERSION.high,
  };
}

type LineKind = "unbranded" | "branded";

const COPY: Record<LineKind, { lineId: "ai_unbranded" | "ai_branded"; title: string; means: string; formula: string; share: Benchmark; rateLabel: string }> = {
  unbranded: {
    lineId: "ai_unbranded",
    title: "AI Search: Unbranded Discovery gap",
    means: "Added sales in a year if AI assistants named the brand most as often as the target, when the shopper did not name a brand.",
    formula:
      "Brand sales x share of sales shaped by an unbranded AI answer x relative gap to target x share of added recommendations that become purchases. The relative gap is (target minus current) / current, capped at 100%.",
    share: AI_UNBRANDED_SHARE,
    rateLabel: "Unbranded Discovery: brand named most",
  },
  branded: {
    lineId: "ai_branded",
    title: "AI Search: Branded Consideration",
    means: "Added sales in a year if AI assistants favored the brand as often as the target, when the shopper named the brand or compared it.",
    formula:
      "Brand sales x share of sales shaped by a branded AI answer x relative gap to the 90% target x share of added recommendations that become purchases. The relative gap is (target minus current) / current, capped at 100%.",
    share: AI_BRANDED_SHARE,
    rateLabel: "Branded Consideration: brand favored",
  },
};

/** One AI line on the brand's annual sales. Not available* when the window has no resolved answers or no sales. */
export function estimateAiLine(kind: LineKind, inputs: AiGapInputs, catalog: CatalogSalesCoverage, dataAsOf: string | null = null): { result: EstimateResult; rate: EstimateRange | null } {
  const copy = COPY[kind];
  const count = inputs[kind];
  const sales = catalog.annualSales.mid;
  const target = kind === "unbranded" ? unbrandedTarget(inputs) : { rate: BRANDED_GOOD_BAND, basis: `The dashboard's Good band, ${pct(BRANDED_GOOD_BAND)}` };
  const ready = count.resolved > 0 && sales > 0;
  const current = ready ? count.wins / count.resolved : null;
  const gap = current != null ? relativeGap(current, target.rate) : null;
  const rate = gap ? lineRate(copy.share, gap.gap) : null;
  const range: EstimateRange | null = rate ? { low: Math.round(sales * rate.low), mid: Math.round(sales * rate.mid), high: Math.round(sales * rate.high) } : null;
  const atTarget = gap != null && gap.gap === 0;

  // The mid split by sales source in proportion to the sales it rests on, so the table's columns add up.
  const split = emptySalesSplit();
  for (const key of Object.keys(split) as SalesSource[]) {
    split[key].listings = catalog.salesSources[key].listings;
    split[key].annualSales = catalog.salesSources[key].annualSales;
    if (range && sales > 0) split[key].estimate = (range.mid * catalog.salesSources[key].annualSales) / sales;
  }

  const inputsList: EstimateTrailInput[] = [
    { key: "annual_sales", label: "Brand sales: Amazon sales, measured plus estimated", value: sales > 0 ? Math.round(sales) : null, unit: "usd", kind: "derived", source: "sales coverage", asOf: dataAsOf },
    { key: `${kind}_rate`, label: copy.rateLabel, value: count.resolved > 0 ? rateText(count) : null, unit: "text", kind: "collected", source: "canvas_ai_simulations.outcome", asOf: inputs.asOf },
    { key: "target", label: "Target rate", value: target.basis, unit: "text", kind: kind === "unbranded" && target.rate !== UNBRANDED_GOOD_BAND ? "collected" : "assumption", source: "canvas_ai_simulations.primary_brand", asOf: inputs.asOf },
    { key: "relative_gap", label: "Relative gap to target", value: gap ? (atTarget ? "0, at target" : `${pct(gap.gap)}${gap.capped ? ", capped" : ""}`) : null, unit: "text", kind: "derived", source: "(target - current) / current" },
    benchmarkInput(copy.share),
    benchmarkInput(AI_RECOMMENDATION_CONVERSION),
    benchmarkInput(AI_RELATIVE_GAP_CAP),
  ];
  const notes: string[] = [];
  if (atTarget && current != null) notes.push(`At target: ${pct(current)} against ${pct(target.rate)}, so no added sales are priced.`);
  if (gap?.capped) notes.push("The relative gap is capped at 100%: no brand is credited with more than doubling its AI-shaped sales in a year.");
  notes.push("An AI answer shapes the choice of brand wherever the shopper then buys, so the right base is all-channel sales. Until the client gives that figure this line runs on the Amazon sales we price.");
  notes.push("Never added to Phase 1. It joins Enterprise Potential less the retailer share of AI sources, because listing fixes already carry that share.");

  const benchmarks = [copy.share, AI_RECOMMENDATION_CONVERSION, AI_RELATIVE_GAP_CAP];
  return {
    rate,
    result: {
      lineId: copy.lineId,
      status: range ? "estimated" : "not_available",
      range,
      label: "analyst estimate",
      asterisk: Boolean(range) && catalog.after.partial,
      countsInTotal: false,
      trail: {
        lineId: copy.lineId,
        title: copy.title,
        means: copy.means,
        formula: copy.formula,
        inputs: inputsList,
        coverage: catalog.after,
        salesSources: split,
        benchmarks,
        sources: uniqueSources(benchmarks),
        confidence: "low",
        confidenceReason: "The rates are measured; the share of shopping an AI answer shapes is the widest range in the estimates.",
        mostImprovedBy: "The brand's sales in every channel (onboarding question 1).",
        notes,
        listings: [],
      },
    },
  };
}

/** Lines 8 and 9 from the window's AI answers. */
export function estimateAiLines(inputs: AiGapInputs, catalog: CatalogSalesCoverage, dataAsOf: string | null = null): Extract<AiEstimatesRead, { phase: "ready" }> {
  const unbranded = estimateAiLine("unbranded", inputs, catalog, dataAsOf);
  const branded = estimateAiLine("branded", inputs, catalog, dataAsOf);
  return {
    phase: "ready",
    unbranded: unbranded.result,
    branded: branded.result,
    retailerShare: retailerShareOf(inputs.rivalLedCitations),
    rates: { unbranded: unbranded.rate, branded: branded.rate },
  };
}
