import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import {
  aboveBenchmarkDollars,
  benchmarkDollars,
  competitiveExternalPriceState,
  listingLabel,
  observedOfferDollars,
  withheldListings,
  type FeaturedOfferCounts,
  type FeaturedOfferRow,
} from "@/lib/fender-canvas/featured-offer";
import { confirmedSuppressionSentence, formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatUsd } from "@/lib/fender-canvas/format";
import { csvDocument, provenanceRows } from "@/lib/export/csv";
import type { BuiltExport } from "@/lib/export/types";

export const SUPPRESSED_EXPORT_HREF = "/dashboard/export/suppressed";
export const SUPPRESSED_EXPORT_FILENAME = "suppressed-listings.csv";

/** The filter `suppressedListingsQuery` applies: featured_offer_state = withheld. */
export const SUPPRESSED_FILTER = "Featured Offer state is withheld.";

/** The order the Suppressed Listings table shows before a column header is clicked. */
export const SUPPRESSED_SORT = "Above benchmark, highest first, then ASIN.";

const READING_FAILED = "The Buy Box reading could not be loaded.";

export const SUPPRESSED_COLUMNS = [
  "Listing",
  "ASIN",
  "Observed offer",
  "Competitive External Price",
  "Above benchmark",
  "Checked",
] as const;

function benchmarkCell(row: FeaturedOfferRow): string {
  const benchmark = benchmarkDollars(row);
  if (benchmark != null) return formatUsd(benchmark);
  const state = competitiveExternalPriceState(row);
  if (state === "unavailable") return "Not published by Amazon";
  if (state === "check_failed") return "Check failed";
  return "Not checked";
}

/** The same cell text the Suppressed Listings table shows for one withheld row. */
export function suppressedListingCells(row: FeaturedOfferRow): string[] {
  const offer = observedOfferDollars(row);
  const gap = aboveBenchmarkDollars(row);
  const asin = typeof row.asin === "string" ? row.asin : "";
  return [
    listingLabel(row),
    asin,
    offer != null ? formatUsd(offer) : "Not observed",
    benchmarkCell(row),
    gap != null ? formatUsd(gap, { signed: true }) : "No comparable pair",
    formatCheckedAt(row.featured_offer_checked_at) ?? "Never",
  ];
}

export function buildSuppressedExport(input: {
  rows: FeaturedOfferRow[];
  counts: FeaturedOfferCounts | null;
  missingMessage: string | null;
}): BuiltExport {
  const ordered = withheldListings(input.rows);
  const failed = input.counts == null;
  const population = input.counts
    ? confirmedSuppressionSentence(input.counts)
    : input.missingMessage ?? READING_FAILED;
  const asOf = input.counts
    ? formatCheckedAt(input.counts.newestCheckedAt) ?? READ_NOT_AVAILABLE
    : READ_NOT_AVAILABLE;
  const provenance = {
    filter: SUPPRESSED_FILTER,
    sort: SUPPRESSED_SORT,
    asOf,
    population,
  };
  const csv = csvDocument([
    ...provenanceRows(provenance),
    [...SUPPRESSED_COLUMNS],
    ...ordered.map(suppressedListingCells),
  ]);
  return {
    model: {
      ok: true,
      href: SUPPRESSED_EXPORT_HREF,
      provenance,
      failures: failed ? [READING_FAILED] : [],
    },
    csv,
  };
}
