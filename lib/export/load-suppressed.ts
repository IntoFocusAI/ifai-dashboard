import {
  featuredOfferColumnProbe,
  featuredOfferReadingCountQuery,
  suppressedListingsQuery,
} from "@/lib/canvasData";
import { buildSuppressedExport } from "@/lib/export/suppressed-export";
import type { BuiltExport } from "@/lib/export/types";
import type { FeaturedOfferCounts, FeaturedOfferRow } from "@/lib/fender-canvas/featured-offer";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";

const PAGE_SIZE = 1000;
const LISTINGS_FAILED = "The withheld listings could not be loaded.";

/**
 * Same steps as the Suppressed Listings table: probe the Featured Offer columns,
 * require a stored reading, then page `suppressedListingsQuery`. The query itself
 * is not rewritten here.
 */
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
    const loaded = rows.length;
    const total = count ?? loaded;
    if (loaded >= total || (data ?? []).length < PAGE_SIZE) return rows;
  }
  return null;
}

async function loadSuppressionContext(): Promise<{
  counts: FeaturedOfferCounts | null;
  missingMessage: string | null;
}> {
  try {
    const snapshot = await loadPortfolioRetailSnapshot();
    const reading = snapshot.suppressedListings;
    return {
      counts: reading.detail?.counts ?? null,
      missingMessage: reading.missingMessage,
    };
  } catch {
    return { counts: null, missingMessage: null };
  }
}

/** Withheld listings from the published query, or a failed read with no file. */
export async function loadSuppressedExport(): Promise<BuiltExport> {
  try {
    const [rows, context] = await Promise.all([loadWithheldRows(), loadSuppressionContext()]);
    if (!rows) return { model: { ok: false, message: LISTINGS_FAILED }, csv: null };
    return buildSuppressedExport({
      rows,
      counts: context.counts,
      missingMessage: context.missingMessage,
    });
  } catch {
    return { model: { ok: false, message: LISTINGS_FAILED }, csv: null };
  }
}
