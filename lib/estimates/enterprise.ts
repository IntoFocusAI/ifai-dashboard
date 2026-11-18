// C: Enterprise Potential (proposal section 5, decision 112), the listing-fix part.
//
// Means: the same work across everything the brand sells, not only the listings we monitor.
// Formula: (Phase 1 share of the Amazon sales we price x the brand's annual sales x the share of
// those sales made online) + (AI rate x the brand's annual sales x (1 minus the retailer share of AI
// sources)). The AI rate is lines 8 and 9 as a share of the sales they are priced on. The brand's
// annual sales come from its settings record: the client's own figure from onboarding, or (approved)
// a public revenue figure as a labeled stand-in.
//
// When the AI read fails or has not loaded, the figure is the listing-fix part only, and the trail says so.

import { AI_BRANDED_SHARE, AI_RECOMMENDATION_CONVERSION, AI_UNBRANDED_SHARE, ONLINE_SALES_SHARE } from "./benchmarks";
import { add, uniqueSources, ZERO } from "./line";
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

/** The AI part's inputs: lines 8 and 9 as shares of brand sales, and the retailer share of AI sources. */
export type EnterpriseAiPart = {
  rates: { unbranded: EstimateRange | null; branded: EstimateRange | null };
  retailerShare: number | null;
};

export const ENTERPRISE_AI_MISSING_NOTE = "The AI Search part of Enterprise Potential joins when the AI Search estimates are built. This figure is the listing-fix part.";

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
  ai: EnterpriseAiPart | null = null,
): EstimateResult {
  const pricedSales = catalog.annualSales.mid;
  const ready = Boolean(revenue && revenue.annual_sales_usd > 0 && phase1.range && pricedSales > 0);
  const rate: EstimateRange | null = ready
    ? { low: phase1.range!.low / pricedSales, mid: phase1.range!.mid / pricedSales, high: phase1.range!.high / pricedSales }
    : null;
  const listingPart: EstimateRange | null =
    rate && revenue
      ? {
          low: Math.round(rate.low * revenue.annual_sales_usd * ONLINE_SALES_SHARE.low),
          mid: Math.round(rate.mid * revenue.annual_sales_usd * ONLINE_SALES_SHARE.mid),
          high: Math.round(rate.high * revenue.annual_sales_usd * ONLINE_SALES_SHARE.high),
        }
      : null;
  // The AI part (lines 8 and 9) on all-channel sales, less the retailer share (overlap rule 7).
  const aiRate = ai && ai.retailerShare != null && (ai.rates.unbranded || ai.rates.branded) ? add(ai.rates.unbranded ?? ZERO, ai.rates.branded ?? ZERO) : null;
  const keep = ai?.retailerShare != null ? 1 - Math.min(1, Math.max(0, ai.retailerShare)) : 0;
  const aiPart: EstimateRange | null =
    listingPart && aiRate && revenue
      ? {
          low: Math.round(aiRate.low * revenue.annual_sales_usd * keep),
          mid: Math.round(aiRate.mid * revenue.annual_sales_usd * keep),
          high: Math.round(aiRate.high * revenue.annual_sales_usd * keep),
        }
      : null;
  const range: EstimateRange | null = listingPart ? (aiPart ? add(listingPart, aiPart) : listingPart) : null;
  // The split by sales source, scaled from Phase 1's so its parts add to this figure (decision 112).
  // The AI part rests on the same sales split, so the whole figure is scaled.
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
  const pct2 = (x: number) => `${Math.round(x * 10000) / 100}%`;

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
      means: aiPart
        ? "Added sales in a year from the same listing work across everything the brand sells online, plus the AI Search gaps across all of the brand's sales, not only the listings we monitor."
        : "Added sales in a year from the same listing work across everything the brand sells online, not only the listings we monitor.",
      formula: aiPart
        ? "(Phase 1 as a share of the Amazon sales we price x the brand's annual sales x the share of those sales made online) + (the AI Search gaps as a share of brand sales x the brand's annual sales x (1 minus the retailer share of AI sources)). The low figure uses the lows and the high figure the highs."
        : "Phase 1 as a share of the Amazon sales we price x the brand's annual sales x the share of those sales made online. The low figure uses the lows and the high figure the highs.",
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
        ...(aiPart && aiRate
          ? [
              { key: "listing_part", label: "Listing-fix part", value: listingPart!.mid, unit: "usd" as const, kind: "derived" as const, source: "phase_1 scaled", asOf: dataAsOf },
              {
                key: "ai_rate",
                label: "AI Search gaps as a share of brand sales (Unbranded Discovery plus Branded Consideration)",
                value: `${pct2(aiRate.low)} low, ${pct2(aiRate.mid)} mid, ${pct2(aiRate.high)} high`,
                unit: "text" as const,
                kind: "derived" as const,
                source: "ai_unbranded + ai_branded",
                asOf: dataAsOf,
              },
              { key: "retailer_share", label: "Retailer share of AI sources", value: pct(ai!.retailerShare!), unit: "text" as const, kind: "collected" as const, source: "canvas_ai_citations, rival-led Unbranded Discovery answers", asOf: dataAsOf },
              { key: "ai_part", label: "AI Search part", value: aiPart.mid, unit: "usd" as const, kind: "derived" as const, source: "ai_rate x brand sales x (1 - retailer share)", asOf: dataAsOf },
            ]
          : []),
      ],
      coverage: catalog.after,
      salesSources,
      benchmarks: aiPart ? [ONLINE_SALES_SHARE, AI_UNBRANDED_SHARE, AI_BRANDED_SHARE, AI_RECOMMENDATION_CONVERSION] : [ONLINE_SALES_SHARE],
      sources: uniqueSources(aiPart ? [ONLINE_SALES_SHARE, AI_UNBRANDED_SHARE, AI_BRANDED_SHARE, AI_RECOMMENDATION_CONVERSION] : [ONLINE_SALES_SHARE], revenueSource),
      confidence: "low",
      confidenceReason:
        (placeholder
          ? "The brand's sales are a public figure standing in for the client's own, and the listing-fix share is assumed to hold beyond the listings we monitor."
          : "The listing-fix share is assumed to hold beyond the listings we monitor.") +
        (aiPart ? " The AI part rests on the share of shopping an AI answer shapes, the widest range in the estimates." : ""),
      mostImprovedBy: "The brand's own sales by channel (onboarding questions 1 and 2).",
      notes: [
        ...(placeholder ? [`${ENTERPRISE_PLACEHOLDER_LABEL}: ${revenue!.scope}. We measure US Amazon listings.`] : []),
        ...(aiPart ? ["The AI Search part removes the retailer share of AI sources, because listing fixes already carry it."] : [ENTERPRISE_AI_MISSING_NOTE]),
        "Never added to Phase 1: Phase 1 is part of it.",
      ],
      listings: [],
    },
  };
}
