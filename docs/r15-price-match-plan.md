# R-15 plan: price matches for suppressed listings

Written 12 Nov 2026 by Brian Watson (with Claude) for Brian Magazu's review. Nothing here is built or applied yet.

FDD row: **R-15 TARGET** · Launch ([catalog-health.md](fdd/catalog-health.md)). For a listing that lost the Buy Box, search the product at Amazon's benchmark price and link the outside pages that match it. **Acceptance:** links are labeled price matches, never confirmed causes.

The drill-down this follows was set out on 5 Oct in [featured-offer-high-price.md](featured-offer-high-price.md), steps 1–4. The Affinity Telecaster there is the model case: Musician's Friend and Guitar Center both at $371.98, exactly Amazon's benchmark.

## Today

- **What counts as suppressed:** `featured_offer_state = 'withheld'`. Of those, `competitive_offer_suppressed` marks the ones where Amazon published a benchmark (the Competitive External Price, `competitive_price_threshold_cents`, read through Keepa) and the offer plus shipping sits above it. Live counts on 12 Nov:

  | | Withheld | With a benchmark above the offer |
  | --- | --- | --- |
  | Fender | 58 | 49 |
  | Ledlenser | 11 | 4 |

- **What the screen shows:**
  - `SuppressedListingsPanel` lists each withheld listing with its offer, benchmark, gap and check time.
  - The only link is the Amazon page.
  - Its note already says "a price cause is confirmed only where Amazon published a benchmark".
- **What we already know about outside prices:**
  - The Walmart and Musician's Friend MAP checks store one price per listing.
  - Only 2 of Fender's 58 withheld listings have a Walmart page on file, and 1 of Ledlenser's 11.
  - For most suppressed listings we have no outside page at the benchmark price. The search is what fills that gap.
## Pilot, 12 Nov 2026 (read-only, nothing written to the database)

Run on the 51 listings in scope that have a UPC: 49 Fender, plus 2 of Ledlenser's 4 (the other two have no UPC on file).

- **Searching by UPC doesn't work.**
  - SerpApi returned unrelated products (perfume, a games console, dress shirts) on all 3 test listings.
  - DataForSEO returned the same or a server error.
  - `scripts/google-shopping-pilot.mjs`, which searches by UPC, is dropped.
- **Searching by title works** (`scripts/price-match-pilot.mjs`, one Google Shopping search plus one product page per listing).
  - 39 listings searched cleanly.
  - **25 had at least one store at exactly Amazon's benchmark.**
  - 5 failed because Google had no product page. The script also lost their shopping results; that's a bug to fix.
  - 7 weren't searched: the SerpApi account ran out of searches after 96.
- **The usual answer is "the going price", not one retailer.**
  - On most matched listings, several authorized dealers sit exactly at the benchmark. Examples: Sweetwater, Musician's Friend, Guitar Center, and on **8 listings fender.com itself**.
  - So in most cases the Amazon offer is simply above what the market charges, and the next step is pricing the Amazon offer at the benchmark.
  - The 5 Oct pattern, one or two stores at the benchmark while the rest are higher, is the rarer case. It's the one where linking a likely source helps most.
- **Same-product checks are essential, not optional.**
  - Shopping results at the right price are often the wrong item: another finish, Telecaster for Stratocaster, HSS for SSS.
  - Google's product page groups finishes and pickup layouts together.
  - Bundles (Jimmy Page Mirror Tele with case and kit) match the guitar alone.
- **Stored MAP looks out of date on some listings.**
  - Jimmy Page Mirror Tele: stored MAP $2,999.99, while fender.com sells at $2,499.99, the benchmark.
  - Of the 24 Fender listings in scope with a stored MAP, 23 have it above the benchmark. Worth a check alongside R-09.

## Design

### 1. Which listings get searched

Withheld listings **with** a benchmark: 49 Fender, 4 Ledlenser today.

A withheld listing with no benchmark shows "No benchmark to search". With no number to match, any page we linked would be a guess.

### 2. The search

- **Query:** Google Shopping by **product title** (model, finish, fingerboard), then the product page's store list. The pilot showed a UPC search returns unrelated products.
- **Kept:** new-condition offers from sellers other than Amazon. The pilot's used and open-box filter stays.
- **Price match:** the offer's price equals the benchmark to the cent, either landed (item plus shipping) or item price alone. The row records which.
  - Amazon compares landed prices, so landed is listed first.
  - Near misses (for example within 1%) are not shown in v1. The 5 Oct cases were all exact, and a near miss invites a story we can't support.
- **Where the model comes in:** every price-matched result goes through a same-product check against the Amazon listing.
  - It checks model, finish, fingerboard, pickup layout, handedness, and bundle versus guitar only.
  - It answers same, different or unsure, with a one-line reason.
  - Its answer is stored with the model name and confidence, the same pattern as `site_type_classifications`.
  - "Different" is dropped. "Unsure" is shown under its own heading.
  - Where the store page names a UPC, a matching UPC settles it without the model.
- **How many stores match:** the screen says whether the benchmark is "the price at N stores, including fender.com" (the going price) or "found at 1 store" (a likely source). The next step differs between the two.

### 3. Storage: R-10's rows, no new prefix

- **Search results** are written to `retail_price_observations` ([r10-retailer-rows-plan.md](r10-retailer-rows-plan.md)) with `source = 'price_search'`.
- **Retailer:** each result is placed by its domain using `retailers.domains`. A seller not on the list is kept under its domain, and becomes a retailer row only if we choose to track it.
- **One added table, `price_match_checks`:** asin, benchmark at search time, provider, query type (UPC or title), result count, the model's check where it ran, and searched_at. It lets the screen say "searched, nothing at $371.98" rather than showing nothing.
- **New view, `canvas_price_matches`:** joins each suppressed listing's current benchmark to that run's results and marks `landed_match` / `item_match`. A benchmark that changed since the search is shown as "searched at the old benchmark".

### 4. The screen

- **In the Suppressed listings table:** a **Price matches** column, for example "2 matches". It opens the list:
  - retailer
  - price, and whether it matched landed or item price
  - a link to the page
  - when it was checked
- **Each list carries the label** "Matches Amazon's benchmark. Amazon does not name the retailer it used." The longer caveat goes in the tooltip, per Let the data speak.
- **The header gives N of M:** "Price match found for N of M listings with a benchmark."
- **One next step per listing,** from the 5 Oct note:
  - price at the benchmark;
  - correct the outside listing that matches it;
  - or ask Amazon to review the reference when the match looks like the wrong configuration.
- **Stored matches show first:** when a Walmart or Musician's Friend price already on file equals the benchmark, it appears marked as from our MAP check.

### 5. Schedule and cost

- Searched once a day for listings in scope, and again whenever the benchmark changes.
- About 53 listings a day at 2 searches each is roughly **3,200 SerpApi searches a month**.
- The current SerpApi plan ran out at 96 searches, so this needs a larger plan. The alternative is DataForSEO, which wasn't tested by title; its UPC search failed.
- A cheaper option is to re-search only when a listing's benchmark changes, plus once a week otherwise.
- The job is a Toolbelt wrench on a workflow schedule, like the Findability recheck. No model runs except the same-product check.

## Steps

1. **Pilot (done 12 Nov; results above).** Still to do:
   - Fix the product-page bug.
   - Finish the 7 listings left over, once searches are available.
   - Try DataForSEO by title.
   - Hand-check the same-product rule on the 25 matched listings.
2. **Tables (additive; Brian approves):** `price_match_checks` and `canvas_price_matches`, after R-10 step 1 creates the observation tables.
3. **Search job:** a wrench plus schedule writing to prod and the copies, starting with Fender.
4. **Screen:**
   - The Price matches column, the list, the labels and N of M.
   - Tests: the label is always present, "cause" never appears, and stale benchmarks are flagged.
   - Ledlenser follows once its 4 listings are checked.
5. **FDD:** R-15 Evidence updated. Proposing the status change is Brian's call.

## Decisions for Brian

1. **Scope:** only listings with a benchmark (recommended), or every withheld listing?
2. **Match rule:** exact landed or exact item price, with near misses hidden in v1. Agree?
3. **Provider and budget:** a larger SerpApi plan (about 3,200 searches a month for a daily search), or search only when the benchmark changes plus once a week. Is there a monthly cap you want?
6. **Going price versus likely source:** when the benchmark is simply what most dealers, fender.com included, charge, show that as "the going price" with the next step "price the Amazon offer at the benchmark". Agree?
4. **Wording:** AGENTS.md says a suppressed listing should link "the Walmart listing causing it when that is the cause". Amazon never names its source, so we can't show a confirmed cause. I'd keep AGENTS.md's intent (link the likely page) under R-15's label (price match, not cause), and adjust the AGENTS.md sentence to match. OK?
5. **Unsure model checks:** show them under their own heading (recommended), or hide them?
