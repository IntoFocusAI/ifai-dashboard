// Sales coverage (decision 112): upside covers the whole catalog, not only listings SmartScout tracks.
//
// Each listing's sales come from the first source that has them:
//   1. brand_reported      the brand's own Amazon sales by listing                      measured
//   2. smartscout          SmartScout's last 12 months                                  measured
//   3. keepa_monthly_sold  Amazon's "bought in past month" figure, read by Keepa        estimated
//   4. sales_rank_curve    tracked listings with a similar sales rank (rank-curve.ts)   estimated
//   5. smartscout, $0      SmartScout tracks the listing and reports no sales           measured, no sales
//   6. none                Not available*. Never $0.
//
// Step 4 applies only to listings SmartScout has no record for. A listing SmartScout tracks and
// reports no sales for is already in the curve as a zero; pricing it at its band's average would
// count those zeros as sales. Decision 113 (Brian, 17 Nov 2026): it counts as "measured, no sales",
// covered and contributing $0, not Not available*. Keepa's bought-in-past-month figure still wins
// over SmartScout's zero, because Amazon itself shows units sold.
//
// Keepa's figures describe selling speed while in stock, so an estimated listing's annual sales are
// its sales per in-stock day x its in-stock days in the last 12 months. Its out-of-stock days are
// then priced by the out-of-stock line, not counted twice.

import { KEEPA_MONTHLY_SOLD_MULTIPLIER, RANK_CURVES } from "./benchmarks";
import { rankCurveBand, type RankCurve, type RankCurvePoint } from "./rank-curve";
import type { EstimateCoverage, EstimateListingInput, EstimateRange, SalesBasis, SalesSource, SalesSourceSplit } from "./types";

/** In-stock days needed in the last 12 months before sales are divided by them (the view's rule). */
export const MIN_IN_STOCK_DAYS_365 = 30;
/** In-stock days needed in the last 30 before a 30-day figure is divided by them (the view's rule). */
export const MIN_IN_STOCK_DAYS_30 = 7;

/** One resolved figure and the source it came from. */
export type SalesQuantity = { source: SalesSource; range: EstimateRange };

export type ResolvedSales = {
  /** Annual sales at retail prices, USD. */
  annual: SalesQuantity | null;
  /** Sales per in-stock day, USD. */
  perInStockDay: SalesQuantity | null;
  /** Units per month (per 30 in-stock days when estimated). */
  monthlyUnits: SalesQuantity | null;
  /**
   * Measured, no sales (decision 113): SmartScout tracks the listing, reports no sales, and no other
   * source has a figure. Its quantities are SmartScout's $0 and 0 units, so it is covered at $0.
   */
  reportedNoSales: boolean;
  /** Inputs behind an estimated figure, for the trail row. */
  detail: Record<string, number | string | boolean | null>;
};

export type SalesContext = {
  /** Rank curves by Amazon category. Defaults to the stored curves in benchmarks.ts. */
  rankCurves?: Record<string, RankCurve>;
  /**
   * "all" (the default) uses every source. "measured_only" stops after brand-reported and SmartScout
   * sales: the figures as the proposal worked them, before decision 112.
   */
  salesSources?: "all" | "measured_only";
  /** The date the listings were read ("2026-11-17"). Shown as the as-of date on collected inputs. */
  dataAsOf?: string;
};

const pos = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;
const exact = (x: number): EstimateRange => ({ low: x, mid: x, high: x });
const scale = (r: EstimateRange, k: number): EstimateRange => ({ low: r.low * k, mid: r.mid * k, high: r.high * k });

export function salesBasis(source: SalesSource): SalesBasis {
  if (source === "brand_reported" || source === "smartscout") return "measured";
  if (source === "keepa_monthly_sold" || source === "sales_rank_curve") return "estimated";
  return "not_available";
}

/**
 * The tracked listings a rank curve is built from: a SmartScout record, a sales rank, a price, and
 * at least 30 in-stock days. Units are SmartScout's last-12-month sales / price / in-stock days x 30,
 * and 0 for a tracked listing that sold nothing.
 */
export function rankCurvePoints(listings: EstimateListingInput[]): RankCurvePoint[] {
  const points: RankCurvePoint[] = [];
  for (const l of listings) {
    if (!l.smartscoutHasRecord || !pos(l.salesRank) || !pos(l.price)) continue;
    if (!pos(l.inStockDays365) || l.inStockDays365 < MIN_IN_STOCK_DAYS_365) continue;
    const ttm = pos(l.smartscoutTtmRevenue) ? l.smartscoutTtmRevenue : 0;
    points.push({ rank: l.salesRank, unitsPer30InStockDays: (ttm / l.price / l.inStockDays365) * 30 });
  }
  return points;
}

type Estimated = { source: SalesSource; unitsPer30InStockDays: EstimateRange; detail: ResolvedSales["detail"] };

/** Steps 3 and 4: units per 30 in-stock days from Keepa, else from the rank curve. */
function estimatedUnits(l: EstimateListingInput, ctx: SalesContext): Estimated | null {
  if (ctx.salesSources === "measured_only" || !pos(l.price)) return null;
  if (pos(l.keepaMonthlySold)) {
    const m = KEEPA_MONTHLY_SOLD_MULTIPLIER;
    const sold: EstimateRange = { low: l.keepaMonthlySold * m.low, mid: l.keepaMonthlySold * m.mid, high: l.keepaMonthlySold * m.high };
    // Units in the last 30 days were sold on the days the listing was in stock.
    const days = pos(l.inStockDays30) && l.inStockDays30 >= MIN_IN_STOCK_DAYS_30 ? l.inStockDays30 : 30;
    return {
      source: "keepa_monthly_sold",
      unitsPer30InStockDays: scale(sold, 30 / days),
      detail: { keepaMonthlySold: l.keepaMonthlySold, inStockDays30Used: days, price: l.price },
    };
  }
  const tracked = l.smartscoutHasRecord || pos(l.brandReportedAnnualSales);
  if (tracked || !pos(l.salesRank) || !l.rankCategory) return null;
  const curve = (ctx.rankCurves ?? RANK_CURVES)[l.rankCategory];
  if (!curve) return null;
  const band = rankCurveBand(curve, l.salesRank);
  if (!band) return null;
  return {
    source: "sales_rank_curve",
    unitsPer30InStockDays: { low: band.low, mid: band.mid, high: band.high },
    detail: {
      salesRank: l.salesRank,
      rankCategory: l.rankCategory,
      rankBandMax: Number.isFinite(band.maxRank) ? band.maxRank : null,
      rankBandListings: band.listings,
      price: l.price,
    },
  };
}

/** Resolves one listing's sales figures, each from the first source that has it. */
export function resolveListingSales(l: EstimateListingInput, ctx: SalesContext = {}): ResolvedSales {
  const inStock365 = pos(l.inStockDays365) && l.inStockDays365 >= MIN_IN_STOCK_DAYS_365 ? l.inStockDays365 : null;
  const est = estimatedUnits(l, ctx);
  // An estimated listing with no Keepa day history is taken as in stock all year.
  const estDays = typeof l.inStockDays365 === "number" && typeof l.observedDays365 === "number" && l.observedDays365 > 0 ? l.inStockDays365 : 365;
  const estPerDay = est && pos(l.price) ? scale(est.unitsPer30InStockDays, l.price / 30) : null;

  let annual: SalesQuantity | null = null;
  if (pos(l.brandReportedAnnualSales)) annual = { source: "brand_reported", range: exact(l.brandReportedAnnualSales) };
  else if (pos(l.smartscoutTtmRevenue)) annual = { source: "smartscout", range: exact(l.smartscoutTtmRevenue) };
  else if (est && estPerDay) annual = { source: est.source, range: scale(estPerDay, estDays) };

  let perInStockDay: SalesQuantity | null = null;
  if (pos(l.brandReportedAnnualSales)) {
    if (inStock365) perInStockDay = { source: "brand_reported", range: exact(l.brandReportedAnnualSales / inStock365) };
  } else if (pos(l.baselineDailyRevenue)) perInStockDay = { source: "smartscout", range: exact(l.baselineDailyRevenue) };
  else if (pos(l.smartscoutTtmRevenue) && inStock365) perInStockDay = { source: "smartscout", range: exact(l.smartscoutTtmRevenue / inStock365) };
  if (!perInStockDay && est && estPerDay) perInStockDay = { source: est.source, range: estPerDay };

  let monthlyUnits: SalesQuantity | null = null;
  if (pos(l.brandReportedAnnualSales) && pos(l.price)) monthlyUnits = { source: "brand_reported", range: exact(l.brandReportedAnnualSales / l.price / 12) };
  else if (pos(l.smartscoutMonthlyUnits)) monthlyUnits = { source: "smartscout", range: exact(l.smartscoutMonthlyUnits) };
  else if (est) monthlyUnits = { source: est.source, range: est.unitsPer30InStockDays };

  const usedEstimate = [annual, perInStockDay, monthlyUnits].some((q) => q && salesBasis(q.source) === "estimated");
  // Step 5: tracked by SmartScout, no sales reported, nothing else known. Measured at $0 (decision 113).
  const reportedNoSales = !annual && !perInStockDay && !monthlyUnits && Boolean(l.smartscoutHasRecord);
  if (reportedNoSales) {
    const zero: SalesQuantity = { source: "smartscout", range: exact(0) };
    annual = zero;
    perInStockDay = zero;
    monthlyUnits = zero;
  }
  return {
    annual,
    perInStockDay,
    monthlyUnits,
    reportedNoSales,
    detail: usedEstimate && est ? { ...est.detail, inStockDays365Used: estDays } : {},
  };
}

/**
 * Counts for a set of listings: N measured, K estimated, the rest Not available*. A listing flagged
 * reportedNoSales with a measured source is measured, no sales (decision 113): counted in N and
 * again in reportedNoSales.
 */
export function buildCoverage(sources: Array<{ source: SalesSource; reportedNoSales?: boolean }>): EstimateCoverage {
  let measured = 0;
  let estimated = 0;
  let reportedNoSales = 0;
  for (const s of sources) {
    const basis = salesBasis(s.source);
    if (basis === "measured") {
      measured += 1;
      if (s.reportedNoSales) reportedNoSales += 1;
    } else if (basis === "estimated") estimated += 1;
  }
  const total = sources.length;
  const notAvailable = total - measured - estimated;
  const partial = notAvailable > 0;
  const fmt = (x: number) => new Intl.NumberFormat("en-US").format(x);
  const parts = [`${fmt(measured)} of ${fmt(total)} listings measured${reportedNoSales > 0 ? ` (${fmt(reportedNoSales)} with no sales)` : ""}`];
  if (estimated > 0) parts.push(`${fmt(estimated)} estimated`);
  if (notAvailable > 0) parts.push(`${fmt(notAvailable)} Not available*`);
  return {
    total,
    measured,
    estimated,
    notAvailable,
    reportedNoSales,
    partial,
    tooltip: partial ? `Based on ${fmt(measured + estimated)} of ${fmt(total)} listings (${fmt(measured)} measured, ${fmt(estimated)} estimated)` : null,
    sentence: parts.join(", "),
  };
}

export function emptySalesSplit(): SalesSourceSplit {
  return {
    brand_reported: { listings: 0, annualSales: 0 },
    smartscout: { listings: 0, annualSales: 0 },
    keepa_monthly_sold: { listings: 0, annualSales: 0 },
    sales_rank_curve: { listings: 0, annualSales: 0 },
    none: { listings: 0, annualSales: 0 },
  };
}

export type CatalogSalesCoverage = {
  /** Listings with annual sales before decision 112: brand-reported or SmartScout only. */
  before: EstimateCoverage;
  /** With Keepa and rank-curve estimates added. */
  after: EstimateCoverage;
  /** Listings and annual sales (mid) by source. */
  salesSources: SalesSourceSplit;
  /** Annual sales across the catalog: measured only, then measured plus estimated. */
  measuredAnnualSales: number;
  annualSales: EstimateRange;
};

/** Catalog-wide coverage of annual sales, before and after the Keepa and rank-curve estimates. */
export function catalogSalesCoverage(listings: EstimateListingInput[], ctx: SalesContext = {}): CatalogSalesCoverage {
  const split = emptySalesSplit();
  const annualSales: EstimateRange = { low: 0, mid: 0, high: 0 };
  let measuredAnnualSales = 0;
  const after: Array<{ source: SalesSource; reportedNoSales: boolean }> = [];
  const before: Array<{ source: SalesSource; reportedNoSales: boolean }> = [];
  for (const l of listings) {
    const r = resolveListingSales(l, ctx);
    const source = r.annual?.source ?? "none";
    // Measured includes measured, no sales: SmartScout's $0 with nothing else known (decision 113).
    const measured = salesBasis(source) === "measured";
    after.push({ source, reportedNoSales: r.reportedNoSales });
    // Before decision 112's estimates, every listing SmartScout tracks without positive sales is measured, no sales.
    const measuredSales = measured && !r.reportedNoSales;
    const beforeNoSales = !measuredSales && Boolean(l.smartscoutHasRecord);
    before.push({ source: measuredSales ? source : beforeNoSales ? "smartscout" : "none", reportedNoSales: beforeNoSales });
    split[source].listings += 1;
    if (r.annual) {
      split[source].annualSales += r.annual.range.mid;
      annualSales.low += r.annual.range.low;
      annualSales.mid += r.annual.range.mid;
      annualSales.high += r.annual.range.high;
      if (measured) measuredAnnualSales += r.annual.range.mid;
    }
  }
  return { before: buildCoverage(before), after: buildCoverage(after), salesSources: split, measuredAnnualSales, annualSales };
}
