import {
  featuredOfferColumnProbe,
  featuredOfferReadingCountQuery,
  suppressedListingsQuery,
} from "@/lib/canvasData";
import type { SourceRead } from "@/lib/export/types";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import {
  aboveBenchmarkDollars,
  benchmarkDollars,
  competitiveExternalPriceState,
  listingLabel,
  observedOfferDollars,
  withheldListings,
  type FeaturedOfferRow,
} from "@/lib/fender-canvas/featured-offer";
import { confirmedSuppressionSentence, formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatUsd } from "@/lib/fender-canvas/format";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";

const PAGE_SIZE = 1000;
const LISTINGS_FAILED = "The withheld listings could not be loaded.";

/** Same steps as the Suppressed Listings table: probe, require a stored reading, then page the query. */
async function loadWithheldRows(): Promise<FeaturedOfferRow[] | null> {
  const probe = await featuredOfferColumnProbe();
  if (probe.error || !probe.present) return null;
  const reading = await featuredOfferReadingCountQuery();
  if (reading.error || !reading.count) return null;
  const rows: FeaturedOfferRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error, count } = await suppressedListingsQuery(page, PAGE_SIZE);
    if (error) return null;
    rows.push(...((data ?? []) as FeaturedOfferRow[]));
    if (rows.length >= (count ?? rows.length) || (data ?? []).length < PAGE_SIZE) return withheldListings(rows);
  }
  return null;
}

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
  return [
    listingLabel(row),
    typeof row.asin === "string" ? row.asin : "",
    offer != null ? formatUsd(offer) : "Not observed",
    benchmarkCell(row),
    gap != null ? formatUsd(gap, { signed: true }) : "No comparable pair",
    formatCheckedAt(row.featured_offer_checked_at) ?? "Never",
  ];
}

export async function loadSuppressedSource(): Promise<SourceRead> {
  try {
    const [rows, snapshot] = await Promise.all([
      loadWithheldRows(),
      loadPortfolioRetailSnapshot().catch(() => null),
    ]);
    if (!rows) return { ok: false, message: LISTINGS_FAILED };
    const reading = snapshot?.suppressedListings ?? null;
    const counts = reading?.detail?.counts ?? null;
    return {
      ok: true,
      source: {
        table: "suppressed-listings",
        header: ["Listing", "ASIN", "Observed offer", "Competitive External Price", "Above benchmark", "Checked"],
        rows: rows.map((row) => ({
          key: typeof row.asin === "string" ? row.asin : "",
          cells: suppressedListingCells(row),
        })),
        filter: "Featured Offer state is withheld.",
        sort: "Above benchmark, highest first, then ASIN.",
        population: counts ? confirmedSuppressionSentence(counts) : (reading?.missingMessage ?? READ_NOT_AVAILABLE),
        asOf: counts ? (formatCheckedAt(counts.newestCheckedAt) ?? READ_NOT_AVAILABLE) : READ_NOT_AVAILABLE,
        setAsideCheck: SET_ASIDE_CHECKS.buyboxSuppression,
      },
    };
  } catch {
    return { ok: false, message: LISTINGS_FAILED };
  }
}
