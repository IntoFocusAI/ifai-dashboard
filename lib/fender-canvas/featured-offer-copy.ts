/**
 * Client-facing Featured Offer copy. Plain language for an operator.
 * Every sentence here names its own denominator. A missing result is never a zero.
 * Amazon does not name the outside retailer, and this copy never implies that it does.
 */

import { formatInt } from "./format";
import { FEATURED_OFFER_JOB, type FeaturedOfferCounts } from "./featured-offer";

/** Confirmed withheld above the outside benchmark. The strongest client-useful result. */
export const CONFIRMED_HIGH_PRICE_LABEL =
  "Buy Box withheld above Amazon's outside price";

/** Withheld with no outside benchmark stored. Still a confirmed withheld state. */
export const WITHHELD_LABEL = "Buy Box withheld";

export const FEATURED_OFFER_UNAVAILABLE =
  "The Buy Box audit has not stored a reading for any monitored listing yet.";

const checkedAtFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function formatCheckedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? checkedAtFormat.format(at) : null;
}

function listings(count: number): string {
  return count === 1 ? "listing" : "listings";
}

/**
 * The stronger label applies only when every withheld listing has a benchmark to
 * compare against. While some withheld listings have no outside price, the two counts
 * describe different sets, so the headline stays the confirmed state and the price
 * cause is named in the supporting sentence instead.
 */
export function leadsWithHighPrice(counts: FeaturedOfferCounts): boolean {
  return (
    counts.withheld > 0 &&
    counts.withheldWithoutBenchmark === 0 &&
    counts.confirmedHighPrice > 0
  );
}

/** The label the bubble, satellite, command center, roadmap, and tour all lead with. */
export function featuredOfferHeadlineLabel(counts: FeaturedOfferCounts): string {
  return leadsWithHighPrice(counts) ? CONFIRMED_HIGH_PRICE_LABEL : WITHHELD_LABEL;
}

/**
 * The count beside the label. Never every withheld listing called a price suppression,
 * and never the partial comparable subset passed off as the whole finding.
 */
export function featuredOfferHeadlineCount(counts: FeaturedOfferCounts): number {
  return leadsWithHighPrice(counts) ? counts.confirmedHighPrice : counts.withheld;
}

/** Coverage for the Featured Offer classification. Unchecked and failed rows stay visible. */
export function classificationCoverageSentence(counts: FeaturedOfferCounts): string {
  const parts = [
    `The Buy Box audit has a current reading for ${formatInt(counts.current)} of ${formatInt(
      counts.population,
    )} monitored ${listings(counts.population)}.`,
  ];

  if (counts.catalogNoActiveOffer > 0) {
    parts.push(
      `${formatInt(counts.catalogNoActiveOffer)} of those ${listings(
        counts.catalogNoActiveOffer,
      )} ${counts.catalogNoActiveOffer === 1 ? "has" : "have"} no active offer in the catalog, so ${
        counts.catalogNoActiveOffer === 1 ? "it needs" : "they need"
      } no Amazon check.`,
    );
  }

  if (counts.notChecked > 0) {
    parts.push(
      `${formatInt(counts.notChecked)} ${listings(counts.notChecked)} ${
        counts.notChecked === 1 ? "has" : "have"
      } not been checked yet.`,
    );
  }

  if (counts.checkFailed > 0) {
    parts.push(
      `${formatInt(counts.checkFailed)} ${listings(counts.checkFailed)} ${
        counts.checkFailed === 1 ? "failed its" : "failed their"
      } last check.`,
    );
  }

  if (counts.stale > 0) {
    parts.push(
      `${formatInt(counts.stale)} stored ${listings(counts.stale)} ${
        counts.stale === 1 ? "is" : "are"
      } older than 26 hours.`,
    );
  }

  parts.push("Listings without a current reading are missing from these counts and are not counted as zero.");
  return parts.join(" ");
}

/** True while the audit has not yet produced a current reading for every eligible listing. */
export function firstPassIncomplete(counts: FeaturedOfferCounts): boolean {
  return counts.current < counts.population;
}

/** Tooltip on the unpublished-benchmark count: what an unpublished benchmark is and is not. */
export const BENCHMARK_UNPUBLISHED_TITLE = "No published benchmark";
export const BENCHMARK_UNPUBLISHED_TIP =
  "Amazon finished the check and published no outside price for these listings. That is not a failed check and not a price of zero.";

/** Tooltip on a blank gap cell: why there is nothing to compare. */
export const NO_COMPARABLE_PAIR_LABEL = "No comparable pair";
export const NO_COMPARABLE_PAIR_TIP =
  "This reading has no observed offer and outside price from one check to compare yet. It is not a gap of zero.";

/** Tooltip on the coverage-exceptions count: how failed and unchecked listings are counted. */
export const COVERAGE_EXCEPTIONS_TIP =
  "A failed check is not counted as present and not counted as zero. A failed check is not an unchecked listing.";

/**
 * Benchmark coverage in three parts, so the screen can hang the caveat on the count it
 * belongs to. `figure` is the unpublished count ("the other 177"), null when there is none.
 */
export function benchmarkCoverageParts(counts: FeaturedOfferCounts): {
  before: string;
  figure: string | null;
  after: string;
} {
  if (counts.keepaClassified === 0) {
    return {
      before:
        "No listing has a finished Amazon Buy Box check yet, so the outside-price benchmark has no coverage to report.",
      figure: null,
      after: "",
    };
  }
  const lead = `Amazon's outside price is stored for ${formatInt(
    counts.benchmarkPresent,
  )} of ${formatInt(counts.keepaClassified)} checked ${listings(
    counts.keepaClassified,
  )}. Amazon does not name the retailer behind that price.`;
  if (counts.benchmarkUnavailable === 0) return { before: lead, figure: null, after: "" };
  return {
    before: `${lead} Amazon did not publish a benchmark for `,
    figure: `the other ${formatInt(counts.benchmarkUnavailable)}`,
    after: ".",
  };
}

/** Benchmark coverage as one sentence. The caveat on the unpublished count lives in its tooltip. */
export function benchmarkCoverageSentence(counts: FeaturedOfferCounts): string {
  const parts = benchmarkCoverageParts(counts);
  return `${parts.before}${parts.figure ?? ""}${parts.after}`;
}

/** Confirmed suppression, stated so a withheld listing with no benchmark is not swept in. */
export function confirmedSuppressionSentence(counts: FeaturedOfferCounts): string {
  if (counts.withheld === 0) {
    return "No monitored listing has a confirmed withheld Buy Box in the current reading.";
  }
  const lead = `${formatInt(counts.withheld)} ${listings(counts.withheld)} ${
    counts.withheld === 1 ? "has" : "have"
  } a confirmed withheld Buy Box.`;
  const confirmed =
    counts.confirmedHighPrice > 0
      ? ` ${formatInt(counts.confirmedHighPrice)} of ${
          counts.confirmedHighPrice === 1 ? "those is" : "those are"
        } priced above Amazon's outside price in the same check.`
      : " None is confirmed above Amazon's outside price in the same check.";
  const withoutBenchmark =
    counts.withheldWithoutBenchmark > 0
      ? ` ${formatInt(counts.withheldWithoutBenchmark)} ${
          counts.withheldWithoutBenchmark === 1 ? "has" : "have"
        } no outside price and offer from one check to compare, so ${
          counts.withheldWithoutBenchmark === 1 ? "it is" : "they are"
        } withheld without a confirmed price cause.`
      : "";
  return `${lead}${confirmed}${withoutBenchmark}`;
}

export type FeaturedOfferJobState = {
  job_key: string;
  last_run_at: string | null;
};

export function featuredOfferJob(
  rows: readonly FeaturedOfferJobState[] | null | undefined,
): FeaturedOfferJobState | null {
  if (!rows) return null;
  return rows.find((row) => row.job_key === FEATURED_OFFER_JOB) ?? null;
}

/**
 * Featured Offer freshness. Reads the classification time and the collector's own job
 * clock. The hourly catalog job is not an input, so a fresh catalog cannot make this
 * reading look fresher than it is.
 */
export function featuredOfferFreshnessSentence(
  counts: FeaturedOfferCounts,
  job?: FeaturedOfferJobState | null,
): string {
  const newest = formatCheckedAt(counts.newestCheckedAt);
  const parts: string[] = [];
  parts.push(
    newest
      ? `Latest successful Buy Box check ${newest}.`
      : "No Buy Box check has succeeded yet.",
  );
  parts.push(
    `${formatInt(counts.current)} of ${formatInt(counts.population)} monitored ${listings(
      counts.population,
    )} have a current reading.`,
  );
  if (counts.notChecked > 0 || counts.checkFailed > 0) {
    parts.push(
      `${formatInt(counts.notChecked)} unchecked and ${formatInt(counts.checkFailed)} failed.`,
    );
  }
  parts.push(
    firstPassIncomplete(counts)
      ? "The audit queue is still completing its first full pass."
      : "The audit queue has completed a full pass.",
  );
  const runAt = formatCheckedAt(job?.last_run_at ?? null);
  if (runAt) parts.push(`Collector last ran ${runAt}.`);
  return parts.join(" ");
}
