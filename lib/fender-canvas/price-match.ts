/* R-15 price matches for suppressed listings (docs/r15-price-match-plan.md, approved by Brian
   Magazu on 23 Nov 2026 with changes).

   For each withheld Amazon listing with a benchmark (Amazon's reference price), the search job
   (Toolbelt wrench r15_price_match_search) stores outside offers priced at exactly that benchmark
   and a same-product check for each. This file turns those rows into what the screen says:

   - Scope: withheld listings with a benchmark only, minus listings the brand chose to ignore.
   - Match rule: exact landed price (item + shipping) or exact item price. Near misses never show.
   - "Same" matches are price matches; "unsure" ones get their own heading.
   - The next step follows the client's selling model, a per-client setting (seller_type), never
     the client's name: brand-led prices the Amazon offer; partner-led asks the authorized
     seller(s) holding the offer to price it.
   - Wording: "price match", never "cause". Amazon does not name the retailer it used. */

import {
  benchmarkCents,
  featuredOfferState,
  listingLabel,
  type FeaturedOfferRow,
} from "@/lib/fender-canvas/featured-offer";

export type PriceMatchKind = "landed" | "item";
export type PriceMatchVerdict = "same" | "unsure";
export type SellingModel = "Partner-led" | "Brand-led";

/** One row of canvas_price_matches: an outside offer from a listing's latest search. */
export type PriceMatchRow = {
  asin: string;
  check_id?: number | string | null;
  searched_at?: string | null;
  search_benchmark_cents?: number | string | null;
  current_benchmark_cents?: number | string | null;
  benchmark_changed?: boolean | null;
  retailer?: string | null;
  retailer_name?: string | null;
  domain?: string | null;
  url?: string | null;
  title?: string | null;
  seller?: string | null;
  item_cents?: number | string | null;
  shipping_cents?: number | string | null;
  match_kind?: string | null;
  verdict?: string | null;
  verdict_reason?: string | null;
  verdict_by?: string | null;
  observed_at?: string | null;
};

/** One row of canvas_price_match_checks: a listing's latest search. */
export type PriceMatchCheckRow = {
  asin: string;
  check_id?: number | string | null;
  searched_at?: string | null;
  last_attempt_at?: string | null;
  last_attempt_status?: string | null;
  search_benchmark_cents?: number | string | null;
  current_benchmark_cents?: number | string | null;
  benchmark_changed?: boolean | null;
  result_count?: number | string | null;
  exact_count?: number | string | null;
  kept_count?: number | string | null;
  different_count?: number | string | null;
};

/** A listing in scope: withheld, with Amazon's benchmark. */
export type PriceMatchScopeRow = {
  asin: string;
  label: string;
  benchmarkCents: number;
  /** The seller(s) holding the withheld offer, when the read stored one (see withheld-offer-seller.ts). */
  offerSeller: string | null;
  /** How many sellers hold it (tied at the lowest landed price). Absent means one. */
  offerSellerCount?: number;
};

export type PriceMatchOffer = {
  store: string;
  domain: string | null;
  url: string | null;
  itemCents: number;
  shippingCents: number | null;
  kind: PriceMatchKind;
  verdict: PriceMatchVerdict;
  reason: string | null;
  observedAt: string | null;
};

export type ListingPriceMatchState = "matched" | "unsure_only" | "none" | "not_searched" | "search_failed";

export type ListingPriceMatches = PriceMatchScopeRow & {
  state: ListingPriceMatchState;
  searchedAt: string | null;
  /** The benchmark the latest search looked for. */
  searchedBenchmarkCents: number | null;
  /** True when Amazon's benchmark changed after the latest search; the next search refreshes it. */
  stale: boolean;
  same: PriceMatchOffer[];
  unsure: PriceMatchOffer[];
};

/** Withheld listings with a benchmark: the scope Brian approved (decision 1). */
export function priceMatchScope(rows: readonly FeaturedOfferRow[]): PriceMatchScopeRow[] {
  const scope: PriceMatchScopeRow[] = [];
  for (const row of rows) {
    const asin = typeof row.asin === "string" ? row.asin : "";
    const benchmark = benchmarkCents(row);
    if (!asin || benchmark == null || featuredOfferState(row) !== "withheld") continue;
    const seller = typeof row.featured_offer_observed_seller === "string" ? row.featured_offer_observed_seller.trim() : "";
    scope.push({ asin, label: listingLabel(row) || asin, benchmarkCents: benchmark, offerSeller: seller || null });
  }
  return scope;
}

function cents(value: unknown): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * The match rule (decision 2): an offer matches when its landed price (item plus known shipping)
 * or its item price equals the benchmark to the cent. Landed comes first because Amazon compares
 * landed prices. Anything else, however close, is not a match.
 */
export function exactMatchKind(
  benchmark: number | null | undefined,
  item: number | null | undefined,
  shipping: number | null | undefined,
): PriceMatchKind | null {
  const b = cents(benchmark);
  const i = cents(item);
  if (b == null || b <= 0 || i == null || i <= 0) return null;
  const s = cents(shipping);
  if (s != null && s >= 0 && i + s === b) return "landed";
  if (i === b) return "item";
  return null;
}

/** The store a match is shown under: the retailer's name when it is on the list, else its domain. */
export function storeLabel(row: Pick<PriceMatchRow, "retailer_name" | "domain" | "seller">): string {
  return row.retailer_name?.trim() || row.domain?.trim() || row.seller?.trim() || "Unknown store";
}

function toOffer(row: PriceMatchRow, benchmark: number): PriceMatchOffer | null {
  const item = cents(row.item_cents);
  const shipping = cents(row.shipping_cents);
  const kind = exactMatchKind(benchmark, item, shipping);
  const verdict = row.verdict === "same" || row.verdict === "unsure" ? row.verdict : null;
  if (!kind || !verdict || item == null) return null;
  return {
    store: storeLabel(row),
    domain: row.domain ?? null,
    url: typeof row.url === "string" && /^https?:\/\//i.test(row.url) ? row.url : null,
    itemCents: item,
    shippingCents: shipping,
    kind,
    verdict,
    reason: row.verdict_reason ?? null,
    observedAt: row.observed_at ?? row.searched_at ?? null,
  };
}

/** One entry per store: the same store listed twice (two Reverb sellers, say) counts once. */
function byStore(offers: PriceMatchOffer[]): PriceMatchOffer[] {
  const seen = new Map<string, PriceMatchOffer>();
  for (const offer of offers) {
    const key = (offer.domain ?? offer.store).toLowerCase();
    const prior = seen.get(key);
    if (!prior || (prior.kind === "item" && offer.kind === "landed")) seen.set(key, offer);
  }
  return [...seen.values()].sort((a, b) => a.store.localeCompare(b.store));
}

/**
 * Joins the listings in scope to their latest search and its matches. Each offer is re-checked
 * against the benchmark that search looked for, so a row that does not match exactly never shows.
 */
export function priceMatchesByListing(
  scope: readonly PriceMatchScopeRow[],
  checks: readonly PriceMatchCheckRow[],
  matches: readonly PriceMatchRow[],
): ListingPriceMatches[] {
  const checkBy = new Map(checks.map((c) => [c.asin, c]));
  const matchBy = new Map<string, PriceMatchRow[]>();
  for (const m of matches) matchBy.set(m.asin, [...(matchBy.get(m.asin) ?? []), m]);
  return scope.map((listing) => {
    const check = checkBy.get(listing.asin);
    const searchedBenchmark = cents(check?.search_benchmark_cents);
    const searchedAt = check?.searched_at ?? null;
    const offers = searchedBenchmark
      ? (matchBy.get(listing.asin) ?? [])
          .map((row) => toOffer(row, searchedBenchmark))
          .filter((o): o is PriceMatchOffer => o != null)
      : [];
    const same = byStore(offers.filter((o) => o.verdict === "same"));
    const unsure = byStore(offers.filter((o) => o.verdict === "unsure"));
    const stale = searchedBenchmark != null && searchedBenchmark !== listing.benchmarkCents;
    let state: ListingPriceMatchState;
    if (!searchedAt) state = check?.last_attempt_status === "failed" ? "search_failed" : "not_searched";
    else if (same.length) state = "matched";
    else if (unsure.length) state = "unsure_only";
    else state = "none";
    return { ...listing, state, searchedAt, searchedBenchmarkCents: searchedBenchmark, stale, same, unsure };
  });
}

/** Listings the brand chose to ignore leave the list and both counts. */
export function withoutIgnored(
  listings: readonly ListingPriceMatches[],
  ignored: ReadonlySet<string> | ReadonlyMap<string, unknown>,
): ListingPriceMatches[] {
  return listings.filter((l) => !ignored.has(l.asin));
}

/** N of M: listings with a same-product match at today's benchmark, of the listings in scope. */
export function priceMatchCounts(listings: readonly ListingPriceMatches[]): { matched: number; total: number } {
  return {
    matched: listings.filter((l) => l.state === "matched" && !l.stale).length,
    total: listings.length,
  };
}

function dollars(value: number): string {
  return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "The price at 3 stores, including fender.com" (the going price) or "Found at 1 store". */
export function matchSummary(listing: ListingPriceMatches, brandDomains: readonly string[], brandSiteLabel: string): string | null {
  const stores = listing.same;
  if (!stores.length) return null;
  const brand = stores.some((s) =>
    brandDomains.some((d) => s.domain === d || (s.domain ?? "").endsWith(`.${d}`)),
  );
  if (stores.length === 1) return brand ? `Found at ${brandSiteLabel}` : "Found at 1 store";
  return `The price at ${stores.length} stores${brand ? `, including ${brandSiteLabel}` : ""}`;
}

/**
 * The next step, by the client's selling model (decision 4).
 * Brand-led: the brand prices its own Amazon offer. Partner-led: the brand cannot reprice; it asks
 * the authorized seller(s) holding the offer to price at the benchmark.
 */
export function priceMatchNextStep(
  model: SellingModel,
  listing: Pick<ListingPriceMatches, "benchmarkCents" | "offerSeller" | "offerSellerCount">,
): string {
  const price = dollars(listing.benchmarkCents);
  if (model === "Brand-led") return `Price the Amazon offer at the benchmark, ${price}.`;
  const seller = listing.offerSeller?.trim();
  if (!seller) return `Ask the authorized seller(s) holding this Amazon offer to price it at the benchmark, ${price}.`;
  const who = (listing.offerSellerCount ?? 1) > 1 ? "the authorized sellers holding" : "the authorized seller holding";
  return `Ask ${seller}, ${who} this Amazon offer, to price it at the benchmark, ${price}.`;
}

/** What the Price match cell says when there is no same-product match to list. */
export function noMatchText(listing: ListingPriceMatches): string {
  if (listing.state === "not_searched") return "Not searched yet";
  if (listing.state === "search_failed") return "Search did not complete";
  if (listing.state === "unsure_only") {
    const n = listing.unsure.length;
    return `${n} unsure ${n === 1 ? "match" : "matches"}, listed below`;
  }
  if (listing.state === "none" && listing.searchedBenchmarkCents != null) {
    return `Nothing at ${dollars(listing.searchedBenchmarkCents)}`;
  }
  return "No price match";
}

export const PRICE_MATCH_LINK_LABEL = "price match";

/** Tooltip on the list label. The caveat lives here, not on screen (Let the data speak). */
export const PRICE_MATCH_TIP =
  "An outside store selling the same product at exactly Amazon's reference price, landed (item plus shipping) or item price. Amazon does not name the retailer it used, so a match is where the price can be found, not a confirmed source. Searched on Bing Shopping when the reference price changes and once a week.";

export const UNSURE_TIP =
  "The price matches exactly, but the offer's title leaves out a detail needed to confirm the same product (finish, fingerboard, pickups or model). Open the page to check.";
