// Every benchmark behind a dollar estimate: its low, mid and high, where it comes from, and how far
// to trust it. Approved by Brian Magazu with docs/dollar-estimates-proposal.md (decision 111).
//
// Sources were found by web search on 17 Nov 2026. Worker 29.1 opened each page on 18 Nov 2026
// (docs/benchmark-register.md). A source is verified: true only where the quote was read on the
// page or a faithful reproduction of it; `quote` holds those words and `checked` says how. Sources
// still verified: false could not be opened. Do not put a quote on screen from an unverified source.
// Rule (Brian, 18 Nov 2026): use the most recent credible estimate; document and cite it.
// Changes 1 to 4 of docs/benchmark-register.md were approved on 18 Nov 2026 and applied below.

import type { RankCurve } from "./rank-curve";
import type { Benchmark, BenchmarkSource } from "./types";

type Check = { verified: boolean; checked: string; quote?: string };

const CHECKED = "18 Nov 2026";

function source(id: string, title: string, url: string | null, date: string, usedFor: string, credibility: string, check?: Check): BenchmarkSource {
  return { id, title, url, date, usedFor, credibility, verified: false, ...check };
}

export const SOURCES = {
  gleason2026: source(
    "gleason2026",
    'Gleason, Zhang, Wilson, "Determinants and Effects of Buy Box Suppression on Amazon", Proceedings of the ACM Web Conference 2026',
    "https://doi.org/10.1145/3774904.3792473",
    "Apr 2026",
    "Buy Box: a suppressed product falls in search, loses its ads within 12 hours, and ranks 12% worse after 48 hours",
    "High, peer-reviewed; measures rank, not dollars",
    {
      verified: true,
      checked: `${CHECKED}, full text at kgi.georgetown.edu (the DOI page blocks automated readers)`,
      quote:
        "Suppression has substantial impacts on sellers: products immediately fall sharply in search, ad placements completely disappear within 12 hours, and sales ranks are 12% worse after 48 hours.",
    },
  ),
  feedvisorBuyBox: source(
    "feedvisorBuyBox",
    'Feedvisor (Marissa Incitti), "Amazon Buy Box: What Actually Wins the Featured Offer in 2026"',
    "https://feedvisor.com/buybox/amazon-buy-box-percentage",
    "Aug 2022, updated Mar 2026",
    "About 82% of Amazon sales go through the Buy Box",
    "Low to medium; an industry estimate Amazon has not confirmed, with no source named",
    {
      verified: true,
      checked: CHECKED,
      quote: "Roughly 82% of Amazon sales flow through the Buy Box (an industry estimate, not Amazon-confirmed).",
    },
  ),
  corstenGruenOnlineUnh: source(
    "corstenGruenOnlineUnh",
    "Corsten and Gruen, online availability study (GMA), reported by the University of New Hampshire",
    "https://www.unh.edu/unhtoday/node/13244",
    "2018, reported Mar 2019",
    "Brand-loss share: 15% switched sites, 60% bought a substitute from the same merchant, half of them another brand",
    "High; read through press coverage",
    {
      verified: false,
      checked: `${CHECKED}: the link now redirects to the UNH Today home page. The same figures are confirmed in Retail Dive (corstenGruenOnlineRetailDive).`,
    },
  ),
  corstenGruenOnlineRetailDive: source(
    "corstenGruenOnlineRetailDive",
    'Retail Dive (Daphne Howland), "Online out-of-stocks cost $22B in sales", on the Corsten and Gruen online availability study (GMA)',
    "https://www.retaildive.com/news/online-out-of-stocks-cost-22-billion-in-sales/528878",
    "Jul 2018",
    "Brand-loss share online: 15% switched sites, 60% bought a substitute from the same merchant (half of them another brand), about 10% went to a store, about 15% delayed or canceled",
    "High; press coverage of a large study",
    {
      verified: true,
      checked: `${CHECKED}. Published 30 Jul 2018, not Mar 2019.`,
      quote:
        "In the U.S., 15% of consumers encountering an out-of-stock online switched sites to buy the item, while 60% bought a substitute from the same online merchant. Of that 60%, half switched brands and half found a substitute from the same brand. About 10% went to a retail store to find what they wanted, and about 15% said they delayed or canceled their purchases.",
    },
  ),
  corstenGruenInStore: source(
    "corstenGruenInStore",
    'Corsten and Gruen, "Stock-Outs Cause Walkouts", Harvard Business Review; Gruen, Corsten, Bharadwaj, "Retail Out-of-Stocks" (GMA, FMI, CIES)',
    null,
    "May 2004; 2002",
    "Brand-loss share in store: 26% switch brand, 9% do not buy",
    "High; the split is confirmed in an academic table that reproduces the 2002 report",
    {
      verified: true,
      checked: `${CHECKED}, through Helm and Hegenbart, University of Regensburg working paper 458 (2011), Table 1 (epub.uni-regensburg.de/21309). The HBR article is for subscribers only.`,
      quote: "Gruen/Corsten/Bharadwaj 2002 (Meta-Analysis): article switch 19.0%, brand switch 26.0%, store switch 31.0%, postponement 15.0%, cancellation 9.0%",
    },
  ),
  israeli2018: source(
    "israeli2018",
    'Israeli, "Online MAP Enforcement: Evidence from a Quasi-Experiment", Marketing Science 37(5) (Harvard Business School working paper, Jan 2018)',
    "https://doi.org/10.1287/mksc.2018.1092",
    "2018",
    "MAP: better enforcement raised channel prices 2% with no loss in volume",
    "Medium to high; one manufacturer",
    {
      verified: true,
      checked: `${CHECKED}, published abstract on EconPapers (the Harvard DASH copy refused automated readers)`,
      quote: "With improved compliance, channel prices increase by 2% without loss in volume.",
    },
  ),
  israeliAndersonCoughlan2016: source(
    "israeliAndersonCoughlan2016",
    'Israeli, Anderson, Coughlan, "Minimum Advertised Pricing: Patterns of Violation in Competitive Retail Markets", Marketing Science 35(4)',
    "https://doi.org/10.1287/mksc.2015.0933",
    "2016",
    "MAP violations are common",
    "High",
    {
      verified: true,
      checked: `${CHECKED}, published abstract on EconPapers`,
      quote: "Although manufacturers expect retail partners to comply with MAP policies, violations of MAP are common in practice.",
    },
  ),
  amazonAplus: source(
    "amazonAplus",
    "Amazon, A+ Content",
    "https://sell.amazon.com/tools/a-content",
    "Read Nov 2026",
    "Basic A+ content can raise sales by up to 8%, Premium A+ by up to 20%",
    "Medium; Amazon's own data, a ceiling",
    {
      verified: true,
      checked: `${CHECKED}. Footnote: "Amazon internal data".`,
      quote: "Basic A+ Content can increase sales by up to 8% ... and well-implemented Premium A+ Content can increase sales by up to 20%.",
    },
  ),
  spiegel2017: source(
    "spiegel2017",
    'Spiegel Research Center, Northwestern, "How Online Reviews Influence Sales"',
    "https://spiegel.medill.northwestern.edu/How-Online-Reviews-Influence-Sales",
    "2017",
    "A product with five reviews is 270% more likely to be bought than one with none",
    "High; not Amazon-specific",
    {
      verified: true,
      checked: `${CHECKED}. The page is dated 4 Dec 2025 and says the findings were first published in 2017.`,
      quote: "The purchase likelihood for a product with five reviews is 270% greater than the purchase likelihood of a product with no reviews.",
    },
  ),
  salsify2020: source(
    "salsify2020",
    'Salsify, Kenshoo, Profitero, "The Content Advantage in Amazon Advertising"',
    "https://www.salsify.com/resources/amazon-advertising-content-advantage-report-salsify",
    "Dec 2020",
    "Amazon content that meets best-practice thresholds converts 21 times better than poor content",
    "Low; vendor study, association only",
    {
      verified: true,
      checked: `${CHECKED}. The page shows no publication date; Dec 2020 is not confirmed.`,
      quote: "product content on Amazon that meets certain best practice thresholds (termed \"A-rated\" content) drove 21 times more conversion than poor content.",
    },
  ),
  acadiaCategory: source(
    "acadiaCategory",
    'Acadia (Emily Peterson), "Amazon Changed My Product Category: A Troubleshooting Guide"',
    "https://acadia.io/amazon-changed-my-product-category-a-troubleshooting-guide/",
    "Jun 2025",
    "Miscategorization, one case: $16K in extra Amazon fees and no visible effect on sales",
    "Low; one case, no study exists",
    {
      verified: true,
      checked: `${CHECKED}. Published 19 Jun 2025. The one case shows no sales effect, so it supports the low end only.`,
      quote: "for this particular client, the category change didn't seem to have any discernible impact on sales or share-of-voice performance",
    },
  ),
  amazonQ3Call: source(
    "amazonQ3Call",
    "Amazon Q3 2025 earnings call (Andy Jassy), via Fortune",
    "https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/",
    "30 Oct 2025",
    "Amazon's assistant adds over $10B a year; its users are 60% more likely to buy",
    "Medium; Amazon's internal estimate",
    {
      verified: true,
      checked: `${CHECKED}, Fortune (2 Nov 2025) and the Motley Fool call transcript. The "nearly $12B" for 2025 is from Q4 2025 materials and was seen only in press coverage.`,
      quote:
        "Rufus is on track to deliver over $10 billion in incremental annualized sales. ... customers using Rufus during a shopping trip being 60% more likely to complete a purchase.",
    },
  ),
  marketplacePulseGmv: source(
    "marketplacePulseGmv",
    'Marketplace Pulse, "Amazon GMV Surpassed $800 Billion in 2025"',
    "https://www.marketplacepulse.com/articles/amazon-gmv-surpassed-800-billion-in-2025",
    "Feb 2026",
    "$830B sold on Amazon worldwide in 2025, just over half of it in the US",
    "Medium; estimate from Amazon disclosures",
    {
      verified: true,
      checked: `${CHECKED}. Published 6 Feb 2026. The figure is worldwide.`,
      quote: "Amazon and its sellers sold $830 billion worth of goods in 2025.",
    },
  ),
  salesforceHoliday: source(
    "salesforceHoliday",
    'Salesforce, "Holiday Season Rakes in Record $1.29T for Retailers, Salesforce Data Shows"',
    "https://www.salesforce.com/news/stories/2025-holiday-shopping-data/",
    "8 Jan 2026",
    "AI and agents drove 20% of global online holiday sales ($262B of $1.29T), including retailers' own recommendations and service agents",
    "Medium; broad definition, global online sales",
    {
      verified: true,
      checked: `${CHECKED}. Published 8 Jan 2026, not 6 Jan. $262B is 20% of $1.29T global online sales.`,
      quote:
        "AI and agents powered a massive portion of the holidays, driving 20% of all retail sales and fueling $262 billion in revenue through personalized recommendations and deeper customer engagement.",
    },
  ),
  mckinseyAiSearch: source(
    "mckinseyAiSearch",
    'McKinsey, "New front door to the internet: Winning in the age of AI search"',
    "https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/new-front-door-to-the-internet-winning-in-the-age-of-ai-search",
    "Oct 2025",
    "Half of consumers use AI search; brand sites are 5% to 10% of what AI search cites",
    "Medium",
    { verified: false, checked: `${CHECKED}: the page refused automated readers on mckinsey.com and mckinsey.com.br. Figures match search summaries only.` },
  ),
  pymnts2026: source(
    "pymnts2026",
    'PYMNTS, "From Prompt to Purchase: Who Wins the AI Shopper?"',
    "https://www.pymnts.com/report/study/from-prompt-to-purchase-who-wins-the-ai-shopper/",
    "Oct 2026",
    "23% of US consumers name AI as their main starting point when researching retail purchases online",
    "Medium; survey of 2,191 US consumers, Aug 2026",
    {
      verified: true,
      checked: CHECKED,
      quote: "Nearly 61 million U.S. consumers, or 23%, now name AI as their main starting point when researching retail purchases online.",
    },
  ),
  adobeAiTraffic: source(
    "adobeAiTraffic",
    'Adobe Analytics, via TechCrunch, "AI traffic to US retailers rose 393% in Q1, and it is boosting their revenue too"',
    "https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/",
    "16 Apr 2026",
    "AI-referred traffic to US retail sites up 393% in a year to Q1 2026; it converted 42% better than other traffic in March 2026",
    "Medium to high; over 1 trillion visits",
    {
      verified: true,
      checked: `${CHECKED}. This page supports 42% only; the 90% is in adobeSep2026.`,
      quote: "in the first three months of 2026, AI traffic had risen 393% compared to a year earlier.",
    },
  ),
  adobeSep2026: source(
    "adobeSep2026",
    'Adobe Analytics, via Small Business Trends, "AI-Driven Retail Traffic Surges 71%, Converts 90% Better"',
    "https://smallbiztrends.com/ai-driven-retail-traffic-surges-71-converts-90-better/",
    "1 Nov 2026",
    "AI-referred traffic to US retail sites converted 90% better than other traffic in September 2026",
    "Medium to high for the data; read through press coverage (Adobe's own post did not open)",
    { verified: true, checked: CHECKED, quote: "AI-referred traffic converted 90% better than non-AI traffic in September." },
  ),
  kaiserSchulze: source(
    "kaiserSchulze",
    'Kaiser and Schulze, "ChatGPT Referrals to E-Commerce Websites: How Do LLMs Compare Against Traditional Channels?", Marketing Science',
    "https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489",
    "2026, data Aug 2024 to Jul 2025",
    "Clicks from ChatGPT are under 0.2% of visits to 973 online stores",
    "High; last click only, ChatGPT only",
    {
      verified: true,
      checked: `${CHECKED}, through the Frankfurt School press release of 22 Jun 2026 (the journal page refused automated readers)`,
      quote: "less than 0.2 per cent of total traffic",
    },
  ),
  googleStructuredData: source(
    "googleStructuredData",
    'Google Search Central, "Intro to How Structured Data Markup Works"',
    "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
    "Read Nov 2026",
    "Pages with structured data earn 25% to 82% higher click-through",
    "Medium; two case studies",
    {
      verified: true,
      checked: `${CHECKED}. The old link redirects here. 25% is structured data against none; 82% is rich results against none.`,
      quote:
        "Rotten Tomatoes added structured data to 100,000 unique pages and measured a 25% higher click-through rate ... Nestlé has measured pages that show as rich results in search have an 82% higher click through rate",
    },
  ),
  censusEcommerce: source(
    "censusEcommerce",
    "US Census via FRED, e-commerce share of retail",
    "https://fred.stlouisfed.org/series/ECOMPCTSA",
    "Q2 2026",
    "E-commerce is 17.1% of US retail",
    "High",
    { verified: true, checked: `${CHECKED}, FRED and census.gov/retail/ecommerce.html`, quote: "E-commerce sales in the second quarter of 2026 accounted for 17.1 percent of total sales." },
  ),
  emarketerAmazonShare: source(
    "emarketerAmazonShare",
    "eMarketer, FAQ on ecommerce marketplaces",
    "https://www.emarketer.com/content/faq-on-ecommerce-marketplaces--shift-amazon-only-multi-marketplace",
    "2026",
    "Amazon is 39.7% of US e-commerce",
    "Medium to high",
    {
      verified: false,
      checked: `${CHECKED}: the page refused automated readers. 39.7% matches eMarketer's forecast for 2021; its 2025 forecast is 40.5%, and Marketplace Pulse estimates 35.7% for 2025.`,
    },
  ),
  marketplacePulseShare: source(
    "marketplacePulseShare",
    'Marketplace Pulse, "Amazon and Shopify Are Now Half of US E-Commerce"',
    "https://www.marketplacepulse.com/articles/amazon-and-shopify-are-now-half-of-us-e-commerce",
    "2026",
    "Amazon is a measured 35.7% of US e-commerce in 2025",
    "Medium; Marketplace Pulse estimate for 2025, more recent than eMarketer's 2021 forecast",
    { verified: false, checked: `${CHECKED}: the verification doc records the figure (35.7%) but not a quote from the page, so it is not marked verified here.` },
  ),
  similarweb2026: source(
    "similarweb2026",
    "Similarweb, State of Ecommerce 2026",
    "https://www.similarweb.com/corp/reports/state-of-ecommerce-2026/",
    "2026",
    "Gen AI sends 0.4% of retail e-commerce visits, up 203% in a year",
    "Medium; panel data",
    { verified: true, checked: CHECKED, quote: "Gen AI sends just 0.4% of retail ecommerce visits today" },
  ),
  morganStanley2025: source(
    "morganStanley2025",
    "Morgan Stanley AlphaWise (Dec 2025), via Digital Commerce 360",
    "https://www.digitalcommerce360.com/2025/12/09/morgan-stanley-ai-agentic-shoppers-385-billion-online-sales/",
    "Dec 2025",
    "Nearly 23% of Americans made an AI-assisted purchase in the past month; AI is forecast at 10% to 20% of US e-commerce by 2030",
    "Medium; survey and forecast",
    { verified: true, checked: CHECKED, quote: "Nearly 23% of Americans made at least one AI-assisted purchase in the past month" },
  ),
  bain2026: source(
    "bain2026",
    'Bain, "Your next customer will find you using AI. Now what?"',
    "https://www.bain.com/insights/your-next-customer-will-find-you-using-ai-now-what/",
    "Apr 2026",
    "44% of online buyers mostly start in an LLM or split their search (n = 1,500)",
    "Medium; survey",
    { verified: true, checked: CHECKED, quote: "44% of online buyers ... mostly start their journey in an LLM or split their search" },
  ),
  brightEdgeBranded: source(
    "brightEdgeBranded",
    "BrightEdge, AI auto purchase journey: branded vs non-branded prompts",
    "https://help.brightedge.com/resources/weekly-ai-search-insights/ai-auto-purchase-journey-branded-vs-non-branded-prompts",
    "Apr 2026",
    "Branded prompts are 30% to 66% of AI prompt volume, about 51% on average, supporting the 50/50 branded split",
    "Low to medium; one vendor, one category (auto)",
    { verified: false, checked: `${CHECKED}: the verification doc records the finding but not a quote from the page, so it is not marked verified here.` },
  ),
  chevalierGoolsbee2003: source(
    "chevalierGoolsbee2003",
    'Chevalier and Goolsbee, "Measuring Prices and Price Competition Online: Amazon.com and BarnesandNoble.com", Quantitative Marketing and Economics 1(2)',
    "https://doi.org/10.1023/A:1024634613982",
    "2003",
    "Units sold fall as a power of Amazon sales rank (books)",
    "High for the shape of the relation; books, old, and no figures for our categories",
    {
      verified: false,
      checked: `${CHECKED}: the abstract confirms sales ranks are used as a quantity proxy; the power form is in the full text, which is for subscribers only.`,
    },
  ),
  brynjolfssonHuSmith2003: source(
    "brynjolfssonHuSmith2003",
    'Brynjolfsson, Hu, Smith, "Consumer Surplus in the Digital Economy: Estimating the Value of Increased Product Variety at Online Booksellers", Management Science 49(11)',
    null,
    "2003",
    "Units sold fall as a power of Amazon sales rank (books)",
    "High for the shape of the relation; books, old, and no figures for our categories",
    { verified: false, checked: `${CHECKED}: the abstract does not state the rank relation; the full text is for subscribers only.` },
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
  high: 0.45,
  basis: "published",
  credibility:
    "Good. Online: 15% of shoppers switched sites and 60% bought a substitute from the same merchant, half of them another brand, so 30% switched brand (low). High, 45%, adds up to 15% who delayed or canceled. Shoppers who buy the same item in a store still buy the brand, so they are not counted. In store: 26% switch brand and 9% do not buy. Large samples, known authors; general retail, not this category.",
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
  high: 0.25,
  basis: "approved_assumption",
  credibility: "IntoFocus assumption set by Brian Magazu, 18 Nov 2026. No study measures it; the one case found showed no effect. To be replaced by IntoFocus before-and-after results.",
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

const AI_SHARE_SOURCES = [SOURCES.kaiserSchulze, SOURCES.amazonQ3Call, SOURCES.marketplacePulseGmv, SOURCES.salesforceHoliday, SOURCES.pymnts2026, SOURCES.mckinseyAiSearch, SOURCES.adobeAiTraffic, SOURCES.similarweb2026, SOURCES.bain2026, SOURCES.morganStanley2025, SOURCES.brightEdgeBranded];
const AI_SHARE_CREDIBILITY =
  "The widest range in the estimates. Low sits at measured clicks from AI assistants (under 1% of store visits), high at broad influence (20% of holiday sales). Half of the AI-shaped share is assigned to unbranded questions and half to branded; that split is an IntoFocus assumption.";

/** Share of brand sales shaped by an AI answer to a question that names no brand. */
export const AI_UNBRANDED_SHARE: Benchmark = { id: "ai_unbranded_share", label: "Share of sales shaped by an unbranded AI answer", unit: "share", low: 0.015, mid: 0.04, high: 0.1, basis: "approved_assumption", credibility: AI_SHARE_CREDIBILITY, sources: AI_SHARE_SOURCES };

/** Share of brand sales shaped by an AI answer to a question that names or compares the brand. */
export const AI_BRANDED_SHARE: Benchmark = { id: "ai_branded_share", label: "Share of sales shaped by a branded AI answer", unit: "share", low: 0.015, mid: 0.04, high: 0.1, basis: "approved_assumption", credibility: AI_SHARE_CREDIBILITY, sources: AI_SHARE_SOURCES };

/** Share of added AI recommendations that become purchases. */
export const AI_RECOMMENDATION_CONVERSION: Benchmark = {
  id: "ai_recommendation_conversion",
  label: "Share of added AI recommendations that become purchases",
  unit: "share",
  low: 0.25,
  mid: 0.5,
  high: 0.75,
  basis: "approved_assumption",
  credibility:
    "IntoFocus assumption. Amazon says shoppers who use its assistant are 60% more likely to complete a purchase; Adobe reports AI-referred visits converting 42% better (March 2026) to 90% better (September 2026).",
  sources: [SOURCES.amazonQ3Call, SOURCES.adobeAiTraffic, SOURCES.adobeSep2026],
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
  low: 0.061,
  mid: 0.171,
  high: 0.3,
  basis: "published",
  credibility: "Low is Amazon only (35.7% of the 17.1% of US retail sold online, Marketplace Pulse 2025). Mid is all e-commerce, 17.1%. High, 30%, is an IntoFocus assumption.",
  sources: [SOURCES.censusEcommerce, SOURCES.marketplacePulseShare, SOURCES.emarketerAmazonShare],
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
