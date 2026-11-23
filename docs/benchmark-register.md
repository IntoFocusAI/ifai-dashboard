# Benchmark register

The one list of every value the dollar estimates use. A test (`scripts/benchmark-register.test.ts`) keeps it equal to `lib/estimates/benchmarks.ts`: add or change a benchmark in code and this table must change with it.

Rule (Brian, 18 Nov 2026): use the most recent credible estimate; document and cite it.

Worker 29.1, 18 Nov 2026. I opened every source in `lib/estimates/benchmarks.ts` and checked the figure we use against the page itself. When a host refused automated readers, I used the published abstract, the authors' institution, or an academic table that reproduces the figure, and I name which one. All four proposed changes were approved by Brian on 18 Nov 2026 and applied (Workers 29.5 and 29.6). Miscategorized lift is now an IntoFocus assumption set by Brian, not a published figure.

## Register

Basis: "Published source" means the range comes from the cited work. "IntoFocus assumption" means IntoFocus chose it; a named owner and date mean Brian set it. Last checked is 18 Nov 2026 for every row (Worker 29.1 read the sources; the test compares the values with the code).

| ID | What it is | Low | Mid | High | Basis | Sources | Verdict | Last checked |
|---|---|---|---|---|---|---|---|---|
| brand_loss_share | Share of missed sales the brand loses | 30% | 40% | 45% | Published source; high set by Brian Magazu, 18 Nov 2026 | [Retail Dive](https://www.retaildive.com/news/online-out-of-stocks-cost-22-billion-in-sales/528878); UNH Today (link dead); Corsten and Gruen, HBR 2004 (via Helm and Hegenbart 2011) | Verified with correction; one source could not be opened | 18 Nov 2026 |
| buy_box_lost_share | Share of sales lost on a day without a Buy Box | 50% | 80% | 95% | IntoFocus assumption (R-06) | [Gleason, Zhang, Wilson, WWW 2026](https://doi.org/10.1145/3774904.3792473); [Feedvisor](https://feedvisor.com/buybox/amazon-buy-box-percentage) | Verified (direction only; the exact share is not published) | 18 Nov 2026 |
| map_volume_kept | Share of units still sold when the price returns to MAP | 50% | 75% | 100% | IntoFocus assumption; high supported by one study | [Israeli, Marketing Science 2018](https://doi.org/10.1287/mksc.2018.1092); [Israeli, Anderson, Coughlan 2016](https://doi.org/10.1287/mksc.2015.0933) | Verified with correction | 18 Nov 2026 |
| splintered_lift | Sales lift from nesting a splintered listing under its parent | 5% | 15% | 30% | IntoFocus assumption | [Spiegel Research Center](https://spiegel.medill.northwestern.edu/How-Online-Reviews-Influence-Sales) | Verified (a ceiling, not Amazon-specific) | 18 Nov 2026 |
| spec_lift_below_70 | Sales lift from completing specs, listing below 70% complete | 5% | 10% | 20% | IntoFocus assumption | [Salsify, Kenshoo, Profitero](https://www.salsify.com/resources/amazon-advertising-content-advantage-report-salsify); [Amazon A+](https://sell.amazon.com/tools/a-content) | Verified (context only; association) | 18 Nov 2026 |
| spec_lift_70_to_84 | Sales lift from completing specs, listing 70% to 84% complete | 3% | 6% | 12% | IntoFocus assumption | Same as above | Verified (context only) | 18 Nov 2026 |
| spec_lift_85_to_99 | Sales lift from completing specs, listing 85% to 99% complete | 1% | 3% | 6% | IntoFocus assumption | Same as above | Verified (context only) | 18 Nov 2026 |
| miscategorized_lift | Sales lift from refiling a miscategorized listing (held until D-12) | 5% | 15% | 25% | IntoFocus assumption, set by Brian Magazu, 18 Nov 2026. No credible published source; to be replaced by IntoFocus before-and-after results | [Acadia, Jun 2025](https://acadia.io/amazon-changed-my-product-category-a-troubleshooting-guide/) (context: one case, no effect) | Verified with correction (does not support the range) | 18 Nov 2026 |
| aplus_lift | Sales lift from adding A+ content | 3% | 5% | 8% | Published source (Amazon; "up to" is a ceiling) | [Amazon A+ Content](https://sell.amazon.com/tools/a-content) | Verified | 18 Nov 2026 |
| content_lift_cap | Most that content fixes together can add to one listing's sales | 30% | 30% | 30% | IntoFocus assumption | None | n/a (no source) | 18 Nov 2026 |
| keepa_monthly_sold_multiplier | Units sold in a month per unit of Amazon's bought-in-past-month figure | 1x | 1.5x | 2x | IntoFocus assumption, proposed; awaiting Brian | IntoFocus calibration, 14 listings with SmartScout units, 17 Nov 2026 | n/a (our own data) | 18 Nov 2026 |
| ai_unbranded_share | Share of sales shaped by an unbranded AI answer | 1.5% | 4% | 10% | IntoFocus assumption (decision 112) | See AI share below | Verified with correction; one source could not be opened | 18 Nov 2026 |
| ai_branded_share | Share of sales shaped by a branded AI answer | 1.5% | 4% | 10% | IntoFocus assumption (decision 112) | See AI share below | Same as above | 18 Nov 2026 |
| ai_recommendation_conversion | Share of added AI recommendations that become purchases | 25% | 50% | 75% | IntoFocus assumption | [Amazon Q3 2025 call via Fortune](https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/); [Adobe via TechCrunch](https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/); [Adobe, Sep 2026](https://smallbiztrends.com/ai-driven-retail-traffic-surges-71-converts-90-better/) | Verified with correction | 18 Nov 2026 |
| ai_relative_gap_cap | Cap on the relative gap to target (no brand is credited with more than doubling its AI-shaped sales) | 100% | 100% | 100% | IntoFocus assumption | None | n/a (no source) | 18 Nov 2026 |
| brand_pages_source_share | Share of AI sources the brand's own pages can hold | 15% | 15% | 15% | IntoFocus assumption (plan target) | [McKinsey](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/new-front-door-to-the-internet-winning-in-the-age-of-ai-search) | Could not open (search summaries agree) | 18 Nov 2026 |
| brand_site_first_year_capture | Share captured in the first year once the official page exists | 25% | 50% | 100% | IntoFocus assumption | [Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) | Verified (shows an effect, does not size it) | 18 Nov 2026 |
| online_sales_share | Share of the brand's sales made online (when the client has not given it) | 6.1% | 17.1% | 30% | Published source for low and mid; high is an IntoFocus assumption | [US Census via FRED](https://fred.stlouisfed.org/series/ECOMPCTSA); [Marketplace Pulse](https://www.marketplacepulse.com/articles/amazon-and-shopify-are-now-half-of-us-e-commerce); eMarketer (could not open) | Verified | 18 Nov 2026 |
| rank_curve_methods | Sales-rank method sources (shape of the rank-to-sales relation) | n/a | n/a | n/a | Published shape; figures are IntoFocus calibration | Chevalier and Goolsbee, QME 2003 ([doi](https://doi.org/10.1023/A:1024634613982)); Brynjolfsson, Hu, Smith, Management Science 2003 | Could not open (abstract only) | 18 Nov 2026 |
| rank_curve:Musical Instruments | Units per 30 in-stock days by sales rank, 7 rank bands (Fender, 653 listings, 17 Nov 2026) | n/a | n/a | n/a | IntoFocus calibration on SmartScout data | IntoFocus calibration | n/a (our own data) | 18 Nov 2026 |
| rank_curve:Tools & Home Improvement and Sports & Outdoors | Units per 30 in-stock days by sales rank, 3 rank bands (Ledlenser, 54 listings, 17 Nov 2026) | n/a | n/a | n/a | IntoFocus calibration on SmartScout data | IntoFocus calibration | n/a (our own data) | 18 Nov 2026 |

**Verdicts (23 published sources):** Verified 11 · Verified with correction 7 · Not supported 0 · Could not open 5. One new source was added (Adobe, September 2026) because the 90% figure was not on the page we cited. Our own calibration (`intofocusCalibration`) is not a web source and is not counted.

In code, 19 sources now read `verified: true`, each with the exact `quote` and a `checked` note. The 5 that could not be opened stay `false`, and their tooltips keep the "not checked" note.

## Verification detail

| Benchmark | Source and URL | Verdict | What the page says | Our value | Proposed | Credibility |
|---|---|---|---|---|---|---|
| Buy Box lost share | Gleason, Zhang, Wilson, WWW 2026. [doi](https://doi.org/10.1145/3774904.3792473) (full text at kgi.georgetown.edu) | Verified | "products immediately fall sharply in search, ad placements completely disappear within 12 hours, and sales ranks are 12% worse after 48 hours." | Direction only | None | High, peer-reviewed; rank, not dollars |
| Buy Box lost share | Feedvisor, "Amazon Buy Box: What Actually Wins the Featured Offer in 2026", M. Incitti, Aug 2022, updated Mar 2026. [link](https://feedvisor.com/buybox/amazon-buy-box-percentage) | Verified | "Roughly 82% of Amazon sales flow through the Buy Box (an industry estimate, not Amazon-confirmed)." No source named. | 80% mid | None | Low to medium |
| Brand-loss share | UNH Today, Corsten and Gruen online study. [link](https://www.unh.edu/unhtoday/node/13244) | Could not open | The link now redirects to the UNH Today home page. Retail Dive (next row) has the same figures. | 30 / 40 / 55% | See change 1 (applied) | n/a |
| Brand-loss share | Retail Dive, "Online out-of-stocks cost $22B in sales", D. Howland. [link](https://www.retaildive.com/news/online-out-of-stocks-cost-22-billion-in-sales/528878) | Verified with correction | "15% ... switched sites ... 60% bought a substitute from the same online merchant. Of that 60%, half switched brands ... About 10% went to a retail store ... about 15% said they delayed or canceled." Published **30 Jul 2018**, not Mar 2019. | 30 / 40 / 55% | 30 / 40 / **45%** (applied) | High |
| Brand-loss share | Corsten and Gruen, HBR May 2004; Gruen, Corsten, Bharadwaj, GMA 2002 | Verified | HBR is for subscribers only. Helm and Hegenbart (Univ. Regensburg WP 458, 2011, Table 1) reproduce the 2002 split: same-brand substitute 19%, **brand switch 26%**, store switch 31%, delay 15%, **do not buy 9%**. | 26% switch, 9% no buy | None | High |
| MAP volume kept | Israeli, "Online MAP Enforcement: Evidence from a Quasi-Experiment", Marketing Science 37(5), 2018. Now cites the [DOI](https://doi.org/10.1287/mksc.2018.1092) (Harvard DASH refused us) | Verified with correction | "With improved compliance, channel prices increase by 2% without loss in volume." Title and URL updated to the published version. | High 100% | None | Medium to high; one manufacturer |
| MAP volume kept | Israeli, Anderson, Coughlan, Marketing Science 35(4), 2016. [doi](https://doi.org/10.1287/mksc.2015.0933) | Verified | "violations of MAP are common in practice." | Context | None | High |
| A+ lift; spec lift | Amazon, A+ Content. [link](https://sell.amazon.com/tools/a-content) | Verified | "Basic A+ Content can increase sales by up to 8% ... Premium A+ Content can increase sales by up to 20%." Footnote: "Amazon internal data". | 3 / 5 / 8% | None | Medium; a ceiling |
| Splintered lift | Spiegel Research Center, Northwestern. [link](https://spiegel.medill.northwestern.edu/How-Online-Reviews-Influence-Sales) | Verified | "The purchase likelihood for a product with five reviews is 270% greater than ... a product with no reviews." Page dated 4 Dec 2025; first published 2017. | 5 / 15 / 30% | None | High; not Amazon-specific |
| Spec lift | Salsify, Kenshoo, Profitero, "The Content Advantage in Amazon Advertising". [link](https://www.salsify.com/resources/amazon-advertising-content-advantage-report-salsify) | Verified | "A-rated" content "drove 21 times more conversion than poor content." The page shows no date (Dec 2020 is not confirmed). | Context | None | Low; vendor, association |
| Miscategorized lift (held) | Acadia, "Amazon Changed My Product Category", E. Peterson, 19 Jun 2025. [link](https://acadia.io/amazon-changed-my-product-category-a-troubleshooting-guide/) | Verified with correction | The one case cost $16K in fees, but "the category change didn't seem to have any discernible impact on sales". It supports a lift of zero, not 5% to 30%. | 5 / 15 / 30% | 5 / 15 / **25%** (Brian's assumption, applied) | Low; one case |
| AI share; AI conversion | Amazon Q3 2025 call (Jassy), via [Fortune](https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/) and the Motley Fool transcript | Verified | "Rufus is on track to deliver over $10 billion in incremental annualized sales" and users are "60% more likely to complete a purchase." The proposal's "nearly $12B" is from Q4 2025 materials and was seen only in press coverage. | Context | None | Medium; Amazon's own attribution |
| AI share | Marketplace Pulse, "Amazon GMV Surpassed $800 Billion in 2025", 6 Feb 2026. [link](https://www.marketplacepulse.com/articles/amazon-gmv-surpassed-800-billion-in-2025) | Verified with correction | "Amazon and its sellers sold $830 billion worth of goods in 2025." This is **worldwide**. The US is just over 53%. | $830B | None | Medium |
| AI share (high) | Salesforce, "Holiday Season Rakes in Record $1.29T for Retailers". [link](https://www.salesforce.com/news/stories/2025-holiday-shopping-data/) | Verified with correction | "driving 20% of all retail sales and fueling $262 billion". $262B is 20% of **$1.29T global online** sales. It counts retailers' own recommendations and service agents. Published **8 Jan 2026**, not 6 Jan. | 20% high | None | Medium; broad |
| AI share; brand pages | McKinsey, "New front door to the internet". [link](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/new-front-door-to-the-internet-winning-in-the-age-of-ai-search) | Could not open | Refused us on mckinsey.com and mckinsey.com.br. Search summaries agree on "half" use AI search, brand sites "5 to 10 percent" of sources, and $750B by 2028. | 15% target | None | Medium |
| AI share | PYMNTS, "From Prompt to Purchase", Oct 2026. [link](https://www.pymnts.com/report/study/from-prompt-to-purchase-who-wins-the-ai-shopper/) | Verified | "Nearly 61 million U.S. consumers, or 23%, now name AI as their main starting point when researching retail purchases online." n = 2,191, Aug 2026. | Context | None | Medium; survey |
| AI conversion | Adobe via TechCrunch, 16 Apr 2026. [link](https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/) | Verified with correction | 393% up in Q1 2026; converted **42%** better in March 2026. The **90%** is not on this page. It is in Adobe's September data ([Small Business Trends, 1 Nov 2026](https://smallbiztrends.com/ai-driven-retail-traffic-surges-71-converts-90-better/), added as `adobeSep2026`). | 42% to 90% | None | Medium to high |
| AI share (low) | Kaiser and Schulze, Marketing Science. [doi](https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489) | Verified with correction | The journal refused us. The Frankfurt School release (22 Jun 2026) says "less than 0.2 per cent of total traffic", 973 stores, Aug 2024 to Jul 2025. This is **ChatGPT only**, not all assistants. | Context | None | High; last click |
| Brand-site capture | Google Search Central, "Intro to How Structured Data Markup Works". [link](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) | Verified | Rotten Tomatoes: "25% higher click-through rate". Nestlé: rich results "82% higher click through rate". The old URL redirects here. | Context | None | Medium; two cases |
| Online share | US Census via FRED. [link](https://fred.stlouisfed.org/series/ECOMPCTSA) | Verified | "E-commerce sales in the second quarter of 2026 accounted for 17.1 percent of total sales." | 17.1% mid | None | High |
| Online share (low) | eMarketer, marketplaces FAQ. [link](https://www.emarketer.com/content/faq-on-ecommerce-marketplaces--shift-amazon-only-multi-marketplace) | Could not open | Refused us. 39.7% matches eMarketer's forecast for **2021**. Its 2025 forecast is 40.5%. Marketplace Pulse measured **35.7%** for 2025 ([link](https://www.marketplacepulse.com/articles/amazon-and-shopify-are-now-half-of-us-e-commerce), verified). | 6.8% low | **6.1%** | Medium |
| Rank curve | Chevalier and Goolsbee, QME 2003. [doi](https://doi.org/10.1023/A:1024634613982) | Could not open | The abstract confirms sales ranks are used "to derive quantity proxies". The power form is in the full text, which is for subscribers only. | Shape only | None | High for shape |
| Rank curve | Brynjolfsson, Hu, Smith, Management Science 2003 | Could not open | The abstract does not mention the rank relation, and the full text is for subscribers only. | Shape only | None | High for shape |

## AI share (lines 8 and 9)

Today: 8% of sales are shaped by an AI answer (4% unbranded + 4% branded), with a range of 2% to 20% (decision 112).

### Candidates, most credible first

| # | Source | Kind | What it says | Implies for us |
|---|---|---|---|---|
| 1 | Amazon Q3 2025 call (verified) | Earnings disclosure | Rufus: over $10B in incremental yearly sales; 250M users | $10B / $830B = **1.2% of Amazon sales**, added by Amazon's own assistant alone (incremental, not just shaped) |
| 2 | Kaiser and Schulze, Marketing Science (verified via release) | Peer-reviewed, 973 stores | ChatGPT clicks under 0.2% of store visits; more in complex categories | Last-click floor. Instruments and premium lights are complex purchases, so they lean above average |
| 3 | Similarweb, State of Ecommerce 2026 ([link](https://www.similarweb.com/corp/reports/state-of-ecommerce-2026/), verified) | Panel | "Gen AI sends just 0.4% of retail ecommerce visits today", up 203% in a year | With Adobe's 42% to 90% conversion premium, about **0.6% to 0.8% of online sales** arrive on an AI click |
| 4 | Adobe Analytics (verified) | Panel, 1T+ US visits | AI visits convert 42% (Mar) to 90% (Sep 2026) better | Multiplier only, no share |
| 5 | eMarketer forecast (summary only, paywalled) | Forecast | AI platforms about 1.5% of US e-commerce in 2026 ($20.6B), later cut to $19.7B | About **1.5%** of online sales bought through AI platforms |
| 6 | Morgan Stanley AlphaWise, Dec 2025 ([Digital Commerce 360](https://www.digitalcommerce360.com/2025/12/09/morgan-stanley-ai-agentic-shoppers-385-billion-online-sales/), verified) | Survey and forecast | "Nearly 23% of Americans made at least one AI-assisted purchase in the past month"; 10% to 20% of US e-commerce by 2030 | Supports mid and high |
| 7 | Bain, Apr 2026, n = 1,500 ([link](https://www.bain.com/insights/your-next-customer-will-find-you-using-ai-now-what/), verified) | Survey | "44% of online buyers ... mostly start their journey in an LLM or split their search" | Supports mid |
| 8 | PYMNTS, Oct 2026 (verified) | Survey | 23% name AI as their main starting point | Supports mid |
| 9 | Salesforce, Jan 2026 (verified) | Platform data, broad | 20% of global online holiday sales, counting on-site AI | Ceiling |
| 10 | McKinsey, Oct 2025 (not opened) | Survey | About half use AI search for buying decisions | Ceiling, unverified |

**Branded or unbranded split.** BrightEdge, Apr 2026, auto category ([link](https://help.brightedge.com/resources/weekly-ai-search-insights/ai-auto-purchase-journey-branded-vs-non-branded-prompts), verified): branded prompts are 30% to 66% of AI prompt volume across funnel stage and platform, averaging about 51%. That supports the 50/50 split. It is one vendor and one category.

**By category.** I found no credible share for musical instruments or outdoor and lighting. Morgan Stanley finds grocery and household goods lead. Kaiser and Schulze find higher ChatGPT shares for complex products.

### Recommendation

**Total 3% / 8% / 20%, split evenly: 1.5% / 4% / 10% per line.** Only the low changes, from 1% to 1.5% per line.

- **Low 3%.** Amazon's own assistant adds 1.2% of Amazon sales by itself (earnings disclosure). Sales bought through outside AI platforms add about 1.5% of online sales (eMarketer). "Shaped by" is wider than both, so 3% is still a floor.
- **Mid 8%, unchanged.** About 23% of shoppers start with AI (PYMNTS) or bought with AI in the past month (Morgan Stanley). If AI shapes about a third of their considered purchases, that is about 8%. Bain's 44% leaves headroom.
- **High 20%, unchanged.** Salesforce's broad 20% and Morgan Stanley's 10% to 20% by 2030.
- **Split 50/50, unchanged**, now with the BrightEdge evidence above.

## Changes (all approved by Brian, 18 Nov 2026, applied)

1. `BRAND_LOSS_SHARE` high from 55% to **45%**. The 55% counted the 10% who went to a store for the item they wanted, and those shoppers still buy the brand. The loss is 30% who switched brand plus up to 15% who delayed or canceled. The in-store figure (26% + 9% = 35%) sits inside the range. Low 30% and mid 40% stay.
2. `ONLINE_SALES_SHARE` low from 6.8% to **6.1%** (35.7% x 17.1%). The source changes from eMarketer, which could not be opened and whose 39.7% is a 2021 forecast, to Marketplace Pulse's measured 2025 share (verified).
3. `MISCATEGORIZED_LIFT` is now **5% / 15% / 25%** (high from 30%). It is an IntoFocus assumption owned by Brian, set 18 Nov 2026. No study measures it, and the one case found (Acadia) showed no effect; it stays listed as context. To be replaced by IntoFocus before-and-after results. The line is held until D-12, so nothing on screen moves.
4. `AI_UNBRANDED_SHARE` and `AI_BRANDED_SHARE` low from 1% to **1.5%** each (total 2% to 3%). Mid and high stay. Similarweb, Bain, Morgan Stanley and BrightEdge are now in their sources (BrightEdge, and the Marketplace Pulse share article in change 2, are `verified: false` because this doc records no quote from those pages).

## Text fixes for the proposal (docs/dollar-estimates-proposal.md)

- Line 8: "nearly $12B ... (Amazon Q3 2025 earnings call)" should read "over $10B (Q3 2025 call), about 1.2% of $830B". "Nearly $12B" is from Q4 2025 materials and was seen only in press coverage.
- Line 8: "Similarweb and Contentsquare, about 1%" should read "Similarweb 0.4% of retail e-commerce visits".
- Salesforce: 8 Jan 2026, 20% of **global online** holiday sales, including on-site AI.
- Adobe: 42% (March 2026, TechCrunch) to 90% (September 2026, Small Business Trends).
- Corsten and Gruen online: Retail Dive published it on 30 Jul 2018. "Reported Mar 2019" is the UNH date, which could not be confirmed. It stays in code because the trail's as-of date and its test read it.
- Section 8's note "this session could not open the pages" can now point to this file.
