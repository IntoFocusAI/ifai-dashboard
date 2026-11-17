// Shared types for dollar estimates (decision 111, proposal docs/dollar-estimates-proposal.md).
// The trail drawer (components/v3/live/estimates) renders EstimateTrail. Keep these shapes stable:
// add optional fields rather than renaming or removing.
//
// Every dollar is an analyst estimate of sales of the brand's products at retail prices, per year.

/** The formula run three times: low, mid and high benchmark values. USD per year unless a field says otherwise. */
export type EstimateRange = { low: number; mid: number; high: number };

export type EstimateConfidence = "high" | "medium" | "low";

/** Estimate lines, numbered as in the approved proposal's section 1 table. */
export type EstimateLineId =
  | "out_of_stock" // 1
  | "buy_box" // 2
  | "map_leakage" // 3, beside the total, never in it
  | "splintered" // 4
  | "missing_specs" // 5
  | "miscategorized" // 6, held until D-12 exists
  | "aplus" // 7
  | "ai_unbranded" // 8 (chunk E5)
  | "ai_branded" // 9 (chunk E5)
  | "brand_site_pages" // 10 (chunk E5)
  | "ai_actuation" // 11 (chunk E5)
  | "phase_1" // A: near-term upside
  | "measured_total" // B
  | "enterprise_potential"; // C (chunk E6)

/**
 * Where a listing's annual sales figure came from, in the order used.
 *   brand_reported      the brand's own Amazon sales by listing (onboarding question 4)
 *   smartscout          SmartScout's modelled sales
 *   keepa_monthly_sold  estimated: Keepa's units bought in the past month x price x 12
 *   sales_rank_curve    estimated: Amazon sales rank through a stated rank-to-units curve x price x 12
 *   none                no figure. The listing reads Not available* and is never $0.
 */
export type SalesSource = "brand_reported" | "smartscout" | "keepa_monthly_sold" | "sales_rank_curve" | "none";

/** measured = brand_reported or smartscout. estimated = keepa_monthly_sold or sales_rank_curve. */
export type SalesBasis = "measured" | "estimated" | "not_available";

/** A published source behind a benchmark. verified is false until someone checks the quote against the page. */
export type BenchmarkSource = {
  id: string;
  title: string;
  /** null when the source has no public page (for example a printed report). */
  url: string | null;
  /** As published, in words: "Apr 2026", "2018, reported Mar 2019". */
  date: string;
  usedFor: string;
  credibility: string;
  verified: boolean;
};

/** One benchmark value with its low, mid and high and where they come from. */
export type Benchmark = {
  id: string;
  label: string;
  /** share = a fraction of sales (0.4 is 40%). units_per_month is for rank curves. */
  unit: "share" | "units_per_month";
  low: number;
  mid: number;
  high: number;
  /** published = from a cited study. approved_assumption = an IntoFocus assumption Brian approved. */
  basis: "published" | "approved_assumption";
  /** Plain-language note on how low, mid and high were set and how far to trust them. */
  credibility: string;
  sources: BenchmarkSource[];
};

/**
 * How much of the catalog a figure covers.
 *   total         M: listings the line applies to (for example listings with an out-of-stock day)
 *   measured      N: listings priced on SmartScout or brand-reported sales
 *   estimated     K: listings priced on a Keepa or sales-rank estimate
 *   notAvailable  the rest: no sales figure. They read Not available* and are never $0.
 * measured + estimated + notAvailable = total.
 */
export type EstimateCoverage = {
  total: number;
  measured: number;
  estimated: number;
  notAvailable: number;
  /** True when notAvailable > 0. The figure then carries the asterisk. */
  partial: boolean;
  /** "Based on N of M listings" when partial (N = measured + estimated), else null. */
  tooltip: string | null;
  /** One sentence with the split, for the trail: "24 of 166 listings measured, 97 estimated, 45 Not available*". */
  sentence: string;
};

/** One input shown in the trail. */
export type EstimateTrailInput = {
  key: string;
  label: string;
  value: number | string | null;
  unit: "usd" | "usd_per_day" | "days" | "share" | "count" | "units" | "text";
  /** collected = read from a dashboard view. benchmark = a published figure. assumption = IntoFocus. derived = computed here. */
  kind: "collected" | "benchmark" | "assumption" | "derived";
  /** View and column ("canvas_listing_sales_loss_v2.oos_days_365"), or a benchmark id from benchmarks.ts. */
  source: string;
};

/** Dollars and listings by sales source, so a total that mixes sources shows the split (approval 10). */
export type SalesSourceSplit = Record<SalesSource, { listings: number; annualSales: number }>;

/** One listing's part of a line. The drill-down rows behind N of M. */
export type EstimateListingRow = {
  asin: string;
  title: string | null;
  salesSource: SalesSource;
  salesBasis: SalesBasis;
  /** Annual sales used for the listing, USD. null when Not available*. */
  annualSales: number | null;
  /** The sales the problem touches (for example missed sales at the listing level). null when Not available*. */
  touchedSales: number | null;
  /** The listing's contribution to the line. null when Not available*. */
  range: EstimateRange | null;
  /** Line-specific inputs, for example { oosDays: 41, salesPerInStockDay: 212.5 }. */
  detail: Record<string, number | string | boolean | null>;
};

/** Everything a figure opens to: inputs, coverage, formula, sources, confidence. */
export type EstimateTrail = {
  lineId: EstimateLineId;
  title: string;
  /** What the figure means, one sentence. */
  means: string;
  /** The formula in one plain-language sentence. */
  formula: string;
  inputs: EstimateTrailInput[];
  coverage: EstimateCoverage;
  salesSources: SalesSourceSplit;
  benchmarks: Benchmark[];
  /** Every source behind the benchmarks, de-duplicated. */
  sources: BenchmarkSource[];
  confidence: EstimateConfidence;
  confidenceReason: string;
  /** Extra plain-language notes: overlap rules applied, caps hit, what would improve the figure. */
  notes: string[];
  /** Per-listing rows. Empty for rollups, which carry `parts` on the result instead. */
  listings: EstimateListingRow[];
};

/** One estimate line or rollup, ready to show. */
export type EstimateResult = {
  lineId: EstimateLineId;
  /** estimated = range is set. not_available = no listing had a sales figure; show Not available*, never $0. */
  status: "estimated" | "not_available";
  range: EstimateRange | null;
  /** Always shown with the figure. */
  label: "analyst estimate";
  /** True when the figure carries the asterisk (coverage is partial). */
  asterisk: boolean;
  /** False for lines shown beside the total (MAP) or held (miscategorized). */
  countsInTotal: boolean;
  trail: EstimateTrail;
  /** Rollups only: the lines added together. */
  parts?: EstimateResult[];
};
