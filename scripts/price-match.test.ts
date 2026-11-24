// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/price-match.test.ts
//
// R-15 price matches (approved 23 Nov 2026 with changes): the scope (withheld listings with a
// benchmark), the exact match rule, unsure matches kept apart, the next step by the client's
// selling-model setting, ignore through the set-aside overlay, stale benchmarks, and wording
// ("price match", never "cause").
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { clientProfile } from "@/lib/client";
import * as priceMatch from "@/lib/fender-canvas/price-match";
import {
  PRICE_MATCH_LINK_LABEL,
  PRICE_MATCH_TIP,
  exactMatchKind,
  matchSummary,
  noMatchText,
  priceMatchCounts,
  priceMatchNextStep,
  priceMatchScope,
  priceMatchesByListing,
  withoutIgnored,
  type PriceMatchCheckRow,
  type PriceMatchRow,
} from "@/lib/fender-canvas/price-match";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";

const withheld = (asin: string, benchmark: number | null, over: Record<string, unknown> = {}) => ({
  asin,
  title: `Listing ${asin}`,
  featured_offer_state: "withheld",
  competitive_external_price_state: benchmark == null ? "unavailable" : "present",
  competitive_price_threshold_cents: benchmark,
  ...over,
});

const check = (asin: string, benchmark: number, over: Partial<PriceMatchCheckRow> = {}): PriceMatchCheckRow => ({
  asin,
  check_id: 1,
  searched_at: "2026-11-23T10:00:00Z",
  last_attempt_at: "2026-11-23T10:00:00Z",
  last_attempt_status: "searched",
  search_benchmark_cents: benchmark,
  ...over,
});

const match = (asin: string, over: Partial<PriceMatchRow> = {}): PriceMatchRow => ({
  asin,
  search_benchmark_cents: 71499,
  retailer: "musicians-friend",
  retailer_name: "Musician's Friend",
  domain: "musiciansfriend.com",
  url: "https://www.musiciansfriend.com/x",
  item_cents: 71499,
  shipping_cents: 0,
  match_kind: "landed",
  verdict: "same",
  ...over,
});

test("R-15 scope: only withheld listings with Amazon's benchmark", () => {
  const scope = priceMatchScope([
    withheld("B000000001", 71499),
    withheld("B000000002", null),
    withheld("B000000003", 0),
    withheld("B000000004", 9900, { featured_offer_state: "present" }),
    withheld("B000000005", 39999, { featured_offer_observed_seller: " Sweetwater " }),
  ]);
  assert.deepEqual(scope.map((s) => s.asin), ["B000000001", "B000000005"]);
  assert.equal(scope[1].offerSeller, "Sweetwater");
  assert.equal(scope[0].offerSeller, null);
});

test("R-15 match rule: exact landed or exact item price, nothing near", () => {
  assert.equal(exactMatchKind(71499, 71499, 0), "landed");
  assert.equal(exactMatchKind(71499, 69999, 1500), "landed");
  assert.equal(exactMatchKind(71499, 71499, null), "item");
  assert.equal(exactMatchKind(71499, 71499, 1500), "item");
  assert.equal(exactMatchKind(71499, 71498, null), null, "one cent off is not a match");
  assert.equal(exactMatchKind(71499, 71500, 0), null);
  assert.equal(exactMatchKind(71499, 70800, 0), null, "within 1% is still not a match");
  assert.equal(exactMatchKind(null, 71499, 0), null);
  assert.equal(exactMatchKind(71499, null, 0), null);
});

test("R-15 listings: same matches listed, near misses dropped, unsure kept apart, one entry per store", () => {
  const scope = priceMatchScope([withheld("B000000001", 71499), withheld("B000000002", 71499), withheld("B000000003", 50000)]);
  const listings = priceMatchesByListing(
    scope,
    [check("B000000001", 71499), check("B000000002", 71499), check("B000000003", 50000)],
    [
      match("B000000001"),
      match("B000000001", { url: "https://www.musiciansfriend.com/y" }),
      match("B000000001", { retailer: null, retailer_name: null, domain: "guitarcenter.com", item_cents: 71500 }),
      match("B000000001", { retailer: null, retailer_name: null, domain: "sweetwater.com", verdict: "unsure" }),
      match("B000000002", { verdict: "unsure", shipping_cents: null }),
    ],
  );
  const [a, b, c] = listings;
  assert.equal(a.state, "matched");
  assert.deepEqual(a.same.map((o) => o.store), ["Musician's Friend"], "two offers from one store count once");
  assert.deepEqual(a.unsure.map((o) => o.store), ["sweetwater.com"], "a seller not on the list shows its domain");
  assert.equal(b.state, "unsure_only");
  assert.equal(b.unsure[0].kind, "item");
  assert.equal(c.state, "none");
  assert.equal(noMatchText(c), "Nothing at $500.00");
  assert.deepEqual(priceMatchCounts(listings), { matched: 1, total: 3 });
});

test("R-15 marketplaces: confirmed-new offers show marketplace and seller; each seller is its own entry", () => {
  const scope = priceMatchScope([withheld("B000000001", 71499), withheld("B000000002", 71499)]);
  const reverb = { retailer: "reverb", retailer_name: "Reverb", domain: "reverb.com" };
  const listings = priceMatchesByListing(
    scope,
    [check("B000000001", 71499), check("B000000002", 71499)],
    [
      match("B000000001", { ...reverb, seller: "Mountain Music", url: "https://reverb.com/item/1" }),
      match("B000000001", { ...reverb, seller: "Northland Music Center", url: "https://reverb.com/item/2" }),
      // Rows written before the condition check name only the marketplace: never shown.
      match("B000000001", { ...reverb, seller: "Reverb.com", url: "https://reverb.com/item/3" }),
      match("B000000002", { retailer: null, retailer_name: null, domain: "ebay.com", seller: "eBay" }),
      match("B000000002", { retailer: null, retailer_name: null, domain: "reverb.com", seller: "Gelb Music" }),
    ],
  );
  assert.deepEqual(listings[0].same.map((o) => o.store), ["Reverb · Mountain Music", "Reverb · Northland Music Center"]);
  assert.deepEqual(
    listings[1].same.map((o) => o.store),
    ["Reverb · Gelb Music"],
    "a client without Reverb on its list still labels it by marketplace; an unconfirmed eBay row is dropped",
  );
  assert.equal(priceMatch.marketplaceFor("www.ebay.com"), "eBay");
  assert.equal(priceMatch.marketplaceFor("musiciansfriend.com"), null);
});

test("R-15 stale: a benchmark that changed after the search is flagged and not counted", () => {
  const scope = priceMatchScope([withheld("B000000001", 69999)]);
  const [l] = priceMatchesByListing(scope, [check("B000000001", 71499)], [match("B000000001")]);
  assert.equal(l.stale, true);
  assert.equal(l.searchedBenchmarkCents, 71499);
  assert.equal(l.same.length, 1, "matches stay listed against the benchmark they were searched at");
  assert.deepEqual(priceMatchCounts([l]), { matched: 0, total: 1 });
});

test("R-15 not searched and failed searches say so", () => {
  const scope = priceMatchScope([withheld("B000000001", 71499), withheld("B000000002", 71499)]);
  const listings = priceMatchesByListing(
    scope,
    [check("B000000002", 71499, { searched_at: null, last_attempt_status: "failed" })],
    [],
  );
  assert.equal(listings[0].state, "not_searched");
  assert.equal(noMatchText(listings[0]), "Not searched yet");
  assert.equal(listings[1].state, "search_failed");
});

test("R-15 ignore: an ignored listing leaves the list and both counts, and comes back when reopened", () => {
  const scope = priceMatchScope([withheld("B000000001", 71499), withheld("B000000002", 71499)]);
  const listings = priceMatchesByListing(scope, [check("B000000001", 71499), check("B000000002", 71499)], [match("B000000001")]);
  assert.deepEqual(priceMatchCounts(listings), { matched: 1, total: 2 });
  const ignored = new Map([["B000000001", { status: "active" }]]);
  const shown = withoutIgnored(listings, ignored);
  assert.deepEqual(shown.map((l) => l.asin), ["B000000002"]);
  assert.deepEqual(priceMatchCounts(shown), { matched: 0, total: 1 });
  assert.deepEqual(priceMatchCounts(withoutIgnored(listings, new Map())), { matched: 1, total: 2 }, "restored");
  assert.equal(SET_ASIDE_CHECKS.priceMatch, "price_match", "the ignore is a set-aside on the price_match check");
  const migration = readFileSync("supabase/migrations/20261123190000_r15_price_matches.sql", "utf8");
  assert.match(migration, /insert into public\.set_aside_checks[\s\S]*'price_match'/);
  assert.match(migration, /'keep_amazon_price'[\s\S]*array\['price_match'\]/);
});

test("R-15 next step follows the selling-model setting, not the client name", () => {
  const listing = { benchmarkCents: 71499, offerSeller: null };
  assert.equal(clientProfile("ledlenser").sellerModel, "Brand-led");
  assert.equal(clientProfile("fender").sellerModel, "Partner-led");
  assert.equal(priceMatchNextStep("Brand-led", listing), "Price the Amazon offer at the benchmark, $714.99.");
  assert.equal(
    priceMatchNextStep("Partner-led", listing),
    "Ask the authorized seller(s) holding this Amazon offer to price it at the benchmark, $714.99.",
  );
  assert.equal(
    priceMatchNextStep("Partner-led", { benchmarkCents: 139900, offerSeller: "Sweetwater" }),
    "Ask Sweetwater, the authorized seller holding this Amazon offer, to price it at the benchmark, $1,399.00.",
  );
  const section = readFileSync("components/v3/live/PriceMatchesSection.tsx", "utf8");
  assert.match(section, /priceMatchNextStep\(client\.sellerModel/, "the screen passes the setting");
  assert.doesNotMatch(section, /=== "(fender|ledlenser)"|brandName\(\) ===/, "no client-name branch");
});

test("R-15 summary: the going price names the brand site; one store is 'found at 1 store'", () => {
  const scope = priceMatchScope([withheld("B000000001", 71499), withheld("B000000002", 71499)]);
  const [many, one] = priceMatchesByListing(
    scope,
    [check("B000000001", 71499), check("B000000002", 71499)],
    [
      match("B000000001"),
      match("B000000001", { retailer: null, retailer_name: null, domain: "shop.fender.com" }),
      match("B000000001", { retailer: null, retailer_name: null, domain: "guitarcenter.com" }),
      match("B000000002"),
    ],
  );
  assert.equal(matchSummary(many, ["fender.com"], "fender.com"), "The price at 3 stores, including fender.com");
  assert.equal(matchSummary(one, ["fender.com"], "fender.com"), "Found at 1 store");
});

test("R-15 wording: links are labeled 'price match' and nothing says 'cause'", () => {
  assert.equal(PRICE_MATCH_LINK_LABEL, "price match");
  const strings = Object.values(priceMatch).filter((v): v is string => typeof v === "string");
  const files = ["components/v3/live/PriceMatchesSection.tsx", "components/v3/live/PriceMatchOffers.tsx"].map((f) =>
    readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$|^import .*$|^\} from .*$/gm, ""),
  );
  for (const text of [...strings, ...files]) assert.doesNotMatch(text, /\bcause[sd]?\b/i);
  assert.match(PRICE_MATCH_TIP, /does not name the retailer/);
  for (const file of files) {
    assert.doesNotMatch(file, /<(span|div|a|td|th|strong|button|summary)\b[^>]*\stitle=/, "custom tooltips only");
  }
});
