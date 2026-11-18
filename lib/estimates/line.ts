// Shared assembly for one estimate line: adds the listings, counts coverage, builds the trail.
import { buildCoverage, emptySalesSplit, salesBasis, type SalesQuantity } from "./sales-coverage";
import type {
  Benchmark,
  BenchmarkSource,
  EstimateConfidence,
  EstimateLineId,
  EstimateListingInput,
  EstimateListingRow,
  EstimateRange,
  EstimateResult,
  EstimateTrailInput,
} from "./types";

export const ZERO: EstimateRange = { low: 0, mid: 0, high: 0 };

export function add(a: EstimateRange, b: EstimateRange): EstimateRange {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

/** Low x low, mid x mid, high x high: the formula run three times. */
export function times(a: EstimateRange, b: EstimateRange | Benchmark | number): EstimateRange {
  if (typeof b === "number") return { low: a.low * b, mid: a.mid * b, high: a.high * b };
  return { low: a.low * b.low, mid: a.mid * b.mid, high: a.high * b.high };
}

export function roundRange(r: EstimateRange): EstimateRange {
  return { low: Math.round(r.low), mid: Math.round(r.mid), high: Math.round(r.high) };
}

export function benchmarkInput(b: Benchmark): EstimateTrailInput {
  const pct = (x: number) => (b.unit === "share" ? `${Math.round(x * 1000) / 10}%` : String(x));
  const value = b.low === b.high ? pct(b.mid) : `${pct(b.low)} low, ${pct(b.mid)} mid, ${pct(b.high)} high`;
  return { key: b.id, label: b.label, value, unit: "text", kind: b.basis === "published" ? "benchmark" : "assumption", source: b.id, asOf: b.sources[0]?.date ?? null };
}

/** One affected listing's part of a line, before assembly. */
export type LinePiece = {
  listing: EstimateListingInput;
  /** The sales figure the line used for this listing. null when the listing has none. */
  quantity: SalesQuantity | null;
  /** The listing's annual sales, when known. */
  annual: SalesQuantity | null;
  reportedNoSales: boolean;
  touched: EstimateRange | null;
  range: EstimateRange | null;
  detail: EstimateListingRow["detail"];
};

export type LineSpec = {
  lineId: EstimateLineId;
  title: string;
  means: string;
  formula: string;
  inputs: EstimateTrailInput[];
  benchmarks: Benchmark[];
  /** The grade when every listing is priced on measured sales. */
  confidence: EstimateConfidence;
  confidenceReason: string;
  /** The one input that would most improve the grade. */
  mostImprovedBy: string;
  notes: string[];
  countsInTotal: boolean;
};

const ONE_GRADE_DOWN: Record<EstimateConfidence, EstimateConfidence> = { high: "medium", medium: "low", low: "low" };

/** Sources behind a set of benchmarks, each once. */
export function uniqueSources(benchmarks: Benchmark[], extra: BenchmarkSource[] = []): BenchmarkSource[] {
  const seen = new Map<string, BenchmarkSource>();
  for (const s of [...benchmarks.flatMap((b) => b.sources), ...extra]) if (!seen.has(s.id)) seen.set(s.id, s);
  return [...seen.values()];
}

/**
 * Adds the pieces into one line. A listing with no sales figure is left out of the dollars and
 * counted as Not available*. A line where no listing has a figure reads Not available*, never $0.
 * Confidence drops one grade when more than half of the mid figure rests on estimated sales.
 */
export function assembleLine(spec: LineSpec, pieces: LinePiece[], extraSources: BenchmarkSource[] = [], dataAsOf: string | null = null): EstimateResult {
  const coverage = buildCoverage(pieces.map((p) => ({ source: p.range ? (p.quantity?.source ?? "none") : "none", reportedNoSales: p.reportedNoSales })));
  const split = emptySalesSplit();
  let total: EstimateRange = ZERO;
  let touched = 0;
  let estimatedMid = 0;
  let priced = 0;
  const rows: EstimateListingRow[] = [];
  for (const p of pieces) {
    const source = p.range ? (p.quantity?.source ?? "none") : "none";
    const bucket = split[source];
    bucket.listings += 1;
    if (p.range) {
      priced += 1;
      total = add(total, p.range);
      touched += p.touched?.mid ?? 0;
      bucket.annualSales += p.annual?.range.mid ?? 0;
      bucket.estimate = (bucket.estimate ?? 0) + p.range.mid;
      if (salesBasis(source) === "estimated") estimatedMid += p.range.mid;
    }
    const row: EstimateListingRow = {
      asin: p.listing.asin,
      title: p.listing.title ?? null,
      salesSource: source,
      salesBasis: salesBasis(source),
      annualSales: p.annual ? p.annual.range.mid : null,
      touchedSales: p.range && p.touched ? p.touched.mid : null,
      range: p.range,
      detail: p.detail,
    };
    if (p.annual && salesBasis(p.annual.source) === "estimated") row.annualSalesRange = p.annual.range;
    rows.push(row);
  }
  rows.sort((a, b) => (b.range?.mid ?? -1) - (a.range?.mid ?? -1));

  const estimated = priced > 0;
  const mostlyEstimated = estimated && total.mid > 0 && estimatedMid / total.mid > 0.5;
  const notes = [...spec.notes];
  if (coverage.estimated > 0) {
    notes.push(
      `${coverage.estimated} ${coverage.estimated === 1 ? "listing has" : "listings have"} no SmartScout or brand-reported sales. Their sales are estimated from Amazon's bought-in-past-month figure, or from tracked listings with a similar sales rank.`,
    );
  }
  if ((coverage.reportedNoSales ?? 0) > 0) {
    notes.push(
      `${coverage.reportedNoSales} ${coverage.reportedNoSales === 1 ? "listing is" : "listings are"} tracked by SmartScout with no sales reported. They count as measured and add $0.`,
    );
  }
  if (mostlyEstimated) notes.push("More than half of this figure rests on estimated sales, so its confidence is one grade lower.");

  return {
    lineId: spec.lineId,
    status: estimated ? "estimated" : "not_available",
    range: estimated ? roundRange(total) : null,
    label: "analyst estimate",
    asterisk: coverage.partial,
    countsInTotal: spec.countsInTotal,
    trail: {
      lineId: spec.lineId,
      title: spec.title,
      means: spec.means,
      formula: spec.formula,
      inputs: [
        ...[
          { key: "listings_affected", label: "Listings the problem touches", value: coverage.total, unit: "count" as const, kind: "collected" as const, source: "coverage" },
          { key: "touched_sales", label: "Sales the problem touches, before the shares below", value: estimated ? Math.round(touched) : null, unit: "usd" as const, kind: "derived" as const, source: "sum of listings" },
          ...spec.inputs,
        ].map((i): EstimateTrailInput => ({ ...i, asOf: i.asOf ?? dataAsOf })),
        ...spec.benchmarks.map(benchmarkInput),
      ],
      coverage,
      salesSources: split,
      benchmarks: spec.benchmarks,
      sources: uniqueSources(spec.benchmarks, coverage.estimated > 0 ? extraSources : []),
      confidence: mostlyEstimated ? ONE_GRADE_DOWN[spec.confidence] : spec.confidence,
      confidenceReason: spec.confidenceReason,
      mostImprovedBy: spec.mostImprovedBy,
      notes,
      listings: rows,
    },
  };
}
