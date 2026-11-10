// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/featured-offer.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aboveBenchmarkDollars,
  benchmarkCents,
  checkedAtMs,
  competitiveExternalPriceState,
  countFeaturedOffer,
  FEATURED_OFFER_COLUMNS,
  FEATURED_OFFER_STATE_LABELS,
  featuredOfferState,
  hasClassification,
  hasFailedAttempt,
  isConfirmedHighPriceSuppression,
  isCurrentClassification,
  isLegacyBooleanOnly,
  isWithheldWithoutBenchmark,
  lastError,
  observationIsCompatible,
  observedOfferCents,
  observedOfferDollars,
  requiresKeepaRead,
  withheldListings,
  type FeaturedOfferRow,
} from "../lib/fender-canvas/featured-offer.ts";
import {
  BENCHMARK_UNPUBLISHED_TIP,
  benchmarkCoverageParts,
  benchmarkCoverageSentence,
  classificationCoverageSentence,
  confirmedSuppressionSentence,
  featuredOfferFreshnessSentence,
  featuredOfferHeadlineCount,
  featuredOfferHeadlineLabel,
  featuredOfferJob,
  firstPassIncomplete,
} from "../lib/fender-canvas/featured-offer-copy.ts";

const NOW = Date.parse("2026-10-12T13:00:00.000Z");
const FRESH = "2026-10-12T12:41:16.000Z";
const OLD = "2026-10-09T08:00:00.000Z";

function row(overrides: Partial<FeaturedOfferRow> = {}): FeaturedOfferRow {
  return {
    asin: "B0EQ000000",
    model_name: "Player II Stratocaster",
    offer_price: 949.99,
    buybox_status: "Unknown/Not Harvested",
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: FRESH,
    featured_offer_attempted_at: FRESH,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 37198,
    featured_offer_observed_price_cents: 43306,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
    ...overrides,
  };
}

/* The four live proving rows, as the collector stored them on 2026-10-12. */
const B0D8G43XJP = row({ asin: "B0D8G43XJP", offer_price: 433.06 });
const B07N28P3W9 = row({
  asin: "B07N28P3W9",
  buybox_status: "Amazon 1P",
  featured_offer_state: "present",
  featured_offer_withheld: false,
  competitive_price_threshold_cents: 56999,
  featured_offer_observed_price_cents: 56999,
  featured_offer_observed_shipping_cents: 0,
  featured_offer_observed_seller: "ATVPDKIKX0DER",
});
const B0002DURRG = row({
  asin: "B0002DURRG",
  buybox_status: "3P Confirmed",
  featured_offer_state: "present",
  featured_offer_withheld: false,
  competitive_external_price_state: "unavailable",
  competitive_price_threshold_cents: null,
  featured_offer_observed_price_cents: 1699,
  featured_offer_observed_shipping_cents: 0,
});
const B003BG5OVK = row({
  asin: "B003BG5OVK",
  buybox_status: "No Active Offer",
  offer_price: 29.99,
  featured_offer_state: "no_active_offer",
  featured_offer_withheld: null,
  featured_offer_source: "catalog.current_price",
  competitive_external_price_state: null,
  competitive_price_threshold_cents: null,
  featured_offer_observed_price_cents: null,
  featured_offer_observed_shipping_cents: null,
});
/* Withheld with no benchmark Amazon published. */
const B0073AMZCG = row({
  asin: "B0073AMZCG",
  offer_price: 399.99,
  competitive_external_price_state: "unavailable",
  competitive_price_threshold_cents: null,
  featured_offer_observed_price_cents: 39999,
});
const CHECK_FAILED = row({
  asin: "B0EQFAILED",
  featured_offer_state: "check_failed",
  featured_offer_withheld: null,
  featured_offer_checked_at: null,
  featured_offer_attempted_at: FRESH,
  featured_offer_last_error: "missing_from_keepa",
  competitive_external_price_state: "check_failed",
  competitive_price_threshold_cents: null,
  featured_offer_observed_price_cents: null,
});
const NOT_CHECKED = row({
  asin: "B0EQNOTCHK",
  featured_offer_state: null,
  featured_offer_withheld: null,
  featured_offer_source: null,
  featured_offer_checked_at: null,
  featured_offer_attempted_at: null,
  competitive_external_price_state: null,
  competitive_price_threshold_cents: null,
  featured_offer_observed_price_cents: null,
});

test("each stored state reads back as itself, and an unwritten state is not checked", () => {
  assert.equal(featuredOfferState(B07N28P3W9), "present");
  assert.equal(featuredOfferState(B0D8G43XJP), "withheld");
  assert.equal(featuredOfferState(B003BG5OVK), "no_active_offer");
  assert.equal(featuredOfferState(CHECK_FAILED), "check_failed");
  assert.equal(featuredOfferState(NOT_CHECKED), "not_checked");
  assert.equal(featuredOfferState(row({ featured_offer_state: "something_else" })), "not_checked");

  assert.equal(FEATURED_OFFER_STATE_LABELS.present, "Buy Box present");
  assert.equal(FEATURED_OFFER_STATE_LABELS.withheld, "Buy Box withheld");
  assert.equal(FEATURED_OFFER_STATE_LABELS.no_active_offer, "No active offer");
  assert.equal(FEATURED_OFFER_STATE_LABELS.check_failed, "Check failed");
  assert.equal(FEATURED_OFFER_STATE_LABELS.not_checked, "Not checked");

  assert.equal(hasClassification(B07N28P3W9), true);
  assert.equal(hasClassification(CHECK_FAILED), false);
  assert.equal(hasClassification(NOT_CHECKED), false);
  assert.equal(requiresKeepaRead(B003BG5OVK), false);
  assert.equal(requiresKeepaRead(B0D8G43XJP), true);
});

test("a missing benchmark stays missing and is never a zero", () => {
  assert.equal(competitiveExternalPriceState(B0002DURRG), "unavailable");
  assert.equal(benchmarkCents(B0002DURRG), null);
  assert.equal(competitiveExternalPriceState(NOT_CHECKED), "not_checked");
  assert.equal(benchmarkCents(NOT_CHECKED), null);
  assert.equal(competitiveExternalPriceState(CHECK_FAILED), "check_failed");
  assert.equal(benchmarkCents(CHECK_FAILED), null);

  // A stored non-positive sentinel is not a benchmark either.
  assert.equal(benchmarkCents(row({ competitive_price_threshold_cents: 0 })), null);
  assert.equal(benchmarkCents(row({ competitive_price_threshold_cents: -1 })), null);
  // A threshold left behind without a present state is refused.
  assert.equal(
    benchmarkCents(row({ competitive_external_price_state: null, competitive_price_threshold_cents: 264999 })),
    null,
  );
});

test("withheld with no benchmark is confirmed withheld, not a price suppression", () => {
  assert.equal(featuredOfferState(B0073AMZCG), "withheld");
  assert.equal(isWithheldWithoutBenchmark(B0073AMZCG), true);
  assert.equal(isConfirmedHighPriceSuppression(B0073AMZCG), false);
  assert.equal(aboveBenchmarkDollars(B0073AMZCG), null);
});

test("a present Featured Offer with a benchmark is not a suppression", () => {
  assert.equal(isConfirmedHighPriceSuppression(B07N28P3W9), false);
  assert.equal(benchmarkCents(B07N28P3W9), 56999);
  assert.equal(observedOfferCents(B07N28P3W9), 56999);
});

test("an offer at or below the benchmark is not a suppression", () => {
  const atBenchmark = row({ featured_offer_observed_price_cents: 37198 });
  assert.equal(observedOfferCents(atBenchmark), 37198);
  assert.equal(isConfirmedHighPriceSuppression(atBenchmark), false);

  const below = row({ featured_offer_observed_price_cents: 30000 });
  assert.equal(isConfirmedHighPriceSuppression(below), false);
  assert.equal(aboveBenchmarkDollars(below), -71.98);
});

test("withheld above the benchmark from one observation is a suppression", () => {
  assert.equal(observationIsCompatible(B0D8G43XJP), true);
  assert.equal(isConfirmedHighPriceSuppression(B0D8G43XJP), true);
  assert.equal(observedOfferDollars(B0D8G43XJP), 433.06);
  assert.equal(aboveBenchmarkDollars(B0D8G43XJP), 61.08);

  // Shipping counts toward the landed offer only when Keepa reported it.
  const shipped = row({
    featured_offer_observed_price_cents: 37000,
    featured_offer_observed_shipping_cents: 500,
  });
  assert.equal(observedOfferCents(shipped), 37500);
  assert.equal(isConfirmedHighPriceSuppression(shipped), true);
});

test("a catalog offer price is never used as the observed offer", () => {
  // offer_price of 949.99 is above the benchmark, but this reading did not observe it.
  const noObservation = row({ featured_offer_observed_price_cents: null });
  assert.equal(observedOfferCents(noObservation), null);
  assert.equal(observationIsCompatible(noObservation), false);
  assert.equal(isConfirmedHighPriceSuppression(noObservation), false);
  assert.equal(aboveBenchmarkDollars(noObservation), null);

  // A catalog-sourced state is not a Keepa observation, so it is never comparable.
  const catalogSourced = row({ featured_offer_source: "catalog.current_price" });
  assert.equal(observationIsCompatible(catalogSourced), false);
  assert.equal(isConfirmedHighPriceSuppression(catalogSourced), false);
});

test("the older withheld boolean alone is not a v11 reading", () => {
  const legacyTrue = row({
    featured_offer_state: null,
    featured_offer_withheld: true,
    featured_offer_checked_at: null,
    featured_offer_source: null,
  });
  const legacyFalse = row({
    featured_offer_state: null,
    featured_offer_withheld: false,
    featured_offer_checked_at: null,
    featured_offer_source: null,
  });
  assert.equal(isLegacyBooleanOnly(legacyTrue), true);
  assert.equal(isLegacyBooleanOnly(legacyFalse), true);
  assert.equal(isLegacyBooleanOnly(B0D8G43XJP), false);

  const counts = countFeaturedOffer([legacyTrue, legacyFalse], NOW);
  assert.equal(counts.legacyBooleanOnly, 2);
  assert.equal(counts.classified, 0);
  assert.equal(counts.current, 0);
  assert.equal(counts.withheld, 0);
  assert.equal(counts.notChecked, 2);
  assert.equal(counts.confirmedHighPrice, 0);
});

test("a failed attempt keeps the last successful state and exposes the failure", () => {
  const failedAfterSuccess = row({
    featured_offer_state: "withheld",
    featured_offer_checked_at: FRESH,
    featured_offer_attempted_at: "2026-10-12T12:55:00.000Z",
    featured_offer_last_error: "missing_from_keepa",
  });
  assert.equal(featuredOfferState(failedAfterSuccess), "withheld");
  assert.equal(hasClassification(failedAfterSuccess), true);
  assert.equal(hasFailedAttempt(failedAfterSuccess), true);
  assert.equal(lastError(failedAfterSuccess), "missing_from_keepa");
  // The failure does not become false, zero, or a present Featured Offer.
  assert.equal(failedAfterSuccess.featured_offer_withheld, true);
  assert.equal(isConfirmedHighPriceSuppression(failedAfterSuccess), true);

  assert.equal(hasFailedAttempt(CHECK_FAILED), true);
  assert.equal(hasFailedAttempt(B0D8G43XJP), false);
  assert.equal(checkedAtMs(CHECK_FAILED), null);
});

test("a no-active-offer row exposes no current offer, so no stale price can be shown", () => {
  assert.equal(featuredOfferState(B003BG5OVK), "no_active_offer");
  assert.equal(B003BG5OVK.offer_price, 29.99);
  assert.equal(observedOfferCents(B003BG5OVK), null);
  assert.equal(observedOfferDollars(B003BG5OVK), null);
  assert.equal(B003BG5OVK.featured_offer_withheld, null);
  assert.equal(isConfirmedHighPriceSuppression(B003BG5OVK), false);
  assert.equal(isWithheldWithoutBenchmark(B003BG5OVK), false);
});

test("coverage keeps failures and unchecked rows in the denominator", () => {
  const rows = [B0D8G43XJP, B07N28P3W9, B0002DURRG, B0073AMZCG, B003BG5OVK, CHECK_FAILED, NOT_CHECKED];
  const counts = countFeaturedOffer(rows, NOW);

  assert.equal(counts.population, 7);
  assert.equal(counts.present, 2);
  assert.equal(counts.withheld, 2);
  assert.equal(counts.noActiveOffer, 1);
  assert.equal(counts.checkFailed, 1);
  assert.equal(counts.notChecked, 1);
  // Every state adds up to the population. None is folded into another.
  assert.equal(
    counts.present + counts.withheld + counts.noActiveOffer + counts.checkFailed + counts.notChecked,
    counts.population,
  );

  assert.equal(counts.classified, 5);
  assert.equal(counts.current, 5);
  assert.equal(counts.stale, 0);
  assert.equal(counts.catalogNoActiveOffer, 1);
  assert.equal(counts.requiresKeepa, 6);

  assert.equal(counts.keepaClassified, 4);
  assert.equal(counts.benchmarkPresent, 2);
  assert.equal(counts.benchmarkUnavailable, 2);
  assert.equal(counts.confirmedHighPrice, 1);
  assert.equal(counts.withheldWithoutBenchmark, 1);
  // Only the two rows holding both an observed offer and a benchmark are comparable.
  assert.equal(counts.comparable, 2);
  assert.equal(counts.failedAttempts, 1);

  const coverage = classificationCoverageSentence(counts);
  assert.match(coverage, /5 of 7/);
  assert.match(coverage, /1 listing has not been checked yet/);
  assert.match(coverage, /1 listing failed its last check/);
  assert.match(coverage, /not counted as zero/);

  const benchmark = benchmarkCoverageSentence(counts);
  assert.match(benchmark, /2 of 4/);
  // Let the data speak: the sentence states what was found. What an unpublished benchmark
  // is not lives in the tooltip on its count.
  assert.match(benchmark, /did not publish a benchmark for the other 2\.$/);
  assert.doesNotMatch(benchmark, /not a failed check/);
  assert.match(BENCHMARK_UNPUBLISHED_TIP, /not a failed check and not a price of zero/);
  assert.deepEqual(benchmarkCoverageParts(counts).figure, "the other 2");
  assert.match(benchmark, /does not name/i);

  const confirmed = confirmedSuppressionSentence(counts);
  assert.match(confirmed, /2 listings have a confirmed withheld Buy Box/);
  assert.match(confirmed, /1 of those is priced above Amazon's outside price/);
  assert.match(confirmed, /withheld without a confirmed price cause/);

  // A withheld listing with no benchmark is present, so the plain label leads.
  assert.equal(featuredOfferHeadlineLabel(counts), "Buy Box withheld");
  assert.equal(featuredOfferHeadlineCount(counts), 2);
  assert.equal(firstPassIncomplete(counts), true);
});

test("the stronger label applies only when every withheld listing has a benchmark", () => {
  const counts = countFeaturedOffer([B0D8G43XJP, B07N28P3W9], NOW);
  assert.equal(counts.withheldWithoutBenchmark, 0);
  assert.equal(counts.confirmedHighPrice, 1);
  assert.equal(featuredOfferHeadlineLabel(counts), "Buy Box withheld above Amazon's outside price");
  assert.equal(featuredOfferHeadlineCount(counts), 1);
  assert.equal(firstPassIncomplete(counts), false);
});

test("freshness reads the Featured Offer clock, not the retail row timestamp", () => {
  const stale = row({ featured_offer_checked_at: OLD });
  assert.equal(isCurrentClassification(stale, NOW), false);
  assert.equal(hasClassification(stale), true);

  const counts = countFeaturedOffer([B0D8G43XJP, stale, NOT_CHECKED], NOW);
  assert.equal(counts.current, 1);
  assert.equal(counts.stale, 1);
  assert.equal(counts.newestCheckedAt, FRESH);
  assert.equal(counts.oldestCheckedAt, OLD);

  const job = featuredOfferJob([
    { job_key: "catalog_harvester", last_run_at: "2026-10-12T13:00:52.000Z" },
    { job_key: "featured_offer_keepa", last_run_at: "2026-10-12T12:41:16.000Z" },
  ]);
  assert.equal(job?.job_key, "featured_offer_keepa");

  const sentence = featuredOfferFreshnessSentence(counts, job);
  assert.match(sentence, /Latest successful Buy Box check/);
  assert.match(sentence, /1 of 3 monitored listings have a current reading/);
  assert.match(sentence, /still completing its first full pass/);
  // The newer catalog job must not appear as the Featured Offer time.
  assert.doesNotMatch(sentence, /13:00/);
  assert.equal(featuredOfferJob([{ job_key: "catalog_harvester", last_run_at: "x" }]), null);
});

test("the read selects the Featured Offer fields and not the row updated_at", () => {
  for (const column of [
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
  ]) {
    assert.ok(FEATURED_OFFER_COLUMNS.split(",").includes(column), column);
  }
  assert.ok(!FEATURED_OFFER_COLUMNS.split(",").includes("updated_at"));
  assert.ok(!FEATURED_OFFER_COLUMNS.split(",").includes("map_price"));
});

test("the withheld table lists every withheld listing, comparable gaps first", () => {
  const listed = withheldListings([B0073AMZCG, B07N28P3W9, B0D8G43XJP, B003BG5OVK, NOT_CHECKED]);
  assert.deepEqual(
    listed.map((entry) => entry.asin),
    ["B0D8G43XJP", "B0073AMZCG"],
  );
});
