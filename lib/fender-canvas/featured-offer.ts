/**
 * Featured Offer readings from `public.canvas_retail_listings`.
 *
 * Four separate concepts, never interchangeable:
 *  - Featured Offer state: whether Amazon presents the purchasing offer. Source `featured_offer_state`.
 *  - Seller classification: who the observed seller is. Source `buybox_status`.
 *  - Active-offer state: whether a current offer exists. Source `featured_offer_state = 'no_active_offer'`.
 *  - Competitive External Price: Amazon's outside-price benchmark. Source `competitive_price_threshold_cents`.
 *
 * A missing result stays missing. A failed check stays a failure. Neither becomes zero or false.
 * MAP is not an input here and is not a Featured Offer concept.
 */

import { READING_STALE_AFTER_MS } from "./map-reading-status";

export type FeaturedOfferState =
  | "present"
  | "withheld"
  | "no_active_offer"
  | "check_failed"
  | "not_checked";

export type CompetitiveExternalPriceState =
  | "present"
  | "unavailable"
  | "check_failed"
  | "not_checked";

/** A classification the collector finished. `check_failed` and `not_checked` are not results. */
export const CLASSIFIED_STATES: readonly FeaturedOfferState[] = [
  "present",
  "withheld",
  "no_active_offer",
];

export const FEATURED_OFFER_STATE_LABELS = {
  present: "Buy Box present",
  withheld: "Buy Box Withheld",
  no_active_offer: "No active offer",
  check_failed: "Check failed",
  not_checked: "Not checked",
} as const satisfies Record<FeaturedOfferState, string>;

/** The collector writes this when catalog evidence, not Keepa, decided the state. */
export const CATALOG_SOURCE = "catalog.current_price";
export const KEEPA_SOURCE = "keepa";

/** Job that writes the Featured Offer reading. Its own clock, not the retail row's `updated_at`. */
export const FEATURED_OFFER_JOB = "featured_offer_keepa";

/**
 * Every Featured Offer field, read together so one row carries one observation.
 * `offer_price` is here only so the reading can refuse to use it as the current offer.
 */
export const FEATURED_OFFER_COLUMNS = [
  "asin",
  "model_name",
  "title",
  "offer_price",
  "buybox_status",
  "featured_offer_state",
  "featured_offer_withheld",
  "featured_offer_source",
  "featured_offer_checked_at",
  "featured_offer_attempted_at",
  "featured_offer_last_error",
  "competitive_external_price_state",
  "competitive_price_threshold_cents",
  "featured_offer_observed_price_cents",
  "featured_offer_observed_shipping_cents",
  "featured_offer_observed_seller",
].join(",");

export type FeaturedOfferRow = {
  asin?: string | null;
  model_name?: string | null;
  title?: string | null;
  /** Catalog price. Written by the hourly recompute, not by the Featured Offer read. */
  offer_price?: number | string | null;
  buybox_status?: string | null;
  featured_offer_state?: string | null;
  featured_offer_withheld?: boolean | null;
  featured_offer_source?: string | null;
  featured_offer_checked_at?: string | null;
  featured_offer_attempted_at?: string | null;
  featured_offer_last_error?: string | null;
  featured_offer_observed_price_cents?: number | string | null;
  featured_offer_observed_shipping_cents?: number | string | null;
  featured_offer_observed_seller?: string | null;
  competitive_external_price_state?: string | null;
  competitive_price_threshold_cents?: number | string | null;
};

function finite(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function millis(value: string | null | undefined): number | null {
  const at = text(value);
  if (!at) return null;
  const ms = new Date(at).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The stored state. An unwritten state is `not_checked`, never `present` and never a zero.
 * An unrecognized value is treated as unchecked rather than guessed into a result.
 */
export function featuredOfferState(row: FeaturedOfferRow): FeaturedOfferState {
  const stored = text(row.featured_offer_state);
  if (stored === "present") return "present";
  if (stored === "withheld") return "withheld";
  if (stored === "no_active_offer") return "no_active_offer";
  if (stored === "check_failed") return "check_failed";
  return "not_checked";
}

export function competitiveExternalPriceState(
  row: FeaturedOfferRow,
): CompetitiveExternalPriceState {
  const stored = text(row.competitive_external_price_state);
  if (stored === "present") return "present";
  if (stored === "unavailable") return "unavailable";
  if (stored === "check_failed") return "check_failed";
  return "not_checked";
}

/** Amazon's outside benchmark, in cents. Zero and negative are not a benchmark. */
export function benchmarkCents(row: FeaturedOfferRow): number | null {
  if (competitiveExternalPriceState(row) !== "present") return null;
  const cents = finite(row.competitive_price_threshold_cents);
  if (cents == null || cents <= 0) return null;
  return Math.round(cents);
}

/**
 * The landed offer observed by the same Keepa read as the state and the benchmark,
 * in cents. Item price plus shipping when Keepa reported shipping.
 * Null when that read stored no offer, including every `no_active_offer` row.
 */
export function observedOfferCents(row: FeaturedOfferRow): number | null {
  const price = finite(row.featured_offer_observed_price_cents);
  if (price == null || price <= 0) return null;
  const shipping = finite(row.featured_offer_observed_shipping_cents);
  const landed = shipping != null && shipping > 0 ? price + shipping : price;
  return Math.round(landed);
}

export function observedOfferDollars(row: FeaturedOfferRow): number | null {
  const cents = observedOfferCents(row);
  return cents == null ? null : cents / 100;
}

export function benchmarkDollars(row: FeaturedOfferRow): number | null {
  const cents = benchmarkCents(row);
  return cents == null ? null : cents / 100;
}

/** When the stored classification was last observed. Not the retail row's `updated_at`. */
export function checkedAtMs(row: FeaturedOfferRow): number | null {
  return millis(row.featured_offer_checked_at);
}

export function attemptedAtMs(row: FeaturedOfferRow): number | null {
  return millis(row.featured_offer_attempted_at);
}

/** A finished classification. The row carries a result and the time it was observed. */
export function hasClassification(row: FeaturedOfferRow): boolean {
  const state = featuredOfferState(row);
  if (!CLASSIFIED_STATES.includes(state)) return false;
  return checkedAtMs(row) != null;
}

export function isCurrentClassification(
  row: FeaturedOfferRow,
  now = Date.now(),
  window = READING_STALE_AFTER_MS,
): boolean {
  if (!hasClassification(row)) return false;
  const at = checkedAtMs(row);
  return at != null && now - at <= window;
}

/**
 * A failed attempt after the last success. The row still shows its last result,
 * and the failure is exposed beside it rather than replacing it.
 */
export function hasFailedAttempt(row: FeaturedOfferRow): boolean {
  if (text(row.featured_offer_last_error) == null) return false;
  if (featuredOfferState(row) === "check_failed") return true;
  const attempted = attemptedAtMs(row);
  const checked = checkedAtMs(row);
  if (attempted == null) return false;
  return checked == null || attempted > checked;
}

export function lastError(row: FeaturedOfferRow): string | null {
  return text(row.featured_offer_last_error);
}

/** Keepa decided this row. The catalog decided `no_active_offer` rows without a paid call. */
export function readFromKeepa(row: FeaturedOfferRow): boolean {
  return text(row.featured_offer_source) === KEEPA_SOURCE;
}

/** A catalog-confirmed no-active-offer row. No Keepa call is needed to keep it current. */
export function catalogConfirmedNoActiveOffer(row: FeaturedOfferRow): boolean {
  return (
    featuredOfferState(row) === "no_active_offer" &&
    text(row.featured_offer_source) === CATALOG_SOURCE
  );
}

/** Rows whose state can only come from a paid Keepa read. */
export function requiresKeepaRead(row: FeaturedOfferRow): boolean {
  return !catalogConfirmedNoActiveOffer(row);
}

/**
 * The offer and the benchmark belong to one Keepa observation, so the gap between
 * them is a real comparison. A catalog price refreshed on its own is not compatible.
 */
export function observationIsCompatible(row: FeaturedOfferRow): boolean {
  if (!readFromKeepa(row)) return false;
  if (checkedAtMs(row) == null) return false;
  return observedOfferCents(row) != null && benchmarkCents(row) != null;
}

/** Amount the observed offer sits above the benchmark, in dollars. Null unless comparable. */
export function aboveBenchmarkDollars(row: FeaturedOfferRow): number | null {
  if (!observationIsCompatible(row)) return null;
  const offer = observedOfferCents(row);
  const benchmark = benchmarkCents(row);
  if (offer == null || benchmark == null) return null;
  return (offer - benchmark) / 100;
}

/**
 * Confirmed high-price suppression. Every input must be current and compatible.
 * A withheld Featured Offer with no benchmark is still withheld. It is not this.
 */
export function isConfirmedHighPriceSuppression(row: FeaturedOfferRow): boolean {
  if (featuredOfferState(row) !== "withheld") return false;
  if (!observationIsCompatible(row)) return false;
  const offer = observedOfferCents(row);
  const benchmark = benchmarkCents(row);
  if (offer == null || benchmark == null) return false;
  return offer > benchmark;
}

/** Withheld, and no outside benchmark to compare against. Confirmed withheld, not suppression. */
export function isWithheldWithoutBenchmark(row: FeaturedOfferRow): boolean {
  if (featuredOfferState(row) !== "withheld") return false;
  return benchmarkCents(row) == null || observedOfferCents(row) == null;
}

/**
 * An older boolean with no v11 state. It is not coverage and not a current result.
 * The collector wrote `false` whenever Keepa returned no flag, so it is not a confirmed
 * Featured Offer either.
 */
export function isLegacyBooleanOnly(row: FeaturedOfferRow): boolean {
  if (featuredOfferState(row) !== "not_checked") return false;
  return row.featured_offer_withheld === true || row.featured_offer_withheld === false;
}

export type FeaturedOfferCounts = {
  /** Every row in the monitored retail population. */
  population: number;
  /** Rows whose state needs a paid Keepa read. Excludes catalog-confirmed no-active-offer rows. */
  requiresKeepa: number;
  /** Catalog-confirmed no-active-offer rows. No Keepa call needed. */
  catalogNoActiveOffer: number;
  present: number;
  withheld: number;
  noActiveOffer: number;
  checkFailed: number;
  notChecked: number;
  /** Finished classifications, current or stale. */
  classified: number;
  /** Finished classifications inside the freshness window. */
  current: number;
  /** Finished classifications older than the freshness window. */
  stale: number;
  /** Keepa classified the Featured Offer as present or withheld. Benchmark denominator. */
  keepaClassified: number;
  /** Classified rows with a positive outside benchmark. */
  benchmarkPresent: number;
  /** Classified rows where Keepa gave no benchmark. Not a failure, and not zero. */
  benchmarkUnavailable: number;
  /** Rows whose offer and benchmark came from one observation, so a gap is comparable. */
  comparable: number;
  /** Withheld, benchmark present, compatible observation, observed offer above the benchmark. */
  confirmedHighPrice: number;
  /** Withheld with no benchmark to compare. */
  withheldWithoutBenchmark: number;
  /** Rows carrying only the older boolean. Not coverage. */
  legacyBooleanOnly: number;
  /** Rows with a failure recorded after the last success. */
  failedAttempts: number;
  newestCheckedAt: string | null;
  oldestCheckedAt: string | null;
};

function emptyCounts(): FeaturedOfferCounts {
  return {
    population: 0,
    requiresKeepa: 0,
    catalogNoActiveOffer: 0,
    present: 0,
    withheld: 0,
    noActiveOffer: 0,
    checkFailed: 0,
    notChecked: 0,
    classified: 0,
    current: 0,
    stale: 0,
    keepaClassified: 0,
    benchmarkPresent: 0,
    benchmarkUnavailable: 0,
    comparable: 0,
    confirmedHighPrice: 0,
    withheldWithoutBenchmark: 0,
    legacyBooleanOnly: 0,
    failedAttempts: 0,
    newestCheckedAt: null,
    oldestCheckedAt: null,
  };
}

/** One pass over the retail rows. Every state is counted; none is folded into another. */
export function countFeaturedOffer(
  rows: FeaturedOfferRow[],
  now = Date.now(),
): FeaturedOfferCounts {
  const counts = emptyCounts();
  let newest: number | null = null;
  let oldest: number | null = null;

  for (const row of rows) {
    counts.population += 1;
    const state = featuredOfferState(row);
    if (state === "present") counts.present += 1;
    if (state === "withheld") counts.withheld += 1;
    if (state === "no_active_offer") counts.noActiveOffer += 1;
    if (state === "check_failed") counts.checkFailed += 1;
    if (state === "not_checked") counts.notChecked += 1;

    if (catalogConfirmedNoActiveOffer(row)) counts.catalogNoActiveOffer += 1;
    else counts.requiresKeepa += 1;

    if (hasClassification(row)) {
      counts.classified += 1;
      if (isCurrentClassification(row, now)) counts.current += 1;
      else counts.stale += 1;
      if (readFromKeepa(row) && (state === "present" || state === "withheld")) {
        counts.keepaClassified += 1;
        if (benchmarkCents(row) != null) counts.benchmarkPresent += 1;
        else counts.benchmarkUnavailable += 1;
      }
    }

    if (observationIsCompatible(row)) counts.comparable += 1;
    if (isConfirmedHighPriceSuppression(row)) counts.confirmedHighPrice += 1;
    if (isWithheldWithoutBenchmark(row)) counts.withheldWithoutBenchmark += 1;
    if (isLegacyBooleanOnly(row)) counts.legacyBooleanOnly += 1;
    if (hasFailedAttempt(row)) counts.failedAttempts += 1;

    const at = checkedAtMs(row);
    if (at != null) {
      if (newest == null || at > newest) newest = at;
      if (oldest == null || at < oldest) oldest = at;
    }
  }

  counts.newestCheckedAt = newest == null ? null : new Date(newest).toISOString();
  counts.oldestCheckedAt = oldest == null ? null : new Date(oldest).toISOString();
  return counts;
}

/** Rows for the Suppressed Listings table: confirmed suppression first, then withheld. */
export function withheldListings(rows: FeaturedOfferRow[]): FeaturedOfferRow[] {
  return rows
    .filter((row) => featuredOfferState(row) === "withheld")
    .sort((a, b) => {
      const gap = (aboveBenchmarkDollars(b) ?? -1) - (aboveBenchmarkDollars(a) ?? -1);
      if (gap !== 0) return gap;
      return (text(a.asin) ?? "").localeCompare(text(b.asin) ?? "");
    });
}

export function listingLabel(row: FeaturedOfferRow): string {
  return text(row.model_name) ?? text(row.title) ?? "Listing";
}
