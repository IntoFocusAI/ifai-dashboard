import { listingChannelPricesQuery, listingsQuery } from "@/lib/canvasData";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import type { SourceRead } from "@/lib/export/types";
import { formatInt, formatUsd, pendingLabel } from "@/lib/fender-canvas/format";
import { loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import { anyListingReviewCount, listingReviewLabel } from "@/lib/fender-canvas/listing-reviews";
import {
  channelPriceLookup,
  exploreChannelColumns,
  listingChannelFacts,
  mapSourceRow,
  missingCheckedPageLabel,
  musiciansFriendCheckedPageUrl,
  storedHttpUrl,
  type ChannelPriceRow,
} from "@/lib/fender-canvas/map-channels";
import type { CanvasRetailListingRow } from "@/lib/fender-canvas/types";

const PAGE_SIZE = 1000;
const FAILED = "The listing read could not be loaded.";

async function loadPrices(): Promise<ChannelPriceRow[]> {
  const rows: ChannelPriceRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await listingChannelPricesQuery(page, PAGE_SIZE);
    if (error) return page === 0 ? [] : rows;
    const batch = (data ?? []) as ChannelPriceRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  return rows;
}

function cellText(price: number | null, gap: number | null, note: string | null): string {
  if (price == null && gap == null) return "";
  return [price != null ? formatUsd(price) : null, gap != null ? formatUsd(gap, { signed: true }) : null, note]
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
    const [loaded, prices, asOf] = await Promise.all([
      loadFilteredPages(async (page, size) => {
        const { data, error, count } = await listingsQuery(page, size);
        return { data: (data ?? []) as CanvasRetailListingRow[], error, count };
      }),
      loadPrices(),
      loadDashboardAsOf(),
    ]);
    if (loaded.error) return { ok: false, message: FAILED };
    const rows = loaded.rows;
    const lookup = channelPriceLookup(prices);
    const channels = exploreChannelColumns(rows, lookup);
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
      const extras = lookup.get(row.asin.trim());
      const facts = new Map(listingChannelFacts(mapSourceRow(row), extras).map((fact) => [fact.key, fact]));
      const hrefFor = (key: string): { href: string | null; requirePage: boolean } => {
        if (key === "amazon") return { href: null, requirePage: false };
        if (key === "walmart") return { href: storedHttpUrl(row.wmt_url), requirePage: true };
        if (key === "musicians-friend") return { href: musiciansFriendCheckedPageUrl(lookup, row.asin), requirePage: true };
        const cell = extras?.get(key);
        return { href: cell ? storedHttpUrl(cell.url) : null, requirePage: true };
      };
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
        population: `${formatInt(rows.length)} listings in the retail read.`,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}
