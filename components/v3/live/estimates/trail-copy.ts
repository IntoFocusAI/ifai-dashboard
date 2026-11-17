import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatMoneyRange, formatMoneyShort, sanitizeUiText } from "@/lib/fender-canvas/format";
import type {
  Benchmark,
  BenchmarkSource,
  EstimateConfidence,
  EstimateLineId,
  EstimateResult,
  EstimateTrail,
  EstimateTrailInput,
  SalesSource,
} from "@/lib/estimates/types";

/** The required label on every dollar estimate (AGENTS.md), as a heading. */
export const ANALYST_ESTIMATE = "Analyst estimate";

export const ANALYST_ESTIMATE_TIP =
  "Sales of the brand's products at retail prices, per year, worked out by IntoFocus from the inputs below. The range is the same formula run with each benchmark at its low and its high.";

export const NOT_AVAILABLE_LISTINGS_TIP =
  "Listings with no sales figure yet. They are left out of the figure, not counted as $0, until a sales figure is collected for them.";

/** The figure as mid with its range, or Not available* when no listing had a sales figure. */
export function resultFigureText(result: Pick<EstimateResult, "status" | "range">): string {
  return result.status === "estimated" && result.range ? formatMoneyRange(result.range) : READ_NOT_AVAILABLE;
}

const SALES_SOURCE_WORDS: Record<SalesSource, string> = {
  brand_reported: "the brand's own sales",
  smartscout: "SmartScout",
  keepa_monthly_sold: "Keepa monthly sold",
  sales_rank_curve: "sales rank",
  none: "no sales figure",
};

/** What the estimated listings are estimated from: "sales rank", or both in order of listings. */
export function estimatedFrom(trail: Pick<EstimateTrail, "salesSources">): string | null {
  const used = (["keepa_monthly_sold", "sales_rank_curve"] as const)
    .filter((source) => (trail.salesSources[source]?.listings ?? 0) > 0)
    .sort((a, b) => trail.salesSources[b].listings - trail.salesSources[a].listings)
    .map((source) => SALES_SOURCE_WORDS[source]);
  return used.length ? used.join(" and ") : null;
}

export type CoverageParts = {
  /** "Based on 62 of 214 listings" (N = listings with a measured sales figure). */
  lead: string;
  /** "120 estimated from sales rank", or null when none are estimated. */
  estimated: string | null;
  /** "32", shown before Not available*, or null when every listing has a sales figure. */
  notAvailable: string | null;
};

export function coverageParts(trail: Pick<EstimateTrail, "coverage" | "salesSources">): CoverageParts {
  const { coverage } = trail;
  const from = estimatedFrom(trail);
  return {
    lead: `Based on ${formatInt(coverage.measured)} of ${formatInt(coverage.total)} listings`,
    estimated:
      coverage.estimated > 0 ? `${formatInt(coverage.estimated)} estimated${from ? ` from ${from}` : ""}` : null,
    notAvailable: coverage.notAvailable > 0 ? formatInt(coverage.notAvailable) : null,
  };
}

/** "Based on 62 of 214 listings; 120 estimated from sales rank; 32 Not available*" */
export function coverageText(trail: Pick<EstimateTrail, "coverage" | "salesSources">): string {
  const parts = coverageParts(trail);
  return [parts.lead, parts.estimated, parts.notAvailable ? `${parts.notAvailable} ${READ_NOT_AVAILABLE}` : null]
    .filter(Boolean)
    .join("; ");
}

/** Where the sales figures come from, one row per source used, largest first (approval 10). */
export function salesSourceRows(trail: Pick<EstimateTrail, "salesSources">) {
  return (Object.keys(SALES_SOURCE_WORDS) as SalesSource[])
    .map((source) => ({ source, ...(trail.salesSources[source] ?? { listings: 0, annualSales: 0 }) }))
    .filter((row) => row.listings > 0)
    .sort((a, b) => b.listings - a.listings)
    .map((row) => ({
      source: row.source,
      label: SALES_SOURCE_LABELS[row.source],
      listings: formatInt(row.listings),
      annualSales: row.source === "none" ? READ_NOT_AVAILABLE : `${formatMoneyShort(row.annualSales)} a year`,
    }));
}

export const SALES_SOURCE_LABELS: Record<SalesSource, string> = {
  brand_reported: "Brand-reported Amazon sales",
  smartscout: "SmartScout sales estimate",
  keepa_monthly_sold: "Estimated from Keepa monthly sold",
  sales_rank_curve: "Estimated from sales rank",
  none: "No sales figure yet",
};

/** 0.4 reads 40%; 0.017 reads 1.7%. */
export function formatShare(share: number): string {
  const pct = Math.round(share * 1000) / 10;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

function unitValue(unit: EstimateTrailInput["unit"] | Benchmark["unit"], value: number): string {
  switch (unit) {
    case "usd":
      return formatMoneyShort(value);
    case "usd_per_day":
      return `${formatMoneyShort(value)} a day`;
    case "share":
      return formatShare(value);
    case "days":
      return `${formatInt(value)} ${value === 1 ? "day" : "days"}`;
    case "units":
      return `${formatInt(value)} ${value === 1 ? "unit" : "units"}`;
    case "units_per_month":
      return `${formatInt(value)} a month`;
    default:
      return formatInt(value);
  }
}

/** The benchmark an input cites, when its source is a benchmark id. */
export function inputBenchmark(input: Pick<EstimateTrailInput, "source">, trail: Pick<EstimateTrail, "benchmarks">) {
  return trail.benchmarks.find((benchmark) => benchmark.id === input.source) ?? null;
}

/** The value as used, with the benchmark's range beside it: "40% (30% to 55%)". */
export function inputValueText(input: Pick<EstimateTrailInput, "unit" | "value">, benchmark?: Benchmark | null): string {
  if (input.value == null || input.value === "") return READ_NOT_AVAILABLE;
  if (typeof input.value === "string") return sanitizeUiText(input.value);
  const value = unitValue(input.unit, input.value);
  if (!benchmark || benchmark.low === benchmark.high) return value;
  return `${value} (${unitValue(benchmark.unit, benchmark.low)} to ${unitValue(benchmark.unit, benchmark.high)})`;
}

/**
 * Where an input comes from, in the operator's words. The trail's kinds map to the brief's four:
 * collected is measured, an approved IntoFocus assumption is a placeholder until our own results
 * replace it, and derived is worked out from the inputs above it. "client" is ready for when the
 * formula core marks client-given inputs.
 */
export const INPUT_KIND_LABELS: Record<string, string> = {
  collected: "Measured",
  client: "Client-provided",
  benchmark: "Benchmark",
  assumption: "Placeholder",
  derived: "Worked out",
};

export const INPUT_KIND_TIPS: Record<string, string> = {
  collected: "Read by IntoFocus from the data behind this dashboard, listing by listing.",
  client: "Given by the brand, for example during onboarding.",
  benchmark: "A published study or industry figure. The source is listed below.",
  assumption: "An IntoFocus assumption, used until our own before-and-after results replace it.",
  derived: "Worked out from the other inputs in this list.",
};

export function inputKindLabel(kind: string): string {
  return INPUT_KIND_LABELS[kind] ?? kind;
}

/** The kind's definition, with the exact column or benchmark id for anyone checking the figure. */
export function inputKindTip(input: Pick<EstimateTrailInput, "kind" | "source">): string {
  const base = INPUT_KIND_TIPS[input.kind] ?? "";
  return sanitizeUiText(input.source ? `${base} Read from: ${input.source}.`.trim() : base);
}

/** Confidence wears the status mark and word (StatusMark), never color alone. */
export const CONFIDENCE_STATUS: Record<EstimateConfidence, DataStatus> = {
  high: "good",
  medium: "okay",
  low: "bad",
};

export const CONFIDENCE_WORD: Record<EstimateConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * The one input that would most improve each line's confidence, from the approved proposal's
 * "Best improvement" (docs/dollar-estimates-proposal.md section 3; decision 112).
 */
export const MOST_IMPROVED_BY: Record<EstimateLineId, string> = {
  out_of_stock: "The brand's own Amazon sales by listing, in place of SmartScout. It would also bring in the listings awaiting inputs.",
  buy_box:
    "Our own measurement: each listing's sales with and without the Buy Box over a few months, in place of the 80% share.",
  map_leakage: "MAP price history, so the time below MAP is measured, plus units sold at Walmart and other retailers.",
  splintered: "Review counts per listing and per parent listing, so the lift follows each listing's own reviews.",
  missing_specs:
    "Our own before-and-after: sales in the 60 days after a listing's specs are completed, against similar listings that did not change.",
  miscategorized: "The miscategorized-listing check itself, then the same before-and-after measurement as missing specs.",
  aplus: "The brand's own sales by listing.",
  ai_unbranded: "The brand's sales in every channel, by category (onboarding questions 1 and 3).",
  ai_branded: "The brand's sales in every channel (onboarding question 1).",
  brand_site_pages: "Brand-site revenue and the list of products meant to be sold there.",
  ai_actuation: "Verified Actuation records over time, to see whether rates move after placements.",
  phase_1: "The brand's own Amazon sales by listing, in place of SmartScout.",
  measured_total: "The brand's sales in every channel (onboarding question 1).",
  enterprise_potential: "The brand's own revenue, in place of the public placeholder.",
};

/** A source link only when it is a web address; anything else shows as plain text. */
export function sourceHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export const SOURCE_NOT_CHECKED = "Source not yet checked against the page itself.";

/** The source's tooltip: what it is used for, how far it is trusted, and whether it is checked. */
export function sourceTip(source: BenchmarkSource): string {
  return sanitizeUiText(
    [
      source.usedFor ? `Used for: ${source.usedFor}.` : null,
      source.credibility ? `Credibility: ${source.credibility}.` : null,
      source.verified ? null : SOURCE_NOT_CHECKED,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
