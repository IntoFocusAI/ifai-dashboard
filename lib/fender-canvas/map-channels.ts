/**
 * MAP tab model. Amazon comes from `canvas_retail_listings`; every other retailer comes from the
 * client's retailer list and its price-check rows (R-10: `canvas_retailers`, `canvas_retail_prices`,
 * attached by retailer-prices.ts). No retailer is named in code.
 */

import type { RetailerCell } from "@/lib/fender-canvas/retailer-prices";

export type MapSourceRow = {
  asin: string;
  model_name: string | null;
  title: string | null;
  map_price: number | null;
  offer_price: number | null;
  /** Stored Amazon leakage. The worst gap across channels is not this number. */
  amz_leakage?: number | null;
  /** Lowest of Amazon's leakage and every MAP-channel gap (retailer-prices.ts). */
  worst_leakage: number | null;
  /** This listing's checked retailers, in the client's order. */
  retailers?: RetailerCell[];
  /** Amazon price check time, the Featured Offer read (X-25). Retailer check times are on the cells. */
  featured_offer_checked_at?: string | null;
};

/** One channel's stored price and the gap that price produced. */
export type ChannelFact = {
  key: string;
  name: string;
  price: number | null;
  gap: number | null;
  /** The checked retailer page. Amazon has none here; its link is the ASIN. */
  url?: string | null;
  /** A retailer price shows Not available* when no checked page is stored. Amazon does not. */
  requireCheckedPage?: boolean;
};

/** A channel line: listings below MAP on that channel. */
export type MapChannelSummary = {
  key: string;
  name: string;
  count: number;
};

/** A price column: Amazon, then each retailer with a stored price or gap, in the client's order. */
export type ChannelColumn = { key: string; name: string };

export type MapTabModel = {
  count: number;
  averageGap: number | null;
  combinedGap: number | null;
  /** Channels with at least one listing below MAP, in column order. */
  channels: MapChannelSummary[];
  /** Channels with a stored price or gap on a returned listing, in column order. */
  columns: ChannelColumn[];
  showAmazon: boolean;
};

/** Shown beside a price when no checked retailer page was stored. */
export const MISSING_CHECKED_PAGE_LABEL = "Not available*";

/** Plain-language reason for {@link MISSING_CHECKED_PAGE_LABEL}. */
export const MISSING_CHECKED_PAGE_DESC =
  "No checked page was stored for this price.";

function finite(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Stored shelf price. Zero and negative values are not a price. */
function storedPrice(value: unknown): number | null {
  const price = finite(value);
  if (price == null || price <= 0) return null;
  return price;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Stored leakage wins. Otherwise the gap is the stored shelf price minus stored MAP. */
function channelGap(leakage: unknown, price: unknown, mapPrice: unknown): number | null {
  const leak = finite(leakage);
  if (leak != null) return roundMoney(leak);
  const shelf = storedPrice(price);
  const map = storedPrice(mapPrice);
  if (shelf == null || map == null) return null;
  return roundMoney(shelf - map);
}

/**
 * The gap a price cell prints, on screen and in the CSV. A price exactly at MAP has no gap to
 * show, so zero prints nothing and the price stands alone.
 */
export function shownChannelGap(gap: number | null | undefined): number | null {
  return gap == null || gap === 0 ? null : gap;
}

function belowMap(gap: number | null): boolean {
  return gap != null && gap < 0;
}

const AMAZON = { key: "amazon", name: "Amazon" } as const;

/** Trimmed http(s) URL, or null. Never builds a retailer search page. */
export function storedHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Stored price and gap for each channel on one listing: Amazon, then each checked retailer.
 * A channel with no stored price and no stored gap is omitted.
 */
export function listingChannelFacts(row: Pick<MapSourceRow, "offer_price" | "amz_leakage" | "map_price" | "retailers">): ChannelFact[] {
  const facts: ChannelFact[] = [];
  const amazonPrice = storedPrice(row.offer_price);
  const amazonGap = channelGap(row.amz_leakage, row.offer_price, row.map_price);
  if (amazonPrice != null || amazonGap != null) {
    facts.push({ key: AMAZON.key, name: AMAZON.name, price: amazonPrice, gap: amazonGap });
  }
  for (const cell of row.retailers ?? []) {
    if (cell.price == null && cell.gap == null) continue;
    facts.push({
      key: cell.key,
      name: cell.name,
      price: cell.price,
      gap: cell.gap,
      url: storedHttpUrl(cell.url),
      requireCheckedPage: true,
    });
  }
  return facts;
}

/**
 * When a price is shown and a checked page is required, return the missing-source
 * label if no stored URL exists. Otherwise null.
 */
export function missingCheckedPageLabel(
  requireCheckedPage: boolean,
  href: string | null | undefined,
  price: number | null | undefined,
): string | null {
  if (!requireCheckedPage) return null;
  if (price == null) return null;
  if (href) return null;
  return MISSING_CHECKED_PAGE_LABEL;
}

/** Channels with a stored price or gap, Amazon first, then retailers in first-seen order. */
function channelColumns(rows: readonly Pick<MapSourceRow, "offer_price" | "amz_leakage" | "map_price" | "retailers">[]): ChannelColumn[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    for (const fact of listingChannelFacts(row)) if (!seen.has(fact.key)) seen.set(fact.key, fact.name);
  }
  const columns = [...seen.entries()].map(([key, name]) => ({ key, name }));
  return [
    ...columns.filter((column) => column.key === AMAZON.key),
    ...columns.filter((column) => column.key !== AMAZON.key),
  ];
}

/**
 * Channel counts are listings below MAP on that channel.
 * A stored price that is at or above MAP is not a count.
 * A channel with no stored price on a returned listing is omitted.
 */
export function mapTabModel(rows: MapSourceRow[], retailerOrderKeys?: readonly string[]): MapTabModel {
  const below = new Map<string, number>();
  for (const row of rows) {
    for (const fact of listingChannelFacts(row)) {
      if (belowMap(fact.gap)) below.set(fact.key, (below.get(fact.key) ?? 0) + 1);
    }
  }
  const columns = orderedColumns(rows, retailerOrderKeys);
  const channels = columns
    .map((column) => ({ key: column.key, name: column.name, count: below.get(column.key) ?? 0 }))
    .filter((channel) => channel.count > 0);

  const gaps = rows
    .map((row) => finite(row.worst_leakage))
    .filter((gap): gap is number => gap != null);
  const combinedGap = gaps.reduce((sum, gap) => sum + gap, 0);

  return {
    count: rows.length,
    averageGap: gaps.length ? combinedGap / gaps.length : null,
    combinedGap: gaps.length ? combinedGap : null,
    channels,
    columns,
    showAmazon: columns.some((column) => column.key === AMAZON.key),
  };
}

/** Amazon first, then retailers in the client's list order when given, else first-seen order. */
function orderedColumns(
  rows: readonly Pick<MapSourceRow, "offer_price" | "amz_leakage" | "map_price" | "retailers">[],
  retailerOrderKeys?: readonly string[],
): ChannelColumn[] {
  const columns = channelColumns(rows);
  if (!retailerOrderKeys) return columns;
  const rank = (key: string) => {
    if (key === AMAZON.key) return -1;
    const index = retailerOrderKeys.indexOf(key);
    return index < 0 ? retailerOrderKeys.length : index;
  };
  return columns.slice().sort((a, b) => rank(a.key) - rank(b.key));
}

/** The fields of a retail listing row the channel facts read. */
export type ChannelSourceRow = Pick<
  MapSourceRow,
  "asin" | "model_name" | "title" | "map_price" | "offer_price" | "amz_leakage" | "worst_leakage" | "retailers"
>;

/**
 * The price columns Explore all listings shows: Amazon and each retailer only when at least one
 * listing stores a price or gap for it. A retailer with no checks gets no column.
 */
export function exploreChannelColumns(
  rows: readonly ChannelSourceRow[],
  retailerOrderKeys?: readonly string[],
): ChannelColumn[] {
  return orderedColumns(rows, retailerOrderKeys);
}

export function listingLabel(row: Pick<MapSourceRow, "model_name" | "title">): string {
  return row.model_name?.trim() || row.title?.trim() || "Listing";
}
