// C: Enterprise Potential (proposal section 5, decision 112), the listing-fix part.
//
// Means: the same listing work across everything the brand sells, not only the listings we monitor.
// Formula: Phase 1 share of the Amazon sales we price x the brand's annual sales x the share of
// those sales made online. The brand's annual sales come from its settings record: the client's own
// figure from onboarding, or (approved this round) a public revenue figure as a labeled stand-in.
//
// The AI Search part of the proposal's formula (lines 8 and 9) joins when those lines are built
// (chunk E5). Until then the figure is the listing-fix part only, and the trail says so.

import { ONLINE_SALES_SHARE } from "./benchmarks";
import { uniqueSources } from "./line";
import type { CatalogSalesCoverage } from "./sales-coverage";
import type { BenchmarkSource, EstimateRange, EstimateResult, SalesSource, SalesSourceSplit } from "./types";

/** The brand's annual sales, from the settings record (revenue_inputs). */
export type BrandRevenueInput = {
  annual_sales_usd: number;
  /** public_placeholder: a public figure standing in until the client gives its own. client: given at onboarding. */
  basis: "public_placeholder" | "client";
  source_title: string;
  source_url: string | null;
  source_date: string;
  /** What the figure covers, in a few words: "Global, all channels". */
  scope: string;
};

export const ENTERPRISE_PLACEHOLDER_LABEL = "Public revenue figure, a placeholder until the client gives its own";

/**
 * Enterprise Potential from Phase 1 and the brand's revenue. Reads Not available* (status
 * not_available) when the client has no revenue input or Phase 1 has no figure.
 */
export function estimateEnterprise(
  phase1: EstimateResult,
  catalog: CatalogSalesCoverage,
  revenue: BrandRevenueInput | null,
  dataAsOf: string | null = null,
): EstimateResult {
  const pricedSales = catalog.annualSales.mid;
  const ready = Boolean(revenue && revenue.annual_sales_usd > 0 && phase1.range && pricedSales > 0);
  const rate: EstimateRange | null = ready
    ? { low: phase1.range!.low / pricedSales, mid: phase1.range!.mid / pricedSales, high: phase1.range!.high / pricedSales }
    : null;
  const range: EstimateRange | null =
    rate && revenue
      ? {
          low: Math.round(rate.low * revenue.annual_sales_usd * ONLINE_SALES_SHARE.low),
          mid: Math.round(rate.mid * revenue.annual_sales_usd * ONLINE_SALES_SHARE.mid),
          high: Math.round(rate.high * revenue.annual_sales_usd * ONLINE_SALES_SHARE.high),
        }
      : null;
  // The split by sales source, scaled from Phase 1's so its parts add to this figure (decision 112).
  const scaleUp = range && phase1.range && phase1.range.mid > 0 ? range.mid / phase1.range.mid : null;
  const salesSources = Object.fromEntries(
    (Object.keys(phase1.trail.salesSources) as SalesSource[]).map((key) => {
      const { estimate, ...rest } = phase1.trail.salesSources[key];
      return [key, scaleUp != null && estimate != null ? { ...rest, estimate: estimate * scaleUp } : rest];
    }),
  ) as SalesSourceSplit;
  const placeholder = revenue?.basis === "public_placeholder";
  const revenueSource: BenchmarkSource[] = revenue
    ? [
        {
          id: "brand_revenue",
          title: revenue.source_title,
          url: revenue.source_url,
          date: revenue.source_date,
          usedFor: placeholder ? ENTERPRISE_PLACEHOLDER_LABEL : "The brand's annual sales, given at onboarding",
          credibility: placeholder ? `Low for this use: ${revenue.scope}.` : revenue.scope,
          verified: false,
        },
      ]
    : [];
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

  return {
    lineId: "enterprise_potential",
    status: range ? "estimated" : "not_available",
    range,
    label: "analyst estimate",
    asterisk: Boolean(range) && (phase1.asterisk || placeholder),
    countsInTotal: false,
    trail: {
      lineId: "enterprise_potential",
      title: "Enterprise Potential",
      means: "Added sales in a year from the same listing work across everything the brand sells online, not only the listings we monitor.",
      formula:
        "Phase 1 as a share of the Amazon sales we price x the brand's annual sales x the share of those sales made online. The low figure uses the lows and the high figure the highs.",
      inputs: [
        { key: "phase_1", label: "Near-term upside (Phase 1)", value: phase1.range ? phase1.range.mid : null, unit: "usd", kind: "derived", source: "phase_1", asOf: dataAsOf },
        { key: "priced_sales", label: "Amazon sales, measured plus estimated", value: Math.round(pricedSales), unit: "usd", kind: "derived", source: "sales coverage", asOf: dataAsOf },
        {
          key: "listing_fix_rate",
          label: "Phase 1 share of those sales",
          value: rate ? `${pct(rate.low)} low, ${pct(rate.mid)} mid, ${pct(rate.high)} high` : null,
          unit: "text",
          kind: "derived",
          source: "phase_1 / priced sales",
          asOf: dataAsOf,
        },
        {
          key: "brand_revenue",
          label: placeholder ? ENTERPRISE_PLACEHOLDER_LABEL : "The brand's annual sales",
          value: revenue ? revenue.annual_sales_usd : null,
          unit: "usd",
          kind: placeholder ? "benchmark" : "client",
          source: "brand_revenue",
          asOf: revenue?.source_date ?? null,
        },
        {
          key: "online_share",
          label: ONLINE_SALES_SHARE.label,
          value: `${pct(ONLINE_SALES_SHARE.low)} low, ${pct(ONLINE_SALES_SHARE.mid)} mid, ${pct(ONLINE_SALES_SHARE.high)} high`,
          unit: "text",
          kind: "benchmark",
          source: ONLINE_SALES_SHARE.id,
          asOf: ONLINE_SALES_SHARE.sources[0]?.date ?? null,
        },
      ],
      coverage: catalog.after,
      salesSources,
      benchmarks: [ONLINE_SALES_SHARE],
      sources: uniqueSources([ONLINE_SALES_SHARE], revenueSource),
      confidence: "low",
      confidenceReason: placeholder
        ? "The brand's sales are a public figure standing in for the client's own, and the listing-fix share is assumed to hold beyond the listings we monitor."
        : "The listing-fix share is assumed to hold beyond the listings we monitor.",
      mostImprovedBy: "The brand's own sales by channel (onboarding questions 1 and 2).",
      notes: [
        ...(placeholder ? [`${ENTERPRISE_PLACEHOLDER_LABEL}: ${revenue!.scope}. We measure US Amazon listings.`] : []),
        "The AI Search part of Enterprise Potential joins when the AI Search estimates are built. This figure is the listing-fix part.",
        "Never added to Phase 1: Phase 1 is part of it.",
      ],
      listings: [],
    },
  };
}
