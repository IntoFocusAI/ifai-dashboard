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
  | "monthly_potential" // Phase 1 divided by 12 (Briefing card)
  | "measured_total" // B
  | "enterprise_potential"; // C (chunk E6)

/**
 * Where a listing's annual sales figure came from, in the order used.
 *   brand_reported      the brand's own Amazon sales by listing (onboarding question 4)
 *   smartscout          SmartScout's modelled sales; $0 when it tracks the listing and reports no sales
 *                       and no estimate applies (measured, no sales; decision 113)
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
  /** The words on the page that support the figure, when verified. Not rendered on screen. */
  quote?: string;
  /** When and how the page was checked, and any correction. Not rendered on screen. */
  checked?: string;
};

/** One benchmark value with its low, mid and high and where they come from. */
export type Benchmark = {
  id: string;
  label: string;
  /** share = a fraction of sales (0.4 is 40%). multiplier = a factor applied to another input. */
  unit: "share" | "units_per_month" | "multiplier";
  low: number;
  mid: number;
  high: number;
  /**
   * published = from a cited study. approved_assumption = an IntoFocus assumption Brian approved.
   * proposed_assumption = an IntoFocus assumption or calibration Brian has not approved yet.
   */
  basis: "published" | "approved_assumption" | "proposed_assumption";
  /** Plain-language note on how low, mid and high were set and how far to trust them. */
  credibility: string;
  sources: BenchmarkSource[];
};

/**
 * How much of the catalog a figure covers.
 *   total         M: listings the line applies to (for example listings with an out-of-stock day)
 *   measured      N: listings priced on SmartScout or brand-reported sales, including listings
 *                 SmartScout tracks and reports no sales for (measured, no sales, at $0; decision 113)
 *   estimated     K: listings priced on a Keepa or sales-rank estimate
 *   notAvailable  the rest: no sales figure. They read Not available* and are never $0.
 * measured + estimated + notAvailable = total.
 */
export type EstimateCoverage = {
  total: number;
  measured: number;
  estimated: number;
  notAvailable: number;
  /**
   * Of measured: listings SmartScout tracks and reports no sales for (measured, no sales; decision 113).
   * They are covered and contribute $0; they are never Not available*.
   */
  reportedNoSales?: number;
  /** True when notAvailable > 0. The figure then carries the asterisk. */
  partial: boolean;
  /**
   * The short tooltip line when partial, else null: "Based on 182 of 214 listings (62 measured, 120
   * estimated)". The first number is measured + estimated.
   */
  tooltip: string | null;
  /** One sentence with the split, for the trail: "60 of 166 listings measured (36 with no sales), 97 estimated, 9 Not available*". */
  sentence: string;
};

/** One input shown in the trail. */
export type EstimateTrailInput = {
  key: string;
  label: string;
  value: number | string | null;
  unit: "usd" | "usd_per_day" | "days" | "share" | "count" | "units" | "text";
  /**
   * collected = read from a dashboard view. benchmark = a published figure. assumption = IntoFocus.
   * derived = computed here. client = given by the client at onboarding.
   */
  kind: "collected" | "benchmark" | "assumption" | "derived" | "client";
  /** View and column ("canvas_listing_sales_loss_v2.oos_days_365"), or a benchmark id from benchmarks.ts. */
  source: string;
  /** The data date for a collected input ("2026-11-17"); the publication date for a benchmark ("Apr 2026"). */
  asOf?: string | null;
};

/** Dollars and listings by sales source, so a total that mixes sources shows the split (approval 10). */
export type SalesSourceSplit = Record<
  SalesSource,
  {
    listings: number;
    /** Annual sales (mid) of the listings priced from this source. */
    annualSales: number;
    /** The part of the line's mid figure that comes from this source. */
    estimate?: number;
  }
>;

/** One listing's part of a line. The drill-down rows behind N of M. */
export type EstimateListingRow = {
  asin: string;
  title: string | null;
  salesSource: SalesSource;
  salesBasis: SalesBasis;
  /** Annual sales used for the listing, USD (the mid value when estimated). null when Not available*. */
  annualSales: number | null;
  /** Set when the sales figure is estimated: its low, mid and high. */
  annualSalesRange?: EstimateRange;
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
  /** The one input that would most improve the grade (the proposal's "Best improvement"). */
  mostImprovedBy?: string;
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

/**
 * One listing, as the estimate functions read it. Every field is optional except asin: a missing or
 * null field means not collected, never zero. The read layer fills this from the canvas views.
 */
export type EstimateListingInput = {
  asin: string;
  title?: string | null;

  // Sales, in source order.
  /** The brand's own Amazon sales for the listing, last 12 months, USD (onboarding question 4). */
  brandReportedAnnualSales?: number | null;
  /** True when SmartScout has a record for the listing (canvas_listing_sales_loss_v2.smartscout_snapshot_date is set). */
  smartscoutHasRecord?: boolean;
  /** canvas_listing_sales_loss_v2.smartscout_ttm_revenue */
  smartscoutTtmRevenue?: number | null;
  /** canvas_listing_sales_loss_v2.smartscout_monthly_units */
  smartscoutMonthlyUnits?: number | null;
  /** canvas_listing_sales_loss_v2.smartscout_monthly_revenue: SmartScout sales, last 30 days, USD (R-06). */
  smartscoutMonthlyRevenue?: number | null;
  /** canvas_listing_sales_loss_v2.baseline_daily_revenue: SmartScout sales per Keepa in-stock day. */
  baselineDailyRevenue?: number | null;
  /** canvas_listing_sales_loss_v2.est_lost_revenue_oos_365: sales per in-stock day x out-of-stock days (R-17). */
  missedSalesOos365?: number | null;

  // Keepa, for listings with no measured sales.
  /** Current Amazon price, USD: canvas_listing_sales_loss_v2.current_price, else canvas_retail_listings.offer_price. */
  price?: number | null;
  /** canvas_retail_listings.monthly_sold: Amazon's "bought in past month" figure, a floor ("50+"). */
  keepaMonthlySold?: number | null;
  /** canvas_listing_sales_loss_v2.sales_rank_current, else canvas_retail_listings.sales_rank. */
  salesRank?: number | null;
  /** The Amazon category the sales rank is counted in. Picks the rank curve. */
  rankCategory?: string | null;

  // Keepa day counts, last 365 and last 30 days (canvas_listing_sales_loss_v2).
  inStockDays365?: number | null;
  inStockDays30?: number | null;
  oosDays365?: number | null;
  noBuyBoxDays365?: number | null;
  /** Days in the last 30 with a new offer and no Buy Box (canvas_listing_sales_loss_v2.no_buy_box_days_30). */
  noBuyBoxDays30?: number | null;
  observedDays365?: number | null;

  /** True when Amazon withholds the listing's Buy Box today (canvas_retail_listings.featured_offer_state = 'withheld'). */
  buyBoxWithheld?: boolean | null;

  // MAP. canvas_retail_listings.amz_leakage: Amazon price minus MAP, negative when below MAP.
  amzLeakage?: number | null;

  // Content.
  /** canvas_retail_listings.is_bundle */
  isBundle?: boolean | null;
  /** canvas_retail_listings.parent_asin */
  parentAsin?: string | null;
  /** canvas_spec_readiness.amazon_completeness_pct, 0 to 100. null when the listing was not checked. */
  amazonCompletenessPct?: number | null;
  /** canvas_listing_content.aplus_state */
  aplusState?: string | null;
  /** True when the D-12 check flags the listing. Not collected yet. */
  miscategorized?: boolean | null;
};
