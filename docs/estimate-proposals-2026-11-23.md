# Dollar-estimate proposals for Brian, 23 Nov 2026

Worker 32.9. Five proposals, one formula each, for Brian Magazu to approve one at a time. Nothing here is built: no product code and no database change. Every figure is an analyst estimate. Live figures were read on 23 Nov 2026 from the signed-in dashboard (review account) for Fender and Ledlenser, and the existing estimate code (`lib/estimates`) was run on those same rows, so the baselines match the screen ($1.29M Phase 1 for Fender, $51.3K for Ledlenser).

## Summary

| # | Item | Fender, monthly mid | Ledlenser, monthly mid | Confidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Out of stock: replace the 30- and 90-day columns | No new money. Next 30 days: $107K today becomes $200K; $0 rows 171 to 0 | $800 becomes $3.3K; $0 rows 16 to 0 | High (same measured inputs) | **Ship** |
| 2 | Publish exact official brand-site pages | $9.7K on all-channel sales* ($217 on the Amazon sales we price) | $1.8K* ($6) | Low | **Ship as a range only**, as a share of the AI lines |
| 3 | Fill empty spec fields on brand-site pages | $821* ($18) if shipped | $769* ($3) if shipped | Very low | **Do not ship yet** |
| 4 | Fill all five Amazon bullets | $1.3K | $6 | Low | **Ship as a range**, inside the 30% content cap |
| 5 | Outreach to buying-guide sites | Top 3 publications: $26.8K* ($601). guitarworld.com alone: $14.2K* ($319) | Top 5 publications: $18.2K* ($63) | Low | **Ship as a range only**, as a share of the AI lines |

\* On a public revenue placeholder ($1B Fender, $75M Ledlenser), the same one Enterprise Potential uses today. The figure in brackets uses the Amazon sales the dashboard prices today ($22.4M Fender, $258K Ledlenser).

How they combine with what is on screen:

- **Item 1** changes two columns on the Out of Stock tab. The 12-month figure, Phase 1 and the Priorities monthly figure do not move.
- **Item 4** is a new Phase 1 content line. It combines with missing specs, A+ and splintered listings under the existing rule (lifts combine, capped at 30% of a listing's sales).
- **Items 2, 3 and 5** are slices of the two AI Search lines that already exist (lines 8 and 9). They are never added to Phase 1 or to each other beyond those lines, and they sit inside the AI part of Enterprise Potential. They create no new money.

### What Brian needs to decide

1. **Item 1:** Option A (recommended) or Option B for the 30- and 90-day columns. See section 1.
2. **Items 2 and 5:** which sales base the Priorities figure uses. I recommend all-channel sales with the placeholder asterisk, because a brand-site page and a Guitar World guide shape purchases at every retailer. The Amazon-only figure ($217 a month for the top Critical item) understates by construction. The other choice is the Amazon base until the client gives its own sales.
3. **Item 2:** whether a product-line ("family") page counts as half a page. Today it counts as no exact page (649 of Fender's 1,014).
4. **Item 3:** agree to hold the dollar until we have a before-and-after reading of our own.
5. **Item 4:** approve the new benchmark (1% of sales per missing bullet, range 0.6% to 1.6%) and that it joins Phase 1.
6. **Item 5:** approve splitting the approved AI Actuation line by publication, in place of a new share-of-voice model.

---

## 1. Out of stock: fix the 30- and 90-day $0 rows

**In one sentence:** the 30- and 90-day columns should say what a listing is expected to miss in the next 30 or 90 days, not what it missed in the last 30 or 90.

### How each period is computed today

| Step | Where | What it does |
|---|---|---|
| Out-of-stock days | View `command.mv_listing_sales_loss_v2`, read as `public.canvas_listing_sales_loss_v2` (migration `20261102170000_listing_sales_loss_v2.sql`) | Counts Keepa days with no new offer: `oos_days_30` in the last 30 days, `oos_days_90` in the last 90, `oos_days_365` in the last 365 |
| Sales per in-stock day | Same view, `baseline_daily_revenue` | SmartScout sales, last 12 months, divided by Keepa in-stock days in the last 365 (30 or more needed) |
| Period value | Same view, `est_lost_revenue_oos_30`, `_90`, `_365` | Sales per in-stock day x the out-of-stock days **inside that period** |
| On screen | `lostSales(row, window)` in `lib/fender-canvas/stock-loss.ts`; columns in `components/v3/live/StockLossPanel.tsx`; drawer in `StockLossDetail.tsx` | Shows the three values as stored |
| Yearly line and Priorities | `estimateOutOfStock` in `lib/estimates/availability.ts`, then `estimateMonthlyPotential` in `lib/estimates/monthly.ts` | 12-month value x the share the brand loses (40%), then divided by 12. Not affected by this problem |

### The cause, in plain words

The arithmetic is right. The meaning is wrong for the label. B0F8J9ZH6F (Squier Affinity Stratocaster HSS Pack) was out of stock for 54 days earlier this year and has been in stock every day of the last 90. So the 30-day figure is $493.88 a day x 0 days = $0, and the same for 90 days. The tab then tells the reader each figure "is also what the next period of the same length would miss," which a $0 cannot be for a listing that was out 54 days in the year.

On 23 Nov, 171 of Fender's 256 priced rows read $0 for 30 days and 138 read $0 for 90 days. For Ledlenser it is 16 and 13 of 21. Every one of them is in stock today.

### Proposed formula

Expected missed sales, next N days = sales per in-stock day x expected out-of-stock days in the next N days.

- **Listing in stock today:** expected out-of-stock days = N x (out-of-stock days in the last 12 months / days observed in the last 12 months). Its own record of running out, applied to the next period.
- **Listing out of stock today:** expected out-of-stock days = N. This is what it would sell over the period if it were back in stock today, which is the value of fixing it now.
- **12 months:** unchanged. It stays the measured figure for the last 12 months, so Phase 1 does not move.

Rename the columns "Expected missed sales, next 30 days" and "next 90 days". The out-of-stock days for the last 30 and 90 days stay in the drawer as measured facts.

**Option B (simpler):** every listing gets its 12-month figure x N / 365. This matches the approved rule that the monthly card is Phase 1 divided by 12. It never shows $0, but it does not see that a listing is out right now.

**No recovery factor.** I found no credible published figure for how fast sales return after a restock. The only sources are seller blogs that disagree (7 days to "never"). None is needed: sales per in-stock day is already an average over every in-stock day of the year, slow restart days included.

### Before and after (listing level, as the tab shows it)

| Listing | State today | Sales per in-stock day | Out-of-stock days, 12 months | Before: 30 days / 90 days | After (A): next 30 / next 90 | 12 months (unchanged) |
|---|---|---|---|---|---|---|
| B0F8J9ZH6F Squier Affinity Strat HSS Pack | In stock | $493.88 | 54 of 365 | $0 / $0 | $2,192 / $6,576 | $26,670 |
| B0GZ5MHLH9 Squier Debut Stratocaster | In stock | $484.60 | 85 of 189 observed | $0 / $1,454 | $6,538 / $19,615 | $41,191 |
| B0F1DL9SN1 American Professional II Telecaster | In stock | $180.52 | 136 of 365 | $0 / $0 | $2,018 / $6,054 | $24,550 |
| B0CLDNLPRW Squier Sonic Strat Pack | In stock (out 18 of the last 30 days) | $437.24 | 50 of 365 | $7,870 / $7,870 | $1,797 / $5,391 | $21,862 |
| B0F3YZSSCL Player II Modified Strat HSS Floyd Rose | Out of stock, 40 days | $207.36 | 239 of 365 | $5,806 / $14,930 | $6,221 / $18,662 | $49,558 |
| B073LFZDSS Ledlenser MH10 headlamp | In stock | $233.22 | 41 of 364 | $0 / $0 | $788 / $2,364 | $9,562 |

The Sonic Strat Pack goes down because it is back in stock: its recent 18 days are history, and its yearly record says about 4 days in the next 30.

| Tab total, listing level | Before | Option A | Option B |
|---|---|---|---|
| Fender, 30 days (256 priced rows) | $106.9K | $199.9K | $106.0K |
| Fender, 90 days | $250.0K | $599.6K | $318.1K |
| Ledlenser, 30 days (21 priced rows) | $800 | $3.3K | $2.2K |
| Ledlenser, 90 days | $3.0K | $9.9K | $6.7K |

In Option A, $120K of Fender's $200K comes from the 63 listings out of stock today (none out for more than 90 days).

**Weakest assumption:** in Option A, a listing out today is priced as out for the whole next period. That is the value of acting now, not a forecast; most past stretches ended sooner. For an in-stock listing, last year's pattern may not repeat (a one-off supply gap would overstate it).

**Selling model:** for Fender (partner-led) the dealer holds the stock, and the data does not show who ran out. For Ledlenser (brand-led) the brand restocks its own offer.

**Recommendation: ship, Option A.** Same inputs, no new benchmark, confidence stays High.

Not a formula decision, for the PM: the tab prices 256 of Fender's 617 rows (SmartScout only) while the yearly line already prices 533 with the Keepa and rank-curve estimates. The same holds for Ledlenser (21 against 106 of 170). The new columns could use the yearly line's sales source so more rows carry a figure.

---

## 2. Exact official brand-site pages

**In one sentence:** added sales in a year if every monitored product had its own exact page on the brand's site for AI assistants to read and cite.

**The causal chain:** an exact page exists → an assistant can read and cite the brand's own facts for that exact product → the brand is named or favored in more answers → more purchases, wherever the shopper buys.

**The weakest link is the second arrow.** A product page mostly helps questions that name the product. "Best electric guitar under $900" answers cite buying guides: in Unbranded answers a rival led, brand-owned pages are under 1% of sources for both clients. Our data also shows the brand leads far more often when its site is cited (Fender 98% against 68%), but that is mostly because questions that name the brand cite its site. It is not proof the page causes the lead.

### Formula

(line 8 + line 9) x the share of AI sources planned for the brand's own pages (15%) x the sales-weighted share of checked listings with no exact page x the share captured in the first year (25% / 50% / 100%).

This is the approved line 10 with two changes: it is scaled by how many pages are actually missing, and by first-year capture. Both make it smaller and easier to defend.

| Input | Fender | Ledlenser | Exists today? |
|---|---|---|---|
| Lines 8 + 9, on Amazon sales (low / mid / high) | $6.9K / $36.6K / $137K | $1.2K / $6.4K / $23.9K | Yes, on screen |
| Lines 8 + 9 as a share of sales (mid) | 0.163% | 2.46% | Yes |
| Listings with no exact page | 1,014 of 1,105 (91.8%) | 120 of 195 (61.5%) | Yes |
| The same, weighted by Amazon sales | 95.0% | 15.9% | Yes (computed here) |
| All-channel sales | $1B public placeholder | $75M public placeholder | Placeholder; the client's own figure at onboarding |
| Brand-site sales and which products belong on the site | Not collected | Not collected | Onboarding questions 2 and 6 |

Ledlenser's two shares differ because its best sellers already have exact pages. Sales weighting is the honest one, so the formula uses it.

**Benchmarks:** `brand_pages_source_share` (15%) and `brand_site_first_year_capture` (25 / 50 / 100%), both already in the register. Proposed added source for the first: Yext, 9 Oct 2025, 6.8 million citations across ChatGPT, Gemini and Perplexity: "First-party websites generated 2.9M citations (44%)", and 47.6% in retail ([release](https://www.yext.com/about/news-media/ai-citations-release), verified). Vendor research on location-style questions, so it shows brand sites can be a large share and does not set ours. It makes 15% look cautious.

### Worked monthly figures

| | Low | Mid | High |
|---|---|---|---|
| Fender, all-channel placeholder | $908 | $9,690 | $72.7K |
| Fender, Amazon sales we price | $20 | $217 | $1,627 |
| Ledlenser, all-channel placeholder | $172 | $1,833 | $13.7K |
| Ledlenser, Amazon sales we price | $1 | $6 | $47 |

Fender mid, all-channel: $1B x 0.163% x 15% x 95.0% x 50% = $116K a year. The range is wide because it inherits the AI lines' range (the share of sales an AI answer shapes runs 1.5% to 10% per line).

A second part, **brand-site sales of products shoppers cannot find there**, stays Not available* until onboarding gives brand-site sales (the approved line 10 formula, unchanged).

**Weakest assumption:** that exact pages can win 15% of AI sources. Second: the placeholder covers all products worldwide, while the missing share is measured on the monitored catalog. Third: a family page already does part of the job (decision 3 above).

**Double counting:** a slice of lines 8 and 9. Never added to Phase 1. Items 2 and 3, plus rewording and comparison content, together cannot exceed 15% of lines 8 and 9.

**Recommendation: ship as a range only**, labeled as a share of the AI Search gap.

---

## 3. Empty spec fields on brand-site pages

**In one sentence:** added sales in a year if the brand's product pages carried their specs in the machine-readable form assistants and search engines parse.

**What the count is.** "89 of 713" is not 89 listings. It is 713 found pages x the 12.5% of spec fields that are empty on average. Every one of the 713 Fender pages is missing the same field, the machine-readable spec list (`additionalProperty`); 94 of Ledlenser's 98 are too. So the real finding is "no found page publishes machine-readable specs," which the screen already says (100.0% and 97.1%).

**Formula, if shipped:** the same pool as item 2, with the missing share replaced by (found pages x average share of fields empty) / listings checked: 89 of 1,105 (8.1%) for Fender, 13 of 195 (6.7%) for Ledlenser.

| Monthly, if shipped | Low | Mid | High |
|---|---|---|---|
| Fender, all-channel placeholder | $77 | $821 | $6.2K |
| Fender, Amazon sales we price | $2 | $18 | $138 |
| Ledlenser, all-channel placeholder | $72 | $769 | $5.8K |
| Ledlenser, Amazon sales we price | under $1 | $3 | $20 |

**Evidence.** The best study I found points to no effect. Ahrefs, 11 May 2026, tracked 1,885 pages that added this markup against 4,000 matched pages that did not: ChatGPT citations +2.2% and Google AI Mode +2.4%, both "statistically indistinguishable from zero", and AI Overviews -4.6% ([study](https://ahrefs.com/blog/schema-ai-citations/), verified). Its pages were already heavily cited, so it does not rule out a gain for pages assistants do not yet use. Google reports higher click-through from search for pages with structured data (already in the register), which would need brand-site traffic and sales to price.

**Weakest assumption:** that filling the markup moves AI answers at all. A second route, assistants quoting wrong specs, is small today: the fact check flagged 4 of 2,867 Fender answers.

**Recommendation: do not ship a dollar yet.** Keep the item in Priorities on its share of listings, with no figure. To price it later: record the date a client adds the markup and compare its cited-page count and lead rate 60 days before and after, or collect brand-site search traffic at onboarding and use Google's click-through evidence.

---

## 4. Fill all five Amazon bullets

**In one sentence:** added Amazon sales in a year if every listing used all five bullets.

### Do the existing methods give an analog?

- **Spec bands (`SPEC_LIFT_BANDS`):** treating bullets as completeness (4 of 5 = 80%) gives a 6% lift for one missing bullet and $82K a year for Fender. Too bold: the bands are for a whole set of required fields, and a bullet is one field.
- **A+ lift (`APLUS_LIFT`, 3% / 5% / 8%):** Amazon's own published ceiling for adding a whole content block. A listing with no bullets at all should not be credited with more than that. **This is the analog I propose.**
- **`CONTENT_LIFT_CAP` (30%):** applies as is.

### Formula

For each listing with fewer than five bullets: its annual sales x missing bullets x the lift per missing bullet. Then combine with the listing's other content lifts under the existing rule (combine, cap at 30%).

**Proposed benchmark row:** `bullet_lift_per_missing`, 0.6% / 1.0% / 1.6% (the A+ lift divided by five). Basis: IntoFocus assumption anchored to Amazon's A+ figure. Sources: [Amazon A+ Content](https://sell.amazon.com/tools/a-content) (already verified in the register); Amazon Ads, "Improve your products for advertising" ([guide](https://advertising.amazon.com/en-us/library/guides/improve-your-products-for-advertising), verified): "Include 3+ bullet points", and a complete page means "your chance of getting a click, or making a sale, can significantly increase." Amazon gives no number for bullets. I found no credible study that isolates bullets.

| Input | Fender | Ledlenser |
|---|---|---|
| Listings with fewer than five bullets | 270 of 1,018 | 54 of 207 |
| Of those, with a sales figure above $0 | 152 | 6 |
| Their annual Amazon sales | $1.19M | $2.9K |
| Missing bullets, sales-weighted average | 1.35 | 2.41 |
| Already carrying another content line | 124 listings | 4 listings |

All inputs exist today (`canvas_listing_content.bullet_count` and the sales the other lines use). Bullets are not among the fields the missing-specs line counts, so the two do not overlap.

| | Low | Mid | High |
|---|---|---|---|
| Fender, a year | $7.6K | $16.0K | $31.1K |
| Fender, a month | $629 | $1,333 | $2,588 |
| Ledlenser, a year | $0 | $69 | $280 |
| Ledlenser, a month | $0 | $6 | $23 |

Fender's figure is modest because 172 of the 270 are missing only one bullet. Ledlenser's is near zero because 48 of its 54 short listings have no recorded sales; the low is $0 because the rank-curve low is $0 for those bands.

**Weakest assumption:** the lift itself. No source measures it, and one missing bullet on an otherwise full listing may change nothing. It could also be too low for the 8 Fender listings with no bullets at all.

**Selling model:** on Fender's listings a dealer often holds the offer, but the brand can still own the listing copy through Amazon Brand Registry. Ledlenser edits its own.

**Double counting:** a fifth content line in Phase 1, inside the 30% cap. On these listings the existing content lifts average 5.8% of sales, so the cap rarely binds.

**Recommendation: ship as a range**, confidence Low, to be replaced by our own before-and-after results when listings gain bullets.

---

## 5. Outreach to buying-guide and editorial sites

**In one sentence:** the part of the AI Search gap that sits in answers citing a named publication, which outreach to that publication could close.

### Share of voice now, or later?

Brian earlier parked this as "share-of-voice estimate later." I looked at two ways to do it now.

- **A new model:** count the rival-led answers that cite a publication, assume outreach flips a share of them, and price the rise in the brand's rate. It needs a "flip rate," and nothing credible gives one. Not defensible yet.
- **Split the approved AI Actuation line (line 11) by publication.** No new assumption: a publication's dollar is its share of the sources in the Unbranded answers a rival led. **This is what I propose.** It is a share-of-voice estimate, and it cannot create new money.

### Formula

(line 8 + line 9) x 85% (what is left after the brand's own pages take 15%) x the publication's share of all source citations in Unbranded answers a rival led.

| Input | Fender | Ledlenser |
|---|---|---|
| Unbranded resolved answers a rival led, with sources | 1,485 | 559 |
| Source citations in those answers (one per site per answer) | 6,949 | 2,721 |
| Publications' share of them | 54.0% | 46.7% |
| Named publications | guitarworld.com 855 (12.3%), guitarplayer.com 462 (6.6%), musicradar.com 294 (4.2%) | beamandbezel.com 78, 1lumen.com 83, cleverhiker.com 82, treelinereview.com 72, gearjunkie.com 65: 14.0% together |

These counts are my tally of the dashboard's stored answers across all runs, with questions split into branded and unbranded by whether the question names the brand. The build should use the dashboard's own question roles and the date-pill window, so the shares will move a little.

**What the data says about the two clients.** guitarworld.com is cited in 60% of Fender's unbranded answers with sources, and Fender already leads 59% of those. The money is only in the 855 a rival led. For Ledlenser the brand leads 0% to 14% of the answers citing its top five publications, so the gap there is real and wide.

**Benchmarks:** none new for the formula. Proposed context rows for the register:

- Ahrefs, 26 May 2025, 75,000 brands: "Brand web mentions show the strongest correlation (0.664) with AI Overview brand visibility", against 0.218 for backlinks ([study](https://ahrefs.com/blog/ai-overview-brand-correlation/), verified). The authors say "correlation ≠ causation".
- Aggarwal et al., "GEO: Generative Engine Optimization", KDD 2024: content changes "can boost visibility by up to 40% in generative engine responses" ([paper](https://arxiv.org/abs/2311.09735), abstract verified). A ceiling for content the brand controls, not for earned coverage.
- Muck Rack, "What Is AI Reading?", 2025 and 2026 editions: journalism is roughly a quarter of AI citations. Search summaries only; I could not open the reports, so this would enter as "could not open".

### Worked monthly figures

| | Low | Mid | High |
|---|---|---|---|
| Fender, guitarworld.com, all-channel placeholder | $2.7K | $14.2K | $53.3K |
| Fender, top 3 publications, all-channel placeholder | $5.0K | $26.8K | $100.5K |
| Fender, top 3 publications, Amazon sales we price | $113 | $601 | $2,249 |
| Ledlenser, top 5 publications, all-channel placeholder | $3.4K | $18.2K | $68.4K |
| Ledlenser, top 5 publications, Amazon sales we price | $12 | $63 | $236 |

Fender mid, top 3: $1B x 0.163% x 85% x 23.2% = $322K a year. Ledlenser is close to Fender on a base 13 times smaller because its gap is the largest the formula allows (31.4% against a 65% target, capped at doubling).

**Ledlenser comparison content against Fenix and Petzl.** This is content on the brand's own site, so it belongs to the 15% own-pages pool with items 2 and 3, not to outreach. Its slice: line 8 x 15% x the rival's share of rival-led unbranded answers. Fenix in Flashlights is 194 of 1,257 (15.4%): about $2.9K a month on the placeholder, $10 on Amazon sales. Petzl in Headlamps is 197 of 1,257 (15.7%): the same. Shown on its own row and never added to item 2.

**Weakest assumption:** a site's share of citations equals its share of influence, and outreach can win it. A placement in a guide the assistant already cites may not change which brand the assistant names first. The figure is the size of the prize in those answers, not a forecast of what one campaign wins.

**Double counting:** a slice of lines 8 and 9, and of the approved line 11. Never added to Phase 1. Retailer sites (22% of Fender's sources in these answers) stay with the listing fixes.

**Recommendation: ship as a range only**, per publication, labeled as a share of the AI Search gap. Replace it with a measured figure once we have dated placements and can compare the brand's rate in answers citing that publication before and after.

---

## Proposed benchmark register changes

| ID | What it is | Low | Mid | High | Basis | Sources |
|---|---|---|---|---|---|---|
| `bullet_lift_per_missing` (new) | Sales lift per missing Amazon bullet, up to five | 0.6% | 1.0% | 1.6% | IntoFocus assumption: the A+ lift divided by five | Amazon A+ Content; Amazon Ads guide (direction only) |
| `brand_pages_source_share` (add a source) | Share of AI sources the brand's own pages can hold | 15% | 15% | 15% | Unchanged | Add Yext, Oct 2025 (44% first-party sites; vendor) |
| `brand_site_first_year_capture` (reuse) | Share captured in the first year | 25% | 50% | 100% | Unchanged | Unchanged |
| `jsonld_citation_effect` (context only) | Change in AI citations after adding structured data | n/a | n/a | n/a | Published source; holds item 3's dollar | Ahrefs, May 2026 |
| `earned_media_context` (context only) | Earned coverage and AI visibility | n/a | n/a | n/a | Published sources; direction only | Ahrefs, May 2025; Aggarwal et al., KDD 2024; Muck Rack (could not open) |

Item 1 needs no benchmark: it uses each listing's own measured days and sales.

## How the figures were produced

- **Dashboard read:** signed in as the review account at ifai-dashboard.netlify.app on 23 Nov 2026, both clients: Priorities, Action Items (Urgent Interventions and Revenue Estimates), and the rows behind Out of Stock, Findability, Brand-Site Specs, the A+ Matrix and the Citation Ecosystem.
- **Sales per listing:** the repo's own `joinEstimateListings` and `buildClientEstimates` run on those rows. They reproduce the on-screen lines to the dollar (Fender out of stock $571K, Phase 1 $1.29M; Ledlenser $37.3K and $51.3K).
- **AI lines:** read from Revenue Estimates. Fender line 8 is $36.6K ($6.9K to $137K) and line 9 is $0 at target; Ledlenser $5.17K and $1.19K. As shares of sales these give the all-channel figures.
- **Not checked:** the all-channel placeholders are the public figures already in each client's settings; I did not re-verify them. Citation shares use my question split, not the dashboard's stored question roles.
