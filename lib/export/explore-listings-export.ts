import { loadRetailListings } from "@/lib/canvasData";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import type { SourceRead } from "@/lib/export/types";
import { formatInt, formatUsd, pendingLabel } from "@/lib/fender-canvas/format";
import { anyListingReviewCount, listingReviewLabel } from "@/lib/fender-canvas/listing-reviews";
import {
  exploreChannelColumns,
  listingChannelFacts,
  missingCheckedPageLabel,
  shownChannelGap,
} from "@/lib/fender-canvas/map-channels";

const FAILED = "The listing read could not be loaded.";

function cellText(price: number | null, gap: number | null, note: string | null): string {
  if (price == null && gap == null) return "";
  const shown = shownChannelGap(gap);
  return [price != null ? formatUsd(price) : null, shown != null ? formatUsd(shown, { signed: true }) : null, note]
    .filter(Boolean)
    .join(" ");
}

/**
 * Every listing in the retail read, in the order and columns Explore all listings shows before
 * a header is clicked. The screen's All, MAP violations only, and Bundles only choices arrive
 * as the row keys on screen, so this read applies no filter of its own.
 */
export async function loadExploreListingsSource(): Promise<SourceRead> {
  try {
    // R-10: retailer prices come from the client's retailer list and its price-check rows.
    const [loaded, asOf] = await Promise.all([loadRetailListings(), loadDashboardAsOf()]);
    const rows = loaded.rows;
    const channels = exploreChannelColumns(
      rows,
      loaded.retailers.map((retailer) => retailer.key),
    );
    const showReviews = anyListingReviewCount(rows);
    const header = [
      "Listing",
      "ASIN",
      "Partner / Bundle",
      "MAP",
      ...channels.map((channel) => channel.name),
      ...(showReviews ? ["Reviews"] : []),
      "Channels",
    ];
    const body = rows.map((row) => {
      const facts = new Map(listingChannelFacts(row).map((fact) => [fact.key, fact]));
      const hrefFor = (key: string): { href: string | null; requirePage: boolean } =>
        key === "amazon" ? { href: null, requirePage: false } : { href: facts.get(key)?.url ?? null, requirePage: true };
      return {
        key: row.asin,
        cells: [
          row.model_name?.trim() || row.title?.trim() || "Listing",
          row.asin,
          row.bundle_name ?? row.buybox_seller_name ?? "n/a",
          row.map_price != null ? formatUsd(row.map_price) : pendingLabel(),
          ...channels.map((channel) => {
            const fact = facts.get(channel.key);
            const { href, requirePage } = hrefFor(channel.key);
            return cellText(
              fact?.price ?? null,
              fact?.gap ?? null,
              missingCheckedPageLabel(requirePage, href, fact?.price),
            );
          }),
          ...(showReviews ? [listingReviewLabel(row.reviews_count)] : []),
          row.channels?.trim() || "n/a",
        ],
      };
    });
    return {
      ok: true,
      source: {
        table: "explore-listings",
        header,
        rows: body,
        filter: null,
        sort: "Largest price gap below MAP first.",
        population: `${formatInt(rows.length)} monitored listings.`,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}
