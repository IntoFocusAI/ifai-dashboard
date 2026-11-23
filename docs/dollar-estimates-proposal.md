# Dollar estimates: proposal for Brian

Worker 28.17, 17 Nov 2026. Decision 111. **Nothing here is built.** Each formula ships only after Brian Magazu approves it.

Figures were read on 17 Nov 2026 from the same views the live dashboard reads (SmartScout snapshot 16 Nov for Fender, 17 Nov for Ledlenser). Every dollar is an analyst estimate of **sales of the brand's products at retail prices, per year**.

## 1. One-screen summary

| # | Estimate | Fender (mid, range) | Ledlenser (mid, range) | Confidence | Counts in the total |
|---|---|---|---|---|---|
| 1 | Out of stock | $490K ($368K to $674K) | $11.9K ($8.9K to $16.3K) | High | Yes |
| 2 | Buy Box withheld or suppressed | $111K ($52K to $181K) | $945 ($443 to $1,543) | Medium | Yes |
| 3 | MAP leakage (retail value below MAP) | $39K ($26K to $52K) | $35K ($23K to $47K) | Medium | No, shown beside it |
| 4 | Splintered listings | $55K ($18K to $90K) | Not estimated (1 listing, no sales recorded) | Low | Yes |
| 5 | Missing Amazon specs | $328K ($126K to $653K) | $4.2K ($1.6K to $8.3K) | Low | Yes |
| 6 | Miscategorized listings (D-12) | At most $23K until the check exists | Not available* | Low | Not until D-12 is built |
| 7 | Weak or missing A+ content | $66K ($39K to $107K) | $119 ($70 to $193) | Medium | Yes |
| 8 | AI Search: Unbranded Discovery gap | $90K ($11K to $338K) | $2.4K ($306 to $9.2K) | Low | Yes, less the retailer share |
| 9 | AI Search: Branded Consideration | $0, at target (92% against 90%) | $567 ($71 to $2.1K) | Low | Yes, less the retailer share |
| 10 | Brand-site pages (missing official pages) | $13.5K ($1.7K to $51K) | $452 ($57 to $1.7K) | Low | No, a share of 8 and 9 |
| 11 | AI Actuation programs | $39K ($4.9K to $147K) | $1.3K ($157 to $4.7K) | Low | No, a share of 8 and 9 |
| 12 | Roadmap items | Each item carries the dollar of the finding it fixes | Same | As its parent | No, a share of the lines above |
| A | **Near-term upside (Phase 1)**: lines 1, 2, 4, 5, 7 | **$1.05M ($0.60M to $1.71M)** | **$17.1K ($11.0K to $26.4K)** | Medium | |
| B | **Measured total**: Phase 1 plus AI lines | **$1.12M ($0.61M to $1.96M)** | **$19.8K ($11.3K to $36.5K)** | Medium | |
| C | **Enterprise Potential** (needs the client's revenue; see section 5) | About $12M ($2.4M to $37M) on a public $1B placeholder | About $3.4M ($0.7M to $11M) on a public $75M placeholder | Low | |

Three things to know before reading further.

1. **The measured base is small.** These rows use only the Amazon sales we can see: $20.7M a year for Fender (electric guitars, 403 selling listings) and $122K for Ledlenser (24 selling listings; SmartScout has a record for 62 of 214). One number from the client, its total sales, turns rows 8 to 11 and row C from small to large. That is the onboarding questionnaire in section 6.
2. **Today's hand-entered figures do not survive.** Phase 1 was +$680K; the formula gives $1.05M. Enterprise was +$38M to $62M; on a $1B placeholder the formula gives about $12M, with $37M at the top of the range.
3. **Ranges are wide where evidence is thin, and the doc says so.** Lines 1, 2, 3 and 7 rest on measured days, measured prices or a published figure. Lines 4, 5, 6, 8 to 11 rest partly on IntoFocus assumptions.

### What Brian must approve

| # | Decision | Recommendation |
|---|---|---|
| 1 | What a dollar means | Sales of the brand's products at retail prices, per year. Show brand net revenue too once the client gives its share of the retail price. |
| 2 | Out of stock and Buy Box: listing-level or brand-level headline | Brand-level (after shoppers who buy another of the brand's listings or buy it elsewhere). Listing-level sits in the trail. |
| 3 | Buy Box: change R-06 from "last 30 unsuppressed days x 80%" to "sales per in-stock day x days without a Buy Box in the last 12 months x 80%", with a 50% to 95% range | Approve. It uses days we measure, so a short suppression is not priced as a year. |
| 4 | MAP stays outside the brand revenue total | Approve. It is retail value below MAP, and R-09 says it is never lost revenue. |
| 5 | The lift tables for specs, A+, splintered and miscategorized listings (section 3) | Approve as starting assumptions; replace with our own before-and-after results as they accrue. |
| 6 | AI Search assumptions: 8% of sales shaped by an AI answer (4% unbranded, 4% branded), half of added recommendations become purchases, gain capped at doubling | Approve as the mid case. This is the most uncertain input in the doc. |
| 7 | Brand-site pages, Actuation and Roadmap dollars are shares of the AI lines and are never added to them | Approve. |
| 8 | Phase 1 = lines 1, 2, 4, 5, 7 on measured sales, with no further haircut | Approve. Replaces +$680K. |
| 9 | Enterprise Potential formula; reads Not available* until the client gives revenue | Approve. Decide whether a public revenue figure may stand in as a labeled placeholder. |
| 10 | Totals may add listings whose sales come from different sources (brand-reported and SmartScout) | Approve. R-06 says never; without this no client with partial brand data gets a total. The trail shows the split. |
| 11 | Onboarding questionnaire (7 questions, section 6) | Approve. |
| 12 | On screen: mid figure with its range beside it, labeled analyst estimate | Approve. |
| 13 | Cut any line at first ship | Suggest holding line 6 until D-12 exists. Everything else ships with its confidence grade in the trail. |

## 2. How every estimate is built

Every line has the same shape:

**sales touched by the problem x share of those sales the problem costs = annual sales at stake**

- "Sales touched" comes from our data, per listing, or from the client at onboarding.
- "Share" comes from a published study where one exists, and from a stated IntoFocus assumption where none does. Each share has a low, mid and high value. The range on screen is the formula run three times.
- Each figure opens to: the listings counted (N of M), each input with its source and date, the formula in one sentence, and the benchmark with its citation.
- A listing with no sales source is left out and counted as awaiting inputs. It is never $0.

### Inputs we already collect

| Input | View and column |
|---|---|
| Amazon sales per listing, last 12 months | `canvas_listing_sales_loss_v2.smartscout_ttm_revenue` |
| Amazon sales and units per listing, last 30 days | `smartscout_monthly_revenue`, `smartscout_monthly_units` |
| Sales per in-stock day | `baseline_daily_revenue` (SmartScout sales / Keepa in-stock days) |
| Out-of-stock days, days without a Buy Box | `oos_days_365`, `no_buy_box_days_365` (Keepa) |
| Missed sales, out of stock | `est_lost_revenue_oos_365` |
| Buy Box state now | `canvas_retail_listings.featured_offer_state`, `competitive_offer_suppressed` |
| MAP gap on Amazon | `canvas_retail_listings.amz_leakage`, `map_price`, `is_map_violation` |
| Bundle with no parent | `canvas_retail_listings.is_bundle`, `parent_asin` |
| Amazon spec completeness | `canvas_spec_readiness.amazon_completeness_pct`, `amazon_missing_fields` |
| A+ content | `canvas_listing_content.aplus_state` |
| Amazon product type | `canvas_amazon_product_types.product_type` |
| Official page found | `canvas_spec_findability.latest_state` |
| AI answers, who was named most | `canvas_ai_simulations.outcome`, `prompt`, `primary_brand`, `citation_urls` |
| Type of each cited site | `canvas_site_types.site_type` |

SmartScout is a modelled estimate, not the brand's books. The brand's own Amazon sales by listing (onboarding question 4) replace it wherever given, per the R-06 source order.

### The two shares used in several lines

**Brand-loss share: 30% low, 40% mid, 55% high.** When a listing cannot be bought, some shoppers buy another listing of the same brand or buy the same product elsewhere, and the brand keeps that sale. The brand loses the shopper who switches brand or does not buy.
- Corsten and Gruen's study of online out-of-stocks (GMA, 2018; reported by the University of New Hampshire and Retail Dive, March 2019): of US shoppers who met an online out-of-stock, 15% switched sites to buy the item and 60% bought a substitute from the same merchant, half of them another brand. So 30% switched brand (our low), and at most 55% did not end up with the brand's product from someone (our high).
- Their in-store study (Gruen, Corsten and Bharadwaj, 2002; Harvard Business Review, May 2004; 71,000 shoppers, 29 countries) is widely cited as 26% switch brand and 9% do not buy, 35% in all.
- Credibility: good. Large samples, known authors. It is general retail, not guitars or flashlights.

**Sales lost while a listing has no Buy Box: 50% low, 80% mid, 95% high.** The 80% is the assumption Brian approved for R-06.
- Industry estimates put 80% to 82% of Amazon sales through the Buy Box (Feedvisor calls it an industry estimate that Amazon has not confirmed); one academic paper cites 98%.
- Gleason, Zhang and Wilson, "Determinants and Effects of Buy Box Suppression on Amazon" (ACM Web Conference, April 2026; 17,754 products tracked hourly for eight weeks): a suppressed product falls sharply in search, its ads disappear within 12 hours, and its sales rank is 12% worse after 48 hours.
- Credibility: the direction is well supported by a peer-reviewed study. The exact share of sales lost is not published by anyone independent, which is why the range is wide.

## 3. Each estimate

### 1. Out of stock

**Means:** the brand's Amazon sales lost in a year because listings had no new unit for sale. If the pattern of the last 12 months holds, this is next year's figure too.

**Formula:** for each listing, sales per in-stock day x out-of-stock days in the last 12 months (this is today's R-17 figure) x brand-loss share. Sum the listings.

| Input | Source |
|---|---|
| Sales per in-stock day | Collected: `baseline_daily_revenue` |
| Out-of-stock days | Collected: `oos_days_365` |
| Brand-loss share 30 / 40 / 55% | Benchmark: Corsten and Gruen |

| | Listing-level missed sales | Low | Mid | High |
|---|---|---|---|---|
| Fender, 247 of 609 listings with an out-of-stock day | $1,225,867 | $367,760 | $490,347 | $674,227 |
| Ledlenser, 21 of 166 | $29,665 | $8,899 | $11,866 | $16,316 |

**Confidence: High.** Both main inputs are measured per listing. **Best improvement:** the brand's own Amazon sales by listing, in place of SmartScout. It would also bring in the 362 Fender and 145 Ledlenser listings now awaiting inputs.

### 2. Buy Box withheld or suppressed

**Means:** the brand's Amazon sales lost in a year on days when a listing had stock but Amazon showed no Buy Box.

**Formula:** for each listing, sales per in-stock day x days with stock and no Buy Box in the last 12 months x share lost without a Buy Box x brand-loss share.

| Input | Source |
|---|---|
| Sales per in-stock day | Collected: `baseline_daily_revenue` |
| Days with stock and no Buy Box | Collected: `no_buy_box_days_365` |
| Share lost without a Buy Box 50 / 80 / 95% | R-06 assumption (80%), bounded by the sources above |
| Brand-loss share 30 / 40 / 55% | Benchmark: Corsten and Gruen |

| | Sales on those days at the normal rate | Low | Mid | High |
|---|---|---|---|---|
| Fender, 273 of 745 listings with such a day (3,138 days) | $347,285 | $52,093 | $111,131 | $181,457 |
| Ledlenser, 14 of 122 (327 days) | $2,952 | $443 | $945 | $1,543 |

This changes R-06, which prices the listings suppressed today at their last 30 good days. On that formula Fender reads $99K a year and Ledlenser $408, because only 4 of Fender's 60 withheld listings and 1 of Ledlenser's 12 have a sales estimate. The R-06 monthly figure can stay on each listing's row. It is the same money seen from today, so it is never added to this line.

**Confidence: Medium.** Days are measured; the share lost is an assumption with one good study behind its direction. **Best improvement:** our own measurement. We hold daily Buy Box state and SmartScout sales, so after a few months we can compare each listing's sales in and out of the Buy Box and replace the 80%.

### 3. MAP leakage

**Means:** the retail value given away in a year by Amazon prices below MAP. It is not lost brand revenue (R-09), so it sits beside the total, not in it.

**Formula:** for each listing below MAP on Amazon, gap below MAP x SmartScout monthly units x 12 x share of volume kept when the price returns to MAP.

| Input | Source |
|---|---|
| Gap below MAP | Collected: `amz_leakage` |
| Monthly units | Collected: `smartscout_monthly_units` |
| Volume kept at MAP 50 / 75 / 100% | Benchmark: Israeli, "Online MAP Enforcement" (Harvard Business School working paper, January 2018), found that better enforcement raised channel prices 2% with no loss in volume, which supports the high end. Low and mid are IntoFocus assumptions. |

| | Monthly value today | Low | Mid | High |
|---|---|---|---|---|
| Fender, 30 of 157 listings below MAP on Amazon | $4,303 | $25,816 | $38,724 | $51,632 |
| Ledlenser, 9 of 33 | $3,916 | $23,494 | $35,241 | $46,988 |

Ledlenser's figure is large against its sales because it uses the last 30 days of units, and SmartScout's last 30 days ($21K) run well ahead of its 12-month average.

**Confidence: Medium.** The arithmetic is measured; the gap in coverage (30 of 157) is the weakness. **Best improvement:** MAP price history from Brian Watson, so duration is real, plus units at Walmart and other retailers.

### 4. Splintered listings

**Means:** added sales in a year if bundles with no usable parent ASIN were nested under the official parent, where they share its reviews.

**Formula:** annual sales of each splintered listing x lift from pooled reviews.

| Input | Source |
|---|---|
| Annual sales of the listing | Collected: `smartscout_ttm_revenue` |
| Lift 5 / 15 / 30% | IntoFocus assumption. Spiegel Research Center, Northwestern ("How Online Reviews Influence Sales", 2017): a product with five reviews is 270% more likely to be bought than one with none, and nearly all the gain comes in the first ten reviews. That ceiling applies to a listing with no reviews; we do not yet store each listing's review count reliably, so the lift is set well below it. |

| | Sales of splintered listings | Low | Mid | High |
|---|---|---|---|---|
| Fender, 84 of 463 bundles (1 with recorded sales) | $359,679 | $18,134 | $55,301 | $89,920 |
| Ledlenser, 1 of 5 bundles (no recorded sales) | $0 | Not estimated | Not estimated | Not estimated |

83 of Fender's 84 splintered bundles show no sales. Some of that is the splintering itself, which this formula cannot see.

**Confidence: Low.** **Best improvement:** review counts per listing and per parent, so the lift can follow the Spiegel curve listing by listing.

### 5. Missing Amazon specs

**Means:** added Amazon sales in a year if listings filled the required fields for their product type.

**Formula:** annual sales of each listing below 100% complete x lift for its completeness band.

| Completeness | Low | Mid | High |
|---|---|---|---|
| Below 70% | 5% | 10% | 20% |
| 70% to 84% | 3% | 6% | 12% |
| 85% to 99% | 1% | 3% | 6% |

These lifts are IntoFocus assumptions. The published evidence is thin: a 2020 study by Salsify, Kenshoo and Profitero found top-rated Amazon content converting far better than poor content, but it is vendor-run and shows association only. The scale is anchored to Amazon's own figure for A+ content (up to 8%, line 7), a comparable content fix.

| | Sales by band (below 70 / 70 to 84 / 85 to 99) | Low | Mid | High |
|---|---|---|---|---|
| Fender, 519 of 1,082 checked listings | $170K / $1.36M / $7.62M | $125,657 | $328,040 | $652,840 |
| Ledlenser, 186 of 186 | $10K / $2K / $100K | $1,585 | $4,172 | $8,346 |

Completeness is not yet counted against the approved field lists (decision 107), so these will move when that lands.

**Confidence: Low.** **Best improvement:** our own before-and-after. When a listing's completeness rises, compare its sales in the following 60 days with similar listings that did not change. Ten to twenty such cases replace the table.

### 6. Miscategorized listings (D-12)

**Means:** added sales in a year if listings filed under the wrong Amazon product type were refiled.

**Formula:** annual sales of each flagged listing x lift (5 / 15 / 30%).

The lift is an IntoFocus assumption. We found no study that measures it. The mechanism is clear (a product in the wrong category is ranked and filtered against the wrong products), and reported effects run from none to large.

| | Listings outside the client's product types | Low | Mid | High |
|---|---|---|---|---|
| Fender, 32 of 1,169 (a ceiling: many are correctly filed accessories) | $151,275 | $7,564 | $22,691 | $45,382 |
| Ledlenser, 21 of 202 (no recorded sales) | $0 | Not available* | Not available* | Not available* |

**Confidence: Low.** **Best improvement:** the D-12 check itself, then the same before-and-after measurement as line 5. Hold this dollar until D-12 exists.

### 7. Weak or missing A+ content

**Means:** added Amazon sales in a year if listings without A+ content had it.

**Formula:** annual sales of each listing with A+ absent x lift.

| Input | Source |
|---|---|
| Annual sales of the listing | Collected: `smartscout_ttm_revenue` |
| A+ absent | Collected: `aplus_state = absent` |
| Lift 3 / 5 / 8% | Benchmark: Amazon states that basic A+ content can raise sales by up to 8% and Premium A+ by up to 20% (sell.amazon.com, A+ Content page, Amazon internal data). "Up to" is a ceiling, so 8% is our high. |

| | Sales of listings without A+ | Low | Mid | High |
|---|---|---|---|---|
| Fender, 607 of 1,007 | $1,309,629 | $39,464 | $66,134 | $106,651 |
| Ledlenser, 119 of 202 | $2,328 | $70 | $119 | $193 |

Both brands already have A+ on the listings that sell. A later pass can price moving a best seller from basic to Premium A+ (up to 20%).

**Confidence: Medium.** The source is Amazon itself, on Amazon's own program. **Best improvement:** the brand's own sales by listing.

### 8. AI Search: Unbranded Discovery gap

**Means:** added sales in a year if AI assistants named the brand most as often as the target, when the shopper did not name a brand.

**Formula:** brand sales x share of sales shaped by an unbranded AI answer x relative gap to target x share of added recommendations that become purchases.

| Input | Source |
|---|---|
| Brand sales | Collected for Amazon; onboarding question 1 for all channels |
| Current rate | Collected: brand named most, of resolved Unbranded Discovery answers. Fender 134 of 251 (53.4%). Ledlenser 3 of 79 (3.8%). |
| Target rate | The top rival's rate when the brand trails (Ledlenser: Petzl, 19 of 79, 24.1%); otherwise the dashboard's Good band, 65% (Fender) |
| Relative gap | (target minus current) / current, capped at 100%. Fender 21.8%. Ledlenser 533%, capped at 100%. The cap is an IntoFocus assumption: no brand is credited with more than doubling its AI-shaped sales in a year. |
| Share of sales shaped by an unbranded AI answer 1 / 4 / 10% | Benchmarks below. Half of the AI-shaped share is assigned to unbranded questions and half to branded; that split is an IntoFocus assumption. |
| Added recommendations that become purchases 25 / 50 / 75% | IntoFocus assumption. Amazon says shoppers who use its assistant are 60% more likely to complete a purchase; Adobe reports AI-referred visits converting 42% to 90% better than other visits in 2026. |

How much of shopping an AI answer shapes, lowest to highest:
- Under 0.2% to about 1% of visits to online stores arrive by a click from an AI assistant (Kaiser and Schulze, Marketing Science, 973 stores, August 2024 to July 2025; Similarweb and Contentsquare, 2026). This counts last clicks only and misses research done before the visit.
- About 1.4%: Amazon's own estimate of nearly $12B in added yearly sales from its shopping assistant in 2025, against about $830B sold on Amazon (Amazon Q3 2025 earnings call, 30 Oct 2025; Marketplace Pulse).
- 20%: AI and agents influenced 20% of global holiday retail sales in 2025, $262B (Salesforce, 6 Jan 2026). Broad definition.
- 23% of US consumers name AI as their main starting point when researching a purchase (PYMNTS, October 2026).
- Half of consumers use AI-powered search, and $750B of US revenue will pass through it by 2028 (McKinsey, October 2025).
- Growth: AI-referred traffic to US retail sites rose 393% year over year in Q1 2026 (Adobe Analytics).

Our low (2% in all) sits at the measured-click end, our high (20%) at the influence end, our mid (8%) between them.

| | Sales base | Low | Mid | High |
|---|---|---|---|---|
| Fender (Amazon sales we measure) | $20,695,240 | $11,255 | $90,040 | $337,649 |
| Ledlenser (Amazon sales we measure) | $122,373 | $306 | $2,447 | $9,178 |
| Per $100M of all-channel sales, Fender's gap | $100M | $54K | $435K | $1.63M |
| Per $100M of all-channel sales, Ledlenser's gap | $100M | $250K | $2.0M | $7.5M |

An AI answer shapes the choice of brand wherever the shopper then buys, so the right base is all-channel sales. Until the client gives that number the line runs on measured Amazon sales and is small.

**Confidence: Low.** The rates are measured; the share of shopping that AI shapes is the widest range in this doc. **Best improvement:** the client's all-channel sales by category (onboarding questions 1 and 3), so the gap is priced where it is, for example Fender acoustics (20% against Taylor's 58%).

### 9. AI Search: Branded Consideration

**Means:** added sales in a year if AI assistants favored the brand as often as the target, when the shopper named the brand or compared it.

**Formula:** the same as line 8, with the Branded Consideration rate and a target of 90% (the dashboard's Good band).

| | Current rate | Relative gap | Low | Mid | High |
|---|---|---|---|---|---|
| Fender | 72 of 78 (92.3%) | 0, at target | $0 | $0 | $0 |
| Ledlenser | 38 of 52 (73.1%) | 23.2% | $71 | $567 | $2,125 |

A brand at target shows On track and no dollar.

**Confidence: Low**, for the same reason as line 8. **Best improvement:** all-channel sales.

### 10. Brand-site pages (missing official pages)

**Means:** the part of the AI Search gap (lines 8 and 9) that the brand's own pages can close, plus brand-site sales of products shoppers cannot find there.

**Formula, AI part:** (line 8 + line 9) x 15%. The 15% is the share of an AI answer's sources we plan for the brand's own pages to hold, the Actuation E1 target (SC-03). McKinsey reports brand sites are 5% to 10% of what AI search cites today. In our reads, brand pages are 3% of sources in Fender's unbranded answers and under 1% in Ledlenser's.

**Formula, brand-site part (needs onboarding questions 2 and 6):** brand-site sales x sales-weighted share of products with no exact official page x share captured in the first year (25 / 50 / 100%), counting only products the client says belong on its site. Google reports pages with structured data earning 25% (Rotten Tomatoes) to 82% (Nestlé) higher click-through from search, which supports a real effect and does not size it.

| | Products with no official page found | Low | Mid | High |
|---|---|---|---|---|
| Fender, AI part | 202 of 1,091 (they carry $8.9M of Amazon sales) | $1,688 | $13,506 | $50,647 |
| Ledlenser, AI part | 72 of 189 (they carry $4K of Amazon sales) | $57 | $452 | $1,695 |
| Brand-site part, both | | Not available* until onboarding | | |

Fender's missing pages include its best-selling Amazon bundles, so the client must say which products belong on its site before the brand-site part is priced.

**Confidence: Low.** **Best improvement:** brand-site revenue and the list of products meant to be sold there.

### 11. AI Actuation programs

**Means:** the part of the AI Search gap that outreach can close: publication and reviewer placements (P2, E3) and community responses (P1, E2).

**Formula:** (line 8 + line 9) x the share of sources that are publications, video or community sites in the unbranded answers a rival led. The brand's own pages take 15% first (line 10); the other 85% is split by today's sources.

| Sources in rival-led unbranded answers | Fender (758 citations) | Ledlenser (496 citations) |
|---|---|---|
| Publications and video, to P2 and E3 | 47.6%, so 40.5% of the gap | 47.2%, so 40.1% |
| Community, to P1 and E2 | 3.6%, so 3.0% | 1.8%, so 1.5% |
| Retailers, already priced in lines 1 to 7 | 27.2%, so 23.1% | 12.1%, so 10.3% |
| Rival sites, reference and unclassified: no lever | 21.6%, so 18.4% | 38.9%, so 33.1% |

| | Low | Mid | High |
|---|---|---|---|
| Fender (43.5% of the AI lines) | $4,896 | $39,167 | $146,877 |
| Ledlenser (41.6%) | $157 | $1,254 | $4,702 |

**Confidence: Low.** It inherits lines 8 and 9, and assumes a source's share of citations is its share of influence. **Best improvement:** verified Actuation records over time (E2, E3), so we can see whether rates move after placements.

### 12. Roadmap items

Each item shows the dollar of the finding it fixes, so Roadmap never creates new money.

| Roadmap item | Its dollar |
|---|---|
| Buy Box, splintered listings, official pages (the five findings) | Lines 2, 4, 10 |
| MAP leakage | Line 3, shown as retail value below MAP |
| Source actions by type of site | That site type's share of lines 8 and 9, from the table in line 11 |
| Weakest engine, weakest questions | Lines 8 and 9 x that engine's or question's share of rival-led answers |
| Brand's own pages, rewording | Line 10 |
| Watch lines | No dollar |

A phase total is the sum of its items, and no item may exceed its parent line. Phases balanced by effort and impact (decision 110) can use these dollars as the impact.

## 4. Overlap rules

1. **One day, one cause.** A listing's day is out of stock (no new offer) or without a Buy Box (an offer, no Buy Box), never both. Keepa's states already separate them.
2. **MAP is beside the total.** When a low price elsewhere causes suppression, the lost sales are in the Buy Box line only (R-09).
3. **Content lifts combine, they do not stack.** A listing missing specs and A+ gets (1 + lift) x (1 + lift) minus 1, capped at 30% of its sales. The cap is an IntoFocus assumption. For Fender this moves the three content lines by under 1%.
4. **Availability and content do not overlap.** Lines 1 and 2 price days with no sale. Lines 4 to 7 lift the sales that did happen.
5. **AI lines are two separate pools.** Unbranded and branded questions each take half of the AI-shaped share.
6. **Pages, Actuation and Roadmap are shares of the AI lines.** They are shown on their own tabs and never added.
7. **AI and listing fixes.** The retailer share of AI sources (Fender 23.1%, Ledlenser 10.3%) is removed from the AI lines before they join the total, because listing fixes already carry it.
8. **Low and high totals** add the lows and the highs. That is wider than the truth, since not every line lands low at once. It is simple and it errs toward honesty.

## 5. Summary figures

H-07 asks for value achieved, near-term upside and full potential.

### Near-term upside (Phase 1)

Lines 1, 2, 4, 5 and 7: every listing fix, on sales we measure, with no onboarding input. Line 6 joins when D-12 exists.

| | Low | Mid | High | Share of measured Amazon sales (mid) |
|---|---|---|---|---|
| Fender | $603,107 | $1,050,952 | $1,705,094 | 5.1% |
| Ledlenser | $10,997 | $17,101 | $26,397 | 14.0% |

### Measured total

Phase 1 + (line 8 + line 9) x (1 minus retailer share).

| | Low | Mid | High |
|---|---|---|---|
| Fender | $611,762 | $1,120,193 | $1,964,746 |
| Ledlenser | $11,335 | $19,805 | $36,536 |

### Enterprise Potential (full potential)

**Means:** the same work across everything the brand sells, not only the listings we monitor.

**Formula:** (Phase 1 share of measured sales x the brand's online marketplace and retailer sales) + (AI rate x the brand's all-channel sales x (1 minus retailer share)).

Both sales figures come from onboarding (questions 1 and 2). Without them the figure reads Not available*. The tables below use public figures as placeholders so Brian can see the size.

| Fender, placeholder $1B a year (CEO statement, Fortune, 21 Oct 2022; global) | Low | Mid | High |
|---|---|---|---|
| Online sales share. Low: Amazon only, 6.8% (e-commerce is 17.1% of US retail, Census Q2 2026; Amazon is 39.7% of that, eMarketer 2026). Mid: all e-commerce, 17.1%. High: 30%, IntoFocus assumption. | $68M | $171M | $300M |
| Listing fixes at 2.9 / 5.1 / 8.2% | $2.0M | $8.7M | $24.7M |
| AI lines at 0.05 / 0.44 / 1.63% of $1B, less retailer share | $0.4M | $3.3M | $12.6M |
| **Enterprise Potential** | **$2.4M** | **$12.0M** | **$37.3M** |

| Ledlenser, placeholder $75M a year (about EUR 65M to 68M from published accounts, via Implisense; global, year unclear) | Low | Mid | High |
|---|---|---|---|
| Online sales share 6.8 / 17.1 / 30% | $5.1M | $12.8M | $22.5M |
| Listing fixes at 9.0 / 14.0 / 21.6% | $0.5M | $1.8M | $4.9M |
| AI lines at 0.31 / 2.46 / 9.24% of $75M, less retailer share | $0.2M | $1.7M | $6.2M |
| **Enterprise Potential** | **$0.7M** | **$3.4M** | **$11.1M** |

What is weak here: the placeholders are global and we measure the US; the listing-fix rate comes from the listings we monitor and is assumed to hold elsewhere (Ledlenser's 14% rests on 24 selling listings); and the AI rate carries line 8's range.

**Confidence: Low** until the client's revenue replaces the placeholder, then Medium for the listing part.

### Value achieved

The measured total at the first weekly save minus the measured total now, line by line. It needs the estimates saved each week with the score snapshot. It reads Not available* until two saves exist. It shows what closed, whether or not our work closed it; the trail lists the listings that changed.

### What is retired

The hand-entered lines behind +$680K and +$38M to $62M. "Reduced return rates" and "return costs from spec hallucinations" are costs, not sales, and have no formula; they are not carried forward.

## 6. Onboarding questionnaire

Seven questions. Each has a use; none is required to start.

1. **Total sales, last 12 months,** for the brands and categories we will cover, in the US. (Lines 8, 9, C.)
2. **That total by channel:** Amazon; other online marketplaces and retailers; your own website; stores, dealers and distributors. (Lines 10, C.)
3. **That total by product category,** using the categories on Competitive Radar. (Lines 8, 9, so the gap is priced per category.)
4. **Amazon sales by ASIN, last 12 months** (a Seller Central or Vendor Central export). The single most useful input: it replaces SmartScout in lines 1 to 7. (R-06 source order.)
5. **Your share of the retail price:** on average, what percent of the shelf price is your revenue. (Decision 1, to show brand net revenue.)
6. **Your website:** its sales last 12 months, and which product lines are meant to be sold there. (Line 10.)
7. **Your market share or the category's size,** if you know it. Optional. (A check on line 8's target.)

## 7. Build plan after approval

No database change is needed for lines 1 to 12: every input is in a view the dashboard already reads. Value achieved adds the estimates to the weekly snapshot's `inputs` JSON, an additive change for Brian to approve.

| Round | Chunk | What | Files | Model | Cost |
|---|---|---|---|---|---|
| 1 | E1 Formula core | Benchmarks file (each value with source, date, low, mid, high); pure functions for lines 1 to 7 and the overlap rules; tests that reproduce this doc's tables. | new `lib/estimates/benchmarks.ts`, `availability.ts`, `content.ts`, `map-annual.ts`, `rollup.ts`, tests | Fable 5.2 (a wrong formula is costly) | $60 |
| 1 | E2 Estimate trail | One drawer for any estimate: N of M, inputs, formula sentence, sources, confidence. | new `components/v3/live/estimates/EstimateTrail.tsx`; `lib/fender-canvas/format.ts` | Opus 5.5 | $40 |
| 2 | E3 Opportunity and Revenue Estimates | Generated for every client from E1 (H-09); retire `analyst_estimates`. | `lib/fender-canvas/analyst-estimates.ts`, `template-vars.ts`, `spoke-narrative.ts`, `data/clients/*.json`, `lib/client/settings-schema.ts` | Opus 5.5 | $50 |
| 2 | E4 Action Items and tabs | Dollar on each fix-list row (the slot exists); annual lines on Out of Stock, MAP Leakage, Amazon Specs, A+ Matrix. | `action-items-fix-list.ts`, `stock-loss.ts`, `map-exposure.ts`, their panels | Opus 5.5 | $40 |
| 3 | E5 AI lines | Lines 8 to 11 and the source split; Roadmap item dollars. | new `lib/estimates/ai-gap.ts`; `roadmap-plan.ts`, `actuation-display.ts` | Fable 5.2 (allocation logic) | $50 |
| 3 | E6 Onboarding inputs | `revenue_inputs` on the settings record; Enterprise Potential; brand net revenue. | `lib/client/settings-schema.ts`, `data/clients/*.json`, `lib/estimates/enterprise.ts` | Opus 5.5 | $40 |
| 4 | E7 Value achieved | Save estimates with the weekly snapshot; the tier on Opportunity. | `score-snapshot.ts`, one additive migration | Opus 5.5 | $30 |

Seven chunks, about $310. FDD rows to update with the build: R-06, R-09, R-17, D-06, N-01, N-03, H-07, H-09.

## 8. Sources

Found by web search on 17 Nov 2026. This session could not open the pages themselves (their hosts are outside its network allow-list), so figures come from search summaries of them. Check each quote against its page before it goes on screen.

| Source | Date | Used for | Credibility |
|---|---|---|---|
| Gleason, Zhang, Wilson, "Determinants and Effects of Buy Box Suppression on Amazon", ACM Web Conference. https://doi.org/10.1145/3774904.3792473 | Apr 2026 | Buy Box: search, ads and rank effects | High, peer-reviewed; measures rank, not dollars |
| Feedvisor, Buy Box percentage. https://feedvisor.com/buybox/amazon-buy-box-percentage | 2026 | About 82% of sales through the Buy Box | Low to medium, industry estimate |
| Corsten and Gruen, online availability study (GMA). https://www.unh.edu/unhtoday/node/13244 and https://www.retaildive.com/news/online-out-of-stocks-cost-22-billion-in-sales/528878 | 2018, reported Mar 2019 | Brand-loss share | High; read through press coverage |
| Corsten and Gruen, "Stock-Outs Cause Walkouts", Harvard Business Review; Gruen, Corsten, Bharadwaj, "Retail Out-of-Stocks" (GMA, FMI, CIES) | May 2004; 2002 | Brand-loss share, in store | High; the split by response was not confirmed against the report |
| Israeli, "Online MAP Enforcement", Harvard Business School working paper. https://dash.harvard.edu/bitstream/handle/1/41274004/israeli_online-map-enforcement.pdf | Jan 2018 | MAP: prices up 2%, volume kept | Medium to high; one manufacturer |
| Israeli, Anderson, Coughlan, "Minimum Advertised Pricing: Patterns of Violation in Competitive Retail Markets", Marketing Science 35(4) | 2016 | MAP violations are common | High |
| Amazon, A+ Content. https://sell.amazon.com/tools/a-content | Read Nov 2026 | A+ lift up to 8%, Premium up to 20% | Medium; Amazon's own data, a ceiling |
| Spiegel Research Center, "How Online Reviews Influence Sales". https://spiegel.medill.northwestern.edu/How-Online-Reviews-Influence-Sales | 2017 | Reviews and purchase likelihood | High; not Amazon-specific |
| Salsify, Kenshoo, Profitero, "The Content Advantage in Amazon Advertising". https://www.salsify.com/resources/amazon-advertising-content-advantage-report-salsify | Dec 2020 | Content quality and conversion | Low; vendor study, association only |
| Amazon Q3 2025 earnings call, via Fortune. https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/ | 30 Oct 2025 | Assistant adds over $10B a year; users 60% more likely to buy | Medium; Amazon's internal estimate |
| Marketplace Pulse, Amazon GMV. https://www.marketplacepulse.com/articles/amazon-gmv-surpassed-800-billion-in-2025 | 2026 | $830B sold on Amazon in 2025 | Medium; estimate |
| Salesforce, 2025 holiday data. https://www.salesforce.com/news/stories/2025-holiday-shopping-data/ | 6 Jan 2026 | AI influenced 20% of holiday sales | Medium; broad definition |
| McKinsey, "New front door to the internet". https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/new-front-door-to-the-internet-winning-in-the-age-of-ai-search | Oct 2025 | Half of consumers use AI search; brand sites 5% to 10% of sources | Medium |
| PYMNTS, "From Prompt to Purchase". https://www.pymnts.com/report/study/from-prompt-to-purchase-who-wins-the-ai-shopper/ | Oct 2026 | 23% start purchase research with AI | Medium; survey |
| Adobe Analytics, via TechCrunch. https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/ | Apr to Sep 2026 | AI traffic growth and conversion | Medium to high; over 1 trillion visits |
| Kaiser and Schulze, "ChatGPT Referrals to E-Commerce Websites", Marketing Science. https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489 | 2025 | AI clicks under 0.2% of traffic | High; last click only |
| Google Search Central, structured data. https://developers.google.com/structured-data/ | Read Nov 2026 | Click-through with structured data | Medium; case studies |
| US Census via FRED, e-commerce share of retail. https://fred.stlouisfed.org/series/ECOMPCTSA | Q2 2026 | 17.1% | High |
| eMarketer, marketplaces FAQ. https://www.emarketer.com/content/faq-on-ecommerce-marketplaces--shift-amazon-only-multi-marketplace | 2026 | Amazon 39.7% of US e-commerce | Medium to high |
| Fortune, Fender CEO interview. https://fortune.com/2022/10/21/guitar-industry-fender-ceo-credits-diversity-players-pandemic-revival/ | 21 Oct 2022 | Fender about $1B, placeholder | Low for our use; old, global |
| Implisense, Ledlenser GmbH & Co. KG. https://implisense.com/en/companies/ledlenser-gmbh-co-kg-solingen-DE5F681JSF26 | Read Nov 2026 | Ledlenser about EUR 65M to 68M, placeholder | Low for our use; global, year unclear |
| Acadia, Amazon category change guide. https://acadia.io/amazon-changed-my-product-category-a-troubleshooting-guide/ | Read Nov 2026 | Miscategorization, one case | Low; no study exists |

## 9. How the worked figures were produced

Read-only requests to the dashboard's own views with its public key, 17 Nov 2026; no database write. Fender: `public` schema, 1,169 listings. Ledlenser: `ledlenser` schema, 214 listings in the sales view and 202 in the retail read. AI rates use the current run and the dashboard's question-role rules (Ledlenser's stored roles; Fender's text rules). A listing's annual sales are SmartScout's last 12 months. The E1 tests in the build plan must reproduce every table here before anything ships.
