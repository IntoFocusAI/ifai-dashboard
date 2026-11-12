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
- **A search pilot exists but hasn't been run:**
  - `scripts/google-shopping-pilot.mjs` (uncommitted) searches Google Shopping by UPC through two providers, SerpApi and DataForSEO.
  - It drops used, refurbished and open-box offers, and counts a match only on an exact cents match.
  - It writes files, never the database.

## Design

### 1. Which listings get searched

Withheld listings **with** a benchmark: 49 Fender, 4 Ledlenser today.

A withheld listing with no benchmark shows "No benchmark to search". With no number to match, any page we linked would be a guess.

### 2. The search

- **Query:** Google Shopping by **UPC**. UPC pins the exact product and finish, which a title search can't.
  - Fender UPCs come from the catalog match already in place: part number, then UPC/EAN. Ledlenser's are in `ledlenser.catalog`.
  - Listings without a UPC are searched by model number and title, and every result is marked "checked against title only".
- **Kept:** new-condition offers from sellers other than Amazon. The pilot's used and open-box filter stays.
- **Price match:** the offer's price equals the benchmark to the cent, either landed (item plus shipping) or item price alone. The row records which.
  - Amazon compares landed prices, so landed is listed first.
  - Near misses (for example within 1%) are not shown in v1. The 5 Oct cases were all exact, and a near miss invites a story we can't support.
- **Where the model comes in:** only to check that a result is the same product when the search was by title, or the result's title names a different finish or configuration.
  - It answers same, different or unsure, and gives a one-line reason.
  - Its answer is stored with the model name and confidence, the same pattern as `site_type_classifications`.
  - "Different" results are dropped. "Unsure" ones are shown under their own heading.
  - UPC hits skip the model.

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
- About 53 listings a day. Over a month that's roughly 1,600 searches, plus seller lookups.
- The pilot measures the per-search cost of each provider, and I'll report it before anything is scheduled.
- The job is a Toolbelt wrench on a workflow schedule, like the Findability recheck. No model runs except the same-product check.

## Steps

1. **Pilot, read-only.**
   - Run `google-shopping-pilot.mjs` on today's 53 listings, with both providers.
   - Report the hit rate (listings with at least one exact match), the false matches found by hand, and the cost.
   - Pick the provider.
   - Commit the script.
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
3. **Provider and budget:** choose after the pilot. Is there a monthly cap you want?
4. **Wording:** AGENTS.md says a suppressed listing should link "the Walmart listing causing it when that is the cause". Amazon never names its source, so we can't show a confirmed cause. I'd keep AGENTS.md's intent (link the likely page) under R-15's label (price match, not cause), and adjust the AGENTS.md sentence to match. OK?
5. **Unsure model checks:** show them under their own heading (recommended), or hide them?
