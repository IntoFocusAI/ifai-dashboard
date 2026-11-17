import type { BenchmarkSource, EstimateResult, SalesSourceSplit } from "../lib/estimates/types";

/*
 * Two test fixtures for the estimate trail drawer (chunk E2), one High and one Low confidence,
 * in the formula core's shape (lib/estimates/types.ts, worker 28.18). Figures, inputs and
 * sources are copied from the approved proposal (docs/dollar-estimates-proposal.md, lines 1
 * and 8; decision 112), not computed: the formula core is chunk E1. Two things are test values
 * only: the Low fixture's coverage split (62 measured, 120 from sales rank, 32 Not available*)
 * is the PM's example of the decision 112 coverage line, and the sales-source dollars other
 * than Ledlenser's $122,373 SmartScout total are placeholders. Nothing here reaches a client;
 * the route that renders it answers 404 outside the e2e dev server.
 */

function split(partial: Partial<SalesSourceSplit>): SalesSourceSplit {
  const empty = { listings: 0, annualSales: 0 };
  return {
    brand_reported: empty,
    smartscout: empty,
    keepa_monthly_sold: empty,
    sales_rank_curve: empty,
    none: empty,
    ...partial,
  };
}

const CORSTEN_ONLINE: BenchmarkSource = {
  id: "corsten-gruen-online",
  title: "Corsten and Gruen, online availability study (GMA), via Retail Dive",
  url: "https://www.retaildive.com/news/online-out-of-stocks-cost-22-billion-in-sales/528878",
  date: "2018, reported Mar 2019",
  usedFor: "brand-loss share",
  credibility: "high; read through press coverage",
  verified: false,
};

const CORSTEN_STORE: BenchmarkSource = {
  id: "corsten-gruen-store",
  title: "Corsten and Gruen, \"Stock-Outs Cause Walkouts\", Harvard Business Review",
  url: null,
  date: "May 2004",
  usedFor: "brand-loss share, in store",
  credibility: "high",
  verified: false,
};

export const HIGH_CONFIDENCE_RESULT: EstimateResult = {
  lineId: "out_of_stock",
  status: "estimated",
  range: { low: 367_760, mid: 490_347, high: 674_227 },
  label: "analyst estimate",
  asterisk: true,
  countsInTotal: true,
  trail: {
    lineId: "out_of_stock",
    title: "Out of stock",
    means:
      "The brand's Amazon sales lost in a year because listings had no new unit for sale, after shoppers who bought the product elsewhere or bought another of the brand's listings.",
    formula:
      "For each listing, sales per in-stock day times out-of-stock days in the last 12 months times the brand-loss share, summed over the listings.",
    inputs: [
      {
        key: "oos_listings",
        label: "Listings with an out-of-stock day",
        value: 247,
        unit: "count",
        kind: "collected",
        source: "canvas_listing_sales_loss_v2.oos_days_365",
      },
      {
        key: "listing_missed_sales",
        label: "Listing-level missed sales (sales per in-stock day times out-of-stock days)",
        value: 1_225_867,
        unit: "usd",
        kind: "derived",
        source: "canvas_listing_sales_loss_v2.est_lost_revenue_oos_365",
      },
      {
        key: "brand_loss_share",
        label: "Brand-loss share",
        value: 0.4,
        unit: "share",
        kind: "benchmark",
        source: "brand_loss_share",
      },
    ],
    coverage: {
      total: 609,
      measured: 247,
      estimated: 0,
      notAvailable: 362,
      partial: true,
      tooltip: "Based on 247 of 609 listings",
      sentence: "247 of 609 listings measured, 0 estimated, 362 Not available*",
    },
    salesSources: split({
      smartscout: { listings: 247, annualSales: 9_400_000 },
      none: { listings: 362, annualSales: 0 },
    }),
    benchmarks: [
      {
        id: "brand_loss_share",
        label: "Brand-loss share (Corsten and Gruen)",
        unit: "share",
        low: 0.3,
        mid: 0.4,
        high: 0.55,
        basis: "published",
        credibility: "Good. Large samples, known authors. General retail, not guitars or flashlights.",
        sources: [CORSTEN_ONLINE, CORSTEN_STORE],
      },
    ],
    sources: [CORSTEN_ONLINE, CORSTEN_STORE],
    confidence: "high",
    confidenceReason: "Both main inputs are measured per listing.",
    notes: [],
    listings: [],
  },
};

const LOW_SOURCES: BenchmarkSource[] = [
  {
    id: "kaiser-schulze",
    title: "Kaiser and Schulze, \"ChatGPT Referrals to E-Commerce Websites\", Marketing Science",
    url: "https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489",
    date: "2025",
    usedFor: "AI clicks under 0.2% of traffic, the low end",
    credibility: "high; last click only",
    verified: false,
  },
  {
    id: "amazon-q3-2025",
    title: "Amazon Q3 2025 earnings call, via Fortune",
    url: "https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/",
    date: "30 Oct 2025",
    usedFor: "assistant users 60% more likely to buy",
    credibility: "medium; Amazon's internal estimate",
    verified: false,
  },
  {
    id: "salesforce-holiday-2025",
    title: "Salesforce, 2025 holiday data",
    url: "https://www.salesforce.com/news/stories/2025-holiday-shopping-data/",
    date: "6 Jan 2026",
    usedFor: "AI influenced 20% of holiday sales, the high end",
    credibility: "medium; broad definition",
    verified: false,
  },
];

export const LOW_CONFIDENCE_RESULT: EstimateResult = {
  lineId: "ai_unbranded",
  status: "estimated",
  range: { low: 306, mid: 2_447, high: 9_178 },
  label: "analyst estimate",
  asterisk: true,
  countsInTotal: true,
  trail: {
    lineId: "ai_unbranded",
    title: "AI Search: Unbranded Discovery gap",
    means:
      "Added sales in a year if AI assistants named the brand most as often as the target, when the shopper did not name a brand.",
    formula:
      "Brand sales times the share of sales shaped by an unbranded AI answer times the relative gap to target times the share of added recommendations that become purchases.",
    inputs: [
      {
        key: "brand_sales",
        label: "Brand sales on Amazon, last 12 months",
        value: 122_373,
        unit: "usd",
        kind: "collected",
        source: "canvas_listing_sales_loss_v2.smartscout_ttm_revenue",
      },
      {
        key: "current_rate",
        label: "Named most in unbranded answers now (3 of 79)",
        value: 0.038,
        unit: "share",
        kind: "collected",
        source: "canvas_ai_simulations.primary_brand",
      },
      {
        key: "target_rate",
        label: "Target rate: Petzl, the top rival (19 of 79)",
        value: 0.241,
        unit: "share",
        kind: "collected",
        source: "canvas_ai_simulations.primary_brand",
      },
      {
        key: "relative_gap",
        label: "Relative gap to target, capped at doubling",
        value: 1,
        unit: "share",
        kind: "derived",
        source: "current_rate, target_rate",
      },
      {
        key: "ai_shaped_share",
        label: "Share of sales shaped by an unbranded AI answer",
        value: 0.04,
        unit: "share",
        kind: "benchmark",
        source: "ai_shaped_unbranded",
      },
      {
        key: "purchase_share",
        label: "Added recommendations that become purchases",
        value: 0.5,
        unit: "share",
        kind: "assumption",
        source: "ai_purchase_share",
      },
    ],
    coverage: {
      total: 214,
      measured: 62,
      estimated: 120,
      notAvailable: 32,
      partial: true,
      tooltip: "Based on 182 of 214 listings",
      sentence: "62 of 214 listings measured, 120 estimated, 32 Not available*",
    },
    salesSources: split({
      smartscout: { listings: 62, annualSales: 122_373 },
      sales_rank_curve: { listings: 120, annualSales: 48_000 },
      none: { listings: 32, annualSales: 0 },
    }),
    benchmarks: [
      {
        id: "ai_shaped_unbranded",
        label: "AI-shaped share of sales, unbranded half",
        unit: "share",
        low: 0.01,
        mid: 0.04,
        high: 0.1,
        basis: "published",
        credibility: "Measured clicks at the low end, broad influence at the high end.",
        sources: [LOW_SOURCES[0], LOW_SOURCES[1], LOW_SOURCES[2]],
      },
      {
        id: "ai_purchase_share",
        label: "Added recommendations that become purchases",
        unit: "share",
        low: 0.25,
        mid: 0.5,
        high: 0.75,
        basis: "approved_assumption",
        credibility: "IntoFocus assumption, approved by Brian.",
        sources: [LOW_SOURCES[1]],
      },
    ],
    sources: LOW_SOURCES,
    confidence: "low",
    confidenceReason: "The rates are measured; the share of shopping that AI shapes is the widest range in the estimates.",
    notes: ["The gap is 533% before the cap. No brand is credited with more than doubling its AI-shaped sales in a year."],
    listings: [],
  },
};
