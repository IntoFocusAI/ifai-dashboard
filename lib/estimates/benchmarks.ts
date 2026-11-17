// Every benchmark behind a dollar estimate: its low, mid and high, where it comes from, and how far
// to trust it. Approved by Brian Magazu with docs/dollar-estimates-proposal.md (decision 111).
//
// Sources were found by web search on 17 Nov 2026 and read through search summaries, not the pages
// themselves. Each is marked verified: false until someone checks the quote against its page. Do
// not put a quote on screen from an unverified source.

import type { RankCurve } from "./rank-curve";
import type { Benchmark, BenchmarkSource } from "./types";

function source(id: string, title: string, url: string | null, date: string, usedFor: string, credibility: string): BenchmarkSource {
  return { id, title, url, date, usedFor, credibility, verified: false };
}

export const SOURCES = {
  gleason2026: source(
    "gleason2026",
    'Gleason, Zhang, Wilson, "Determinants and Effects of Buy Box Suppression on Amazon", ACM Web Conference',
    "https://doi.org/10.1145/3774904.3792473",
    "Apr 2026",
    "Buy Box: a suppressed product falls in search, loses its ads within 12 hours, and ranks 12% worse after 48 hours",
    "High, peer-reviewed; measures rank, not dollars",
  ),
  feedvisorBuyBox: source(
    "feedvisorBuyBox",
    "Feedvisor, Amazon Buy Box percentage",
    "https://feedvisor.com/buybox/amazon-buy-box-percentage",
    "2026",
    "About 82% of Amazon sales go through the Buy Box",
    "Low to medium; an industry estimate Amazon has not confirmed",
  ),
  corstenGruenOnlineUnh: source(
    "corstenGruenOnlineUnh",
    "Corsten and Gruen, online availability study (GMA), reported by the University of New Hampshire",
    "https://www.unh.edu/unhtoday/node/13244",
    "2018, reported Mar 2019",
    "Brand-loss share: 15% switched sites, 60% bought a substitute from the same merchant, half of them another brand",
    "High; read through press coverage",
  ),
  corstenGruenOnlineRetailDive: source(
    "corstenGruenOnlineRetailDive",
    "Corsten and Gruen, online availability study (GMA), reported by Retail Dive",
    "https://www.retaildive.com/news/online-out-of-stocks-cost-22-billion-in-sales/528878",
    "2018, reported Mar 2019",
    "Brand-loss share, online out-of-stocks",
    "High; read through press coverage",
  ),
  corstenGruenInStore: source(
    "corstenGruenInStore",
    'Corsten and Gruen, "Stock-Outs Cause Walkouts", Harvard Business Review; Gruen, Corsten, Bharadwaj, "Retail Out-of-Stocks" (GMA, FMI, CIES)',
    null,
    "May 2004; 2002",
    "Brand-loss share in store: 26% switch brand, 9% do not buy",
    "High; the split by response was not confirmed against the report",
  ),
  israeli2018: source(
    "israeli2018",
    'Israeli, "Online MAP Enforcement", Harvard Business School working paper',
    "https://dash.harvard.edu/bitstream/handle/1/41274004/israeli_online-map-enforcement.pdf",
    "Jan 2018",
    "MAP: better enforcement raised channel prices 2% with no loss in volume",
    "Medium to high; one manufacturer",
  ),
  israeliAndersonCoughlan2016: source(
    "israeliAndersonCoughlan2016",
    'Israeli, Anderson, Coughlan, "Minimum Advertised Pricing: Patterns of Violation in Competitive Retail Markets", Marketing Science 35(4)',
    null,
    "2016",
    "MAP violations are common",
    "High",
  ),
  amazonAplus: source(
    "amazonAplus",
    "Amazon, A+ Content",
    "https://sell.amazon.com/tools/a-content",
    "Read Nov 2026",
    "Basic A+ content can raise sales by up to 8%, Premium A+ by up to 20%",
    "Medium; Amazon's own data, a ceiling",
  ),
  spiegel2017: source(
    "spiegel2017",
    'Spiegel Research Center, Northwestern, "How Online Reviews Influence Sales"',
    "https://spiegel.medill.northwestern.edu/How-Online-Reviews-Influence-Sales",
    "2017",
    "A product with five reviews is 270% more likely to be bought than one with none",
    "High; not Amazon-specific",
  ),
  salsify2020: source(
    "salsify2020",
    'Salsify, Kenshoo, Profitero, "The Content Advantage in Amazon Advertising"',
    "https://www.salsify.com/resources/amazon-advertising-content-advantage-report-salsify",
    "Dec 2020",
    "Top-rated Amazon content converts far better than poor content",
    "Low; vendor study, association only",
  ),
  acadiaCategory: source(
    "acadiaCategory",
    "Acadia, Amazon category change guide",
    "https://acadia.io/amazon-changed-my-product-category-a-troubleshooting-guide/",
    "Read Nov 2026",
    "Miscategorization, one case",
    "Low; no study exists",
  ),
  amazonQ3Call: source(
    "amazonQ3Call",
    "Amazon Q3 2025 earnings call, via Fortune",
    "https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/",
    "30 Oct 2025",
    "Amazon's assistant adds over $10B a year; its users are 60% more likely to buy",
    "Medium; Amazon's internal estimate",
  ),
  marketplacePulseGmv: source(
    "marketplacePulseGmv",
    "Marketplace Pulse, Amazon GMV",
    "https://www.marketplacepulse.com/articles/amazon-gmv-surpassed-800-billion-in-2025",
    "2026",
    "$830B sold on Amazon in 2025",
    "Medium; estimate",
  ),
  salesforceHoliday: source(
    "salesforceHoliday",
    "Salesforce, 2025 holiday shopping data",
    "https://www.salesforce.com/news/stories/2025-holiday-shopping-data/",
    "6 Jan 2026",
    "AI and agents influenced 20% of global holiday retail sales",
    "Medium; broad definition",
  ),
  mckinseyAiSearch: source(
    "mckinseyAiSearch",
    'McKinsey, "New front door to the internet"',
    "https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/new-front-door-to-the-internet-winning-in-the-age-of-ai-search",
    "Oct 2025",
    "Half of consumers use AI search; brand sites are 5% to 10% of what AI search cites",
    "Medium",
  ),
  pymnts2026: source(
    "pymnts2026",
    'PYMNTS, "From Prompt to Purchase"',
    "https://www.pymnts.com/report/study/from-prompt-to-purchase-who-wins-the-ai-shopper/",
    "Oct 2026",
    "23% of US consumers start purchase research with AI",
    "Medium; survey",
  ),
  adobeAiTraffic: source(
    "adobeAiTraffic",
    "Adobe Analytics, via TechCrunch",
    "https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/",
    "Apr to Sep 2026",
    "AI-referred traffic up 393% in a year; those visits convert 42% to 90% better",
    "Medium to high; over 1 trillion visits",
  ),
  kaiserSchulze: source(
    "kaiserSchulze",
    'Kaiser and Schulze, "ChatGPT Referrals to E-Commerce Websites", Marketing Science',
    "https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489",
    "2025",
    "Clicks from AI assistants are under 0.2% of visits to online stores",
    "High; last click only",
  ),
  googleStructuredData: source(
    "googleStructuredData",
    "Google Search Central, structured data",
    "https://developers.google.com/structured-data/",
    "Read Nov 2026",
    "Pages with structured data earn 25% to 82% higher click-through",
    "Medium; case studies",
  ),
  censusEcommerce: source(
    "censusEcommerce",
    "US Census via FRED, e-commerce share of retail",
    "https://fred.stlouisfed.org/series/ECOMPCTSA",
    "Q2 2026",
    "E-commerce is 17.1% of US retail",
    "High",
  ),
  emarketerAmazonShare: source(
    "emarketerAmazonShare",
    "eMarketer, FAQ on ecommerce marketplaces",
    "https://www.emarketer.com/content/faq-on-ecommerce-marketplaces--shift-amazon-only-multi-marketplace",
    "2026",
    "Amazon is 39.7% of US e-commerce",
    "Medium to high",
  ),
  chevalierGoolsbee2003: source(
    "chevalierGoolsbee2003",
    'Chevalier and Goolsbee, "Measuring Prices and Price Competition Online: Amazon.com and BarnesandNoble.com", Quantitative Marketing and Economics 1(2)',
    null,
    "2003",
    "Units sold fall as a power of Amazon sales rank (books)",
    "High for the shape of the relation; books, old, and no figures for our categories",
  ),
  brynjolfssonHuSmith2003: source(
    "brynjolfssonHuSmith2003",
    'Brynjolfsson, Hu, Smith, "Consumer Surplus in the Digital Economy: Estimating the Value of Increased Product Variety at Online Booksellers", Management Science 49(11)',
    null,
    "2003",
    "Units sold fall as a power of Amazon sales rank (books)",
    "High for the shape of the relation; books, old, and no figures for our categories",
  ),
  intofocusCalibration: {
    id: "intofocusCalibration",
    title: "IntoFocus calibration: SmartScout sales against Keepa sales rank and Amazon's bought-in-past-month figure, on the listings we monitor",
    url: null,
    date: "17 Nov 2026",
    usedFor: "Sales of listings SmartScout does not track",
    credibility: "Medium for Fender's category (653 tracked listings); low for Ledlenser's (54 tracked listings across more than one Amazon category)",
    // Our own read of the dashboard's views, reproduced by scripts/estimates-sales-coverage.test.ts.
    verified: false,
  } as BenchmarkSource,
} as const;

// ---------------------------------------------------------------------------------------------
// Lines 1 and 2: availability
// ---------------------------------------------------------------------------------------------

/** Of sales missed on a listing, the share the brand loses (the shopper switches brand or does not buy). */
export const BRAND_LOSS_SHARE: Benchmark = {
  id: "brand_loss_share",
  label: "Share of missed sales the brand loses",
  unit: "share",
  low: 0.3,
  mid: 0.4,
  high: 0.55,
  basis: "published",
  credibility:
    "Good. Online: 15% of shoppers switched sites and 60% bought a substitute from the same merchant, half of them another brand, so 30% switched brand (low) and at most 55% did not end up with the brand's product (high). In store: 26% switch brand and 9% do not buy. Large samples, known authors; general retail, not this category.",
  sources: [SOURCES.corstenGruenOnlineUnh, SOURCES.corstenGruenOnlineRetailDive, SOURCES.corstenGruenInStore],
};

/** Share of a listing's sales lost on a day with stock and no Buy Box. The 80% is the R-06 assumption. */
export const BUY_BOX_LOST_SHARE: Benchmark = {
  id: "buy_box_lost_share",
  label: "Share of sales lost on a day without a Buy Box",
  unit: "share",
  low: 0.5,
  mid: 0.8,
  high: 0.95,
  basis: "approved_assumption",
  credibility:
    "The direction is well supported by a peer-reviewed study. The exact share is not published by anyone independent: industry estimates put 80% to 82% of Amazon sales through the Buy Box, which is why the range is wide.",
  sources: [SOURCES.gleason2026, SOURCES.feedvisorBuyBox],
};

// ---------------------------------------------------------------------------------------------
// Line 3: MAP
// ---------------------------------------------------------------------------------------------

/** Share of unit volume kept when the price returns to MAP. */
export const MAP_VOLUME_KEPT: Benchmark = {
  id: "map_volume_kept",
  label: "Share of units still sold when the price returns to MAP",
  unit: "share",
  low: 0.5,
  mid: 0.75,
  high: 1,
  basis: "approved_assumption",
  credibility:
    "The high end is supported: better MAP enforcement raised channel prices 2% with no loss in volume at one manufacturer. Low and mid are IntoFocus assumptions.",
  sources: [SOURCES.israeli2018, SOURCES.israeliAndersonCoughlan2016],
};

// ---------------------------------------------------------------------------------------------
// Lines 4 to 7: content lifts
// ---------------------------------------------------------------------------------------------

/** Lift in a splintered bundle's sales once it is nested under the official parent. */
export const SPLINTERED_LIFT: Benchmark = {
  id: "splintered_lift",
  label: "Sales lift from nesting a splintered listing under its parent",
  unit: "share",
  low: 0.05,
  mid: 0.15,
  high: 0.3,
  basis: "approved_assumption",
  credibility:
    "IntoFocus assumption. A product with five reviews is 270% more likely to be bought than one with none; that ceiling applies to a listing with no reviews, so the lift is set well below it.",
  sources: [SOURCES.spiegel2017],
};

const SPEC_CREDIBILITY =
  "IntoFocus assumption. Published evidence is thin: one vendor-run study shows better content converting better, association only. The scale is anchored to Amazon's own figure for A+ content (up to 8%).";

/** Lift from filling required Amazon fields, by how complete the listing is today. */
export const SPEC_LIFT_BANDS: Array<{ id: string; label: string; minPct: number; maxPct: number; benchmark: Benchmark }> = [
  {
    id: "below_70",
    label: "Below 70% complete",
    minPct: 0,
    maxPct: 70,
    benchmark: { id: "spec_lift_below_70", label: "Sales lift from completing specs, listing below 70% complete", unit: "share", low: 0.05, mid: 0.1, high: 0.2, basis: "approved_assumption", credibility: SPEC_CREDIBILITY, sources: [SOURCES.salsify2020, SOURCES.amazonAplus] },
  },
  {
    id: "70_to_84",
    label: "70% to 84% complete",
    minPct: 70,
    maxPct: 85,
    benchmark: { id: "spec_lift_70_to_84", label: "Sales lift from completing specs, listing 70% to 84% complete", unit: "share", low: 0.03, mid: 0.06, high: 0.12, basis: "approved_assumption", credibility: SPEC_CREDIBILITY, sources: [SOURCES.salsify2020, SOURCES.amazonAplus] },
  },
  {
    id: "85_to_99",
    label: "85% to 99% complete",
    minPct: 85,
    maxPct: 100,
    benchmark: { id: "spec_lift_85_to_99", label: "Sales lift from completing specs, listing 85% to 99% complete", unit: "share", low: 0.01, mid: 0.03, high: 0.06, basis: "approved_assumption", credibility: SPEC_CREDIBILITY, sources: [SOURCES.salsify2020, SOURCES.amazonAplus] },
  },
];

/** Lift from refiling a miscategorized listing. Held until the D-12 check exists. */
export const MISCATEGORIZED_LIFT: Benchmark = {
  id: "miscategorized_lift",
  label: "Sales lift from refiling a miscategorized listing",
  unit: "share",
  low: 0.05,
  mid: 0.15,
  high: 0.3,
  basis: "approved_assumption",
  credibility: "IntoFocus assumption. No study measures it; reported effects run from none to large.",
  sources: [SOURCES.acadiaCategory],
};

/** Lift from adding A+ content to a listing without it. */
export const APLUS_LIFT: Benchmark = {
  id: "aplus_lift",
  label: "Sales lift from adding A+ content",
  unit: "share",
  low: 0.03,
  mid: 0.05,
  high: 0.08,
  basis: "published",
  credibility: 'Amazon states basic A+ content can raise sales by up to 8%. "Up to" is a ceiling, so 8% is the high.',
  sources: [SOURCES.amazonAplus],
};

/** Overlap rule 3: content lifts on one listing combine and are capped at this share of its sales. */
export const CONTENT_LIFT_CAP: Benchmark = {
  id: "content_lift_cap",
  label: "Most that content fixes together can add to one listing's sales",
  unit: "share",
  low: 0.3,
  mid: 0.3,
  high: 0.3,
  basis: "approved_assumption",
  credibility: "IntoFocus assumption.",
  sources: [],
};

// ---------------------------------------------------------------------------------------------
// Sales coverage (decision 112)
// ---------------------------------------------------------------------------------------------

/**
 * Amazon's "bought in past month" figure is a floor ("50+"). On the 14 listings that have both it
 * and SmartScout's last-30-day units (13 Fender, 1 Ledlenser, 17 Nov 2026), SmartScout's units were
 * 0.8 to 2.4 times the figure, median 1.5.
 */
export const KEEPA_MONTHLY_SOLD_MULTIPLIER: Benchmark = {
  id: "keepa_monthly_sold_multiplier",
  label: "Units sold in a month for each unit in Amazon's bought-in-past-month figure",
  unit: "multiplier",
  low: 1,
  mid: 1.5,
  high: 2,
  basis: "proposed_assumption",
  credibility:
    "Low is Amazon's own floor. Mid and high come from 14 listings with both the figure and SmartScout units: median 1.5 times, 11 of 14 at or under 2 times. Proposed with the sales-coverage rule; awaiting Brian's approval.",
  sources: [SOURCES.intofocusCalibration],
};

/** The published work on sales rank. It gives the shape of the relation, not our figures. */
export const RANK_CURVE_METHOD_SOURCES: BenchmarkSource[] = [SOURCES.chevalierGoolsbee2003, SOURCES.brynjolfssonHuSmith2003, SOURCES.intofocusCalibration];

/**
 * Stored rank curves by Amazon category, from calibrateRankCurve on the listings read 17 Nov 2026.
 * Units per 30 in-stock days. The read layer may pass fresher curves; these are the fallback.
 * The dashboard's views do not expose the category a sales rank is counted in, so each client's
 * catalog is one category here.
 */
export const RANK_CURVES: Record<string, RankCurve> = {
  "Musical Instruments": {
    category: "Musical Instruments",
    calibratedOn: "2026-11-17",
    basis: "653 Fender listings SmartScout tracks, 403 of them with sales",
    listings: 653,
    maxCalibratedRank: 332231,
    bands: [
      { maxRank: 1000, listings: 31, low: 37.2637, mid: 118.3436, high: 199.4234 },
      { maxRank: 8000, listings: 53, low: 10.937, mid: 19.348, high: 27.759 },
      { maxRank: 16000, listings: 34, low: 9.2989, mid: 15.7007, high: 22.1026 },
      { maxRank: 32000, listings: 138, low: 5.1112, mid: 6.5352, high: 7.9591 },
      { maxRank: 64000, listings: 71, low: 1.9339, mid: 3.0045, high: 4.075 },
      { maxRank: 128000, listings: 164, low: 0.8488, mid: 1.0752, high: 1.3016 },
      { maxRank: Number.POSITIVE_INFINITY, listings: 162, low: 0, mid: 0.0206, high: 0.0453 },
    ],
  },
  "Tools & Home Improvement and Sports & Outdoors": {
    category: "Tools & Home Improvement and Sports & Outdoors",
    calibratedOn: "2026-11-17",
    basis: "54 Ledlenser listings SmartScout tracks, 22 of them with sales",
    listings: 54,
    maxCalibratedRank: 2603484,
    bands: [
      { maxRank: 256000, listings: 21, low: 0, mid: 4.9129, high: 13.3612 },
      { maxRank: 512000, listings: 15, low: 0, mid: 2.2524, high: 4.6956 },
      { maxRank: Number.POSITIVE_INFINITY, listings: 18, low: 0, mid: 0.5895, high: 1.3198 },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Lines 8 to 11 and Enterprise Potential (built in chunks E5 and E6; values approved with the proposal)
// ---------------------------------------------------------------------------------------------

const AI_SHARE_SOURCES = [SOURCES.kaiserSchulze, SOURCES.amazonQ3Call, SOURCES.marketplacePulseGmv, SOURCES.salesforceHoliday, SOURCES.pymnts2026, SOURCES.mckinseyAiSearch, SOURCES.adobeAiTraffic];
const AI_SHARE_CREDIBILITY =
  "The widest range in the estimates. Low sits at measured clicks from AI assistants (under 1% of store visits), high at broad influence (20% of holiday sales). Half of the AI-shaped share is assigned to unbranded questions and half to branded; that split is an IntoFocus assumption.";

/** Share of brand sales shaped by an AI answer to a question that names no brand. */
export const AI_UNBRANDED_SHARE: Benchmark = { id: "ai_unbranded_share", label: "Share of sales shaped by an unbranded AI answer", unit: "share", low: 0.01, mid: 0.04, high: 0.1, basis: "approved_assumption", credibility: AI_SHARE_CREDIBILITY, sources: AI_SHARE_SOURCES };

/** Share of brand sales shaped by an AI answer to a question that names or compares the brand. */
export const AI_BRANDED_SHARE: Benchmark = { id: "ai_branded_share", label: "Share of sales shaped by a branded AI answer", unit: "share", low: 0.01, mid: 0.04, high: 0.1, basis: "approved_assumption", credibility: AI_SHARE_CREDIBILITY, sources: AI_SHARE_SOURCES };

/** Share of added AI recommendations that become purchases. */
export const AI_RECOMMENDATION_CONVERSION: Benchmark = {
  id: "ai_recommendation_conversion",
  label: "Share of added AI recommendations that become purchases",
  unit: "share",
  low: 0.25,
  mid: 0.5,
  high: 0.75,
  basis: "approved_assumption",
  credibility: "IntoFocus assumption. Amazon says shoppers who use its assistant are 60% more likely to complete a purchase; Adobe reports AI-referred visits converting 42% to 90% better.",
  sources: [SOURCES.amazonQ3Call, SOURCES.adobeAiTraffic],
};

/** No brand is credited with more than doubling its AI-shaped sales in a year. */
export const AI_RELATIVE_GAP_CAP: Benchmark = { id: "ai_relative_gap_cap", label: "Cap on the relative gap to target", unit: "share", low: 1, mid: 1, high: 1, basis: "approved_assumption", credibility: "IntoFocus assumption.", sources: [] };

/** Share of an AI answer's sources planned for the brand's own pages (Actuation E1 target, SC-03). */
export const BRAND_PAGES_SOURCE_SHARE: Benchmark = {
  id: "brand_pages_source_share",
  label: "Share of AI sources the brand's own pages can hold",
  unit: "share",
  low: 0.15,
  mid: 0.15,
  high: 0.15,
  basis: "approved_assumption",
  credibility: "IntoFocus plan target. Brand sites are 5% to 10% of what AI search cites today.",
  sources: [SOURCES.mckinseyAiSearch],
};

/** Share of brand-site sales of products with no official page that is captured in the first year. */
export const BRAND_SITE_FIRST_YEAR_CAPTURE: Benchmark = {
  id: "brand_site_first_year_capture",
  label: "Share captured in the first year once the official page exists",
  unit: "share",
  low: 0.25,
  mid: 0.5,
  high: 1,
  basis: "approved_assumption",
  credibility: "IntoFocus assumption. Google's case studies support a real effect and do not size it.",
  sources: [SOURCES.googleStructuredData],
};

/** Share of a brand's sales made online, for Enterprise Potential when the client has not given it. */
export const ONLINE_SALES_SHARE: Benchmark = {
  id: "online_sales_share",
  label: "Share of the brand's sales made online",
  unit: "share",
  low: 0.068,
  mid: 0.171,
  high: 0.3,
  basis: "published",
  credibility: "Low is Amazon only (39.7% of the 17.1% of US retail sold online). Mid is all e-commerce, 17.1%. High, 30%, is an IntoFocus assumption.",
  sources: [SOURCES.censusEcommerce, SOURCES.emarketerAmazonShare],
};

/** Every benchmark, for listing and for tests. */
export const ALL_BENCHMARKS: Benchmark[] = [
  BRAND_LOSS_SHARE,
  BUY_BOX_LOST_SHARE,
  MAP_VOLUME_KEPT,
  SPLINTERED_LIFT,
  ...SPEC_LIFT_BANDS.map((b) => b.benchmark),
  MISCATEGORIZED_LIFT,
  APLUS_LIFT,
  CONTENT_LIFT_CAP,
  KEEPA_MONTHLY_SOLD_MULTIPLIER,
  AI_UNBRANDED_SHARE,
  AI_BRANDED_SHARE,
  AI_RECOMMENDATION_CONVERSION,
  AI_RELATIVE_GAP_CAP,
  BRAND_PAGES_SOURCE_SHARE,
  BRAND_SITE_FIRST_YEAR_CAPTURE,
  ONLINE_SALES_SHARE,
];
