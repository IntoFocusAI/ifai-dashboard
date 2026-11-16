# Competitive External Price: what Amazon tells us, and how to find the outside listing

Researched 16 Nov 2026 for the overdue task "Research Amazon's Competitive External Price data points." Written for an ecommerce operator. Builds on `docs/featured-offer-high-price.md` (5 Oct 2026), which covers the tooltip and drill-down copy.

## The short version

- Amazon withholds the Buy Box when an offer's price plus shipping is above the **Competitive External Price**: the lowest price Amazon recently found for the same item, or one it treats as equivalent, at a reputable retailer outside Amazon. Amazon never names that retailer.
- We already store the benchmark amount for every listing where Keepa returns it. We do not need Fender's Seller Central for the number.
- What Amazon will not give anyone, seller or not, is **who** set the price. To show "the Walmart (or Musician's Friend) listing causing this," we have to search the open web for a new listing at that price and label it as a match, not a confirmed cause.
- Recommendation: **DataForSEO Google Shopping**, searched by product title, with the UPC kept as a check. It costs well under a cent per listing. SerpApi could not be tested this month (see Pilot).

## The data points

| Data point | What it means | Who can get it | Where we have it |
| --- | --- | --- | --- |
| Competitive External Price | Lowest recent price at a reputable retailer outside Amazon, for the item or an equivalent. Pack size can be adjusted. A similar product from another brand can be used. | Keepa (`competitivePriceThreshold`), anyone with a Keepa key. SP-API `getCompetitiveSummary` as the `CompetitivePrice` reference price, any SP-API seller account (we have none). | `command.fmic_retail_buybox_map.competitive_price_threshold_cents`, and `fmic_listing_content.competitive_price_threshold` (dollars). |
| Buy Box withheld | No offer wins the Buy Box. The page shows "See All Buying Options." | Keepa (`buyBoxIsUnqualified`, no Buy Box seller). Public page. | `featured_offer_withheld`, `featured_offer_state = 'withheld'`. |
| Observed offer and shipping | The price being compared with the benchmark. | Keepa, public page, SP-API offers. | `featured_offer_observed_price_cents`, `featured_offer_observed_shipping_cents` (shipping is null on every withheld row today). |
| Suggested lower price | Keepa's copy of the price Amazon suggests for the Buy Box. In our data it equals the Competitive External Price on 49 of the 51 withheld rows that have one (1 is blank, 1 differs; the two tables are read at different times). | Keepa (`suggestedLowerPrice`). | `fmic_listing_content.suggested_lower_price`. Not on the dashboard. |
| Featured Offer Expected Price (FOEP) | The price at or below which a specific seller's offer is expected to win the Buy Box. | SP-API `getFeaturedOfferExpectedPriceBatch`. The seller who owns the SKU only. | Not available to us. |
| Pricing Health reference prices | Seller Central's "Pricing Health" page and the `PRICING_HEALTH` notification. Says why one seller's offer lost eligibility and gives reference prices: Competitive External Price, the 60-day average selling price on Amazon, and MSRP. | The seller of that offer only. | Not available to us. The 60-day average is a second test that we cannot see directly. |
| The outside retailer's name and URL | Which listing set the benchmark. | **Nobody.** Amazon does not disclose it, even to the seller. A reference-price review case asks Amazon to check the match, not to name it. | Candidate only: `mf_price` / `mf_url` (Musician's Friend), `wmt_price` / `wmt_url` (Walmart), and the Google Shopping search below. |

Two Amazon changes worth knowing:

- Since 30 Sep 2025, SP-API `getCompetitiveSummary` returns `CompetitivePrice` instead of `CompetitivePriceThreshold` (outside Japan). Same definition. Keepa still calls the field `competitivePriceThreshold`, and so do our columns.
- SP-API Product Pricing v2022-05-01 rate limits are tight: about one request every 30 seconds (burst 1), up to 20 ASINs per batch. Fine for a daily check of the suppressed set, not for an hourly sweep of the catalog.

## What our data says today

Read-only SQL on 16 Nov 2026, readings from 15 Nov 12:42 to 16 Nov 06:42 UTC.

- 60 Fender listings have the Buy Box withheld. 51 of them have a Competitive External Price. On all 51, the observed offer is above it. 9 have no benchmark from Keepa.
- All 51 have a UPC in `fmic_electric_catalog`.
- Our own Musician's Friend scrape already matches the benchmark to the cent on **16 of 51** (17 at or below it). Walmart prices are stored for only 3 of the 51, and none match.

So the Musician's Friend columns already explain about a third of the suppressed set. The search below is for the rest, and for naming more than one candidate retailer.

## Pilot: Google Shopping, DataForSEO vs SerpApi

Script: `scripts/google-shopping-pilot.mjs` (read-only, no database access). Input: 25 of the 51 withheld listings with a benchmark, spread across Player II, Squier, American Professional II, American Vintage II, artist models, and one string set. For each listing it searches Google Shopping, opens the best-matching Google product page, and lists every new-condition seller price. A seller "matches" when its price equals the benchmark to the cent.

### SerpApi: not tested

The SerpApi key in `.env.local` is on the free plan, and all 250 searches for this month are used (renews 11 Dec 2026). No SerpApi results. The Toolbelt SerpApi tool does not offer the Google Shopping engine, so it could not stand in.

### DataForSEO: results

| Measure | Result |
| --- | --- |
| Searched by UPC, relevant result | **4 of 25.** 19 returned unrelated products (a guitar UPC returned pet toys), 2 returned a search-engine error. Google Shopping does not treat a bare UPC as a product code. |
| Searched by title (fallback), relevant result | 20 more. **24 of 25** found overall. The string set (`B000RW7U40`) found nothing relevant. |
| At least one new listing at exactly the benchmark | **9 of 24** |
| Of those 9, same model and finish clearly confirmed | About 6. Google often groups every color of a model on one product page, so a match can be another color. |
| Cost | **$0.158** for the whole pilot, including retries and a 3-search probe. About $0.005 per listing with the UPC attempt first, $0.004 by title only, $0.002 by title only at normal (slower) priority. |
| Time | 1 to 3 minutes per listing (DataForSEO queues each search). Fine for a daily job, not for a live page. |

Listings where the match is strong:

| Listing | Benchmark | New listings at that price |
| --- | --- | --- |
| American Professional II Jazzmaster, Miami Blue (`B08L32XHK8`) | $1,739.99 | Guitar Center, Sweetwater, Musician's Friend, Strait Music, Beacock Music, Reverb, Alamo Music (eBay) |
| American Vintage II 1957 Stratocaster (`B0B6211V4R`) | $2,499.99 | Sweetwater, Guitar Center, International House of Music, Reverb, Music & Arts |
| Buck Owens Telecaster (`B0D76XGV8V`) | $1,899.99 | Musician's Friend, Guitar Center, Tone Shop Guitars, Chuck Levin's |
| 70th Anniversary Vintera II Antigua Stratocaster (`B0CNKRB17N`) | $1,299.99 | Musician's Friend, Dave's Guitar Shop, The Music Emporium, Chuck Levin's |
| Player II Telecaster, Butterscotch Blonde (`B0D2LQNDS7`) | $849.99 | Sweetwater, Guitar Center, Reverb, Alamo Music, Strait Music, Cream City Music (eBay) |
| Player II Jazzmaster, Rallye Orange (`B0GNNQQ2Q1`) | $789.99 | Musician's Friend |

Listings where the match is weak (the matching page is another finish or configuration): Player II Stratocaster Transparent Cherry Burst (Sweetwater's match is the HSS model), Player II Stratocaster White Blonde (Morgan Music's match is 3-Color Sunburst), Squier Affinity Stratocaster HSS Olympic White (Dave's Guitar Shop's match is a special-run finish).

What it missed: on two listings our stored Musician's Friend price matches the benchmark and DataForSEO did not find it (`B0C8BLGTB3` Mike McCready, `B08L384C3G` American Professional II Black). The search landed on the wrong product page, or the product page showed only its first 10 sellers.

What the pilot shows beyond the match rate:

- When the benchmark matches, it usually matches **many** dealers at once. On those listings the benchmark is the common street price, and the Amazon offer sits above it. That is not one rogue retailer. The next step is to price the Amazon offer at the street price, not to chase one listing.
- When only one retailer matches (the Rallye Orange Jazzmaster at Musician's Friend), that retailer is the one to show on the dashboard.
- Walmart Marketplace sellers appeared on 3 of the 25 (Austin Bazaar, Focus Pro Audio, GearTree), none at the benchmark price. Our Walmart columns hold a price for 3 of the 51.

## Costs at our volume

Assuming a daily check of the withheld set (about 60 listings) and one search per listing.

| Source | What it gives | Cost per listing | Monthly, 60 listings a day | Notes |
| --- | --- | --- | --- | --- |
| Keepa (already paid) | Benchmark amount, Buy Box withheld | Already in our plan | No change | Already stored hourly. |
| DataForSEO Google Shopping | Named outside listings, price, shipping, URL | $0.002 to $0.004 (search + product page) | About $4 to $8 | Pay as you go. Our balance is $0.75; it needs a top-up before any daily job. |
| SerpApi Google Shopping | Same kind of data, returned live in seconds | 2 searches per listing: about $0.05 on Starter ($25 / 1,000), $0.03 on Developer ($75 / 5,000) | About 3,600 searches: Developer plan, $75 | Not tested; free plan used up. Failed searches are not billed. |
| Amazon SP-API Product Pricing | Amazon's own `CompetitivePrice` reference price | Free | Free | Needs an Amazon seller account and SP-API developer registration. Does not name the retailer. Adds nothing Keepa does not already give us. |
| Seller Central Pricing Health | The seller's own view, plus the 60-day average price test | Free | Free | Only the seller who owns the offer. Not available to IntoFocus. |

## Recommendation

1. **Keep Keepa as the source of the benchmark.** It already gives us Amazon's number for 51 of the 60 withheld listings. SP-API would not add the retailer name, which is the part we are missing.
2. **Use DataForSEO Google Shopping, by title, for the outside listing.** It found a relevant product for 24 of 25 listings and an exact-price listing for 9, at a fraction of a cent each. Search the UPC first only if a later test shows Google resolving it; in this pilot it was right 4 times out of 25.
3. **Show the matches as "listings at Amazon's benchmark price," with the seller, price, URL, and check time.** When many dealers match, say the benchmark is the common street price. When one matches, name it.
4. **Keep the Musician's Friend columns.** They match the benchmark on 16 of 51 today and caught two that the search missed.
5. **Retest SerpApi after 11 Dec 2026** on the same 25 listings (`--only=serpapi`) before deciding against it. It returns results in seconds, which matters only if this ever needs to be live on the page.

Before a daily job ships, the script needs: a check that the matching listing is the same finish (the store's own listing title is now in the output), and the 10-seller limit raised on the product page (`depth`).

## Sources

- Amazon SP-API, [Product Pricing API and Notifications FAQ](https://developer-docs.amazon/sp-api/docs/pricing-faq): Competitive External Price definition, reference prices, `PRICING_HEALTH`, FOEP.
- Amazon SP-API change log, [CompetitivePrice replaces CompetitivePriceThreshold](https://developer-docs.amazon/sp-api/changelog/update-product-pricing-api-v2022-05-01-returns-new-competitive-price-and-deprecates-competitivepricethreshold) (effective 30 Sep 2025).
- Amazon SP-API model, [Product Pricing v2022-05-01](https://github.com/amzn/selling-partner-api-models/blob/main/models/product-pricing-api-model/productPricing_2022-05-01.json): `getCompetitiveSummary`, `getFeaturedOfferExpectedPriceBatch` (needs the seller's own SKU), rate limits.
- [SerpApi pricing](https://serpapi.com/pricing).
- DataForSEO [Google Shopping sellers](https://docs.dataforseo.com/v3/merchant/google/sellers/task_post/) and [products](https://docs.dataforseo.com/v3/merchant/google/products/task_get/advanced/) docs; per-task prices from our account's price list on 16 Nov 2026.

## Re-running the pilot

Build the input with read-only SQL (withheld listings with a benchmark, UPC from `fmic_electric_catalog`), then:

```
node --env-file=.env.local scripts/google-shopping-pilot.mjs input.json out/ --limit=25 --concurrency=9
```

`--only=serpapi|dataforseo` runs one vendor. `--query=title` skips the UPC attempt. Output: `out/results.json`, `out/summary.json`, and every raw response in `out/raw/`.
