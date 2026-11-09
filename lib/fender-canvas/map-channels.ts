/** MAP tab model from `public.canvas_retail_listings` and `public.canvas_listing_channel_price`. */

export type MapSourceRow = {
  asin: string;
  model_name: string | null;
  title: string | null;
  map_price: number | null;
  offer_price: number | null;
  /** Stored Amazon leakage. The worst gap across channels is not this number. */
  amz_leakage?: number | null;
  worst_leakage: number | null;
  wmt_price: number | null;
  wmt_leakage?: number | null;
  wmt_url: string | null;
  mf_price: number | null;
  mf_leakage: number | null;
};

/** One channel's stored price and the gap that price produced. */
export type ChannelFact = {
  key: string;
  name: string;
  price: number | null;
  gap: number | null;
};

/** One stored retailer price from `public.canvas_listing_channel_price`. */
export type ChannelPriceRow = {
  asin: string;
  channel: string;
  price: number | string | null;
  url: string | null;
  checked_at: string | null;
};

export type MapChannelSummary = {
  name: "Amazon" | "Walmart" | "Musician's Friend";
  count: number;
};

/** A retailer added by inserting rows, not by adding a column. */
export type MapExtraChannel = {
  channel: string;
  name: string;
  count: number;
};

export type MapTabModel = {
  count: number;
  averageGap: number | null;
  combinedGap: number | null;
  channels: MapChannelSummary[];
  extraChannels: MapExtraChannel[];
  showAmazon: boolean;
  showWalmart: boolean;
  showMusiciansFriend: boolean;
};

export type PricedChannelCell = {
  price: number;
  url: string | null;
};

/** Shown beside a price when no checked retailer page was stored. */
export const MISSING_CHECKED_PAGE_LABEL = "Not available*";

/** Plain-language reason for {@link MISSING_CHECKED_PAGE_LABEL}. */
export const MISSING_CHECKED_PAGE_DESC =
  "No checked page was stored for this price.";

const PREFERRED_CHANNELS = ["sweetwater", "reverb"];

const CHANNEL_NAMES: Record<string, string> = {
  sweetwater: "Sweetwater",
  reverb: "Reverb",
};

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

/** Lowercase slug. The first values are sweetwater and reverb. */
export function channelSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

export function channelDisplayName(channel: string): string {
  return (
    CHANNEL_NAMES[channel] ??
    channel
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function channelSort(a: MapExtraChannel, b: MapExtraChannel): number {
  const ai = PREFERRED_CHANNELS.indexOf(a.channel);
  const bi = PREFERRED_CHANNELS.indexOf(b.channel);
  const ao = ai === -1 ? PREFERRED_CHANNELS.length : ai;
  const bo = bi === -1 ? PREFERRED_CHANNELS.length : bi;
  if (ao !== bo) return ao - bo;
  return a.channel.localeCompare(b.channel);
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

function belowMap(gap: number | null): boolean {
  return gap != null && gap < 0;
}

const FIXED_CHANNELS = [
  { key: "amazon", name: "Amazon" },
  { key: "walmart", name: "Walmart" },
  { key: "musicians-friend", name: "Musician's Friend" },
] as const;

/**
 * Stored price and gap for each channel on one listing.
 * A channel with no stored price and no stored leakage is omitted.
 */
export function listingChannelFacts(
  row: MapSourceRow,
  extras?: Map<string, PricedChannelCell>,
): ChannelFact[] {
  const facts: ChannelFact[] = [];
  const amazonPrice = storedPrice(row.offer_price);
  const amazonGap = channelGap(row.amz_leakage, row.offer_price, row.map_price);
  if (amazonPrice != null || amazonGap != null) {
    facts.push({ key: "amazon", name: "Amazon", price: amazonPrice, gap: amazonGap });
  }
  const walmartPrice = storedPrice(row.wmt_price);
  const walmartGap = channelGap(row.wmt_leakage, row.wmt_price, row.map_price);
  if (walmartPrice != null || walmartGap != null) {
    facts.push({ key: "walmart", name: "Walmart", price: walmartPrice, gap: walmartGap });
  }
  const musiciansFriendPrice = storedPrice(row.mf_price);
  const musiciansFriendGap = channelGap(row.mf_leakage, row.mf_price, row.map_price);
  if (musiciansFriendPrice != null || musiciansFriendGap != null) {
    facts.push({
      key: "musicians-friend",
      name: "Musician's Friend",
      price: musiciansFriendPrice,
      gap: musiciansFriendGap,
    });
  }
  if (extras) {
    for (const [channel, cell] of extras) {
      if (FIXED_CHANNELS.some((fixed) => fixed.key === channel)) continue;
      facts.push({
        key: channel,
        name: channelDisplayName(channel),
        price: cell.price,
        gap: channelGap(null, cell.price, row.map_price),
      });
    }
  }
  return facts;
}

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
 * Checked-page URL for a price cell. Prefers the channel-price row, then an
 * existing listing field. Does not invent a retailer page from an ASIN or name.
 */
export function checkedPageUrl(
  channelCellUrl: string | null | undefined,
  listingFieldUrl?: string | null,
): string | null {
  return storedHttpUrl(channelCellUrl) ?? storedHttpUrl(listingFieldUrl ?? null);
}

/** Musician's Friend checked page from the loaded channel-price map, or a listing field. */
export function musiciansFriendCheckedPageUrl(
  prices: Map<string, Map<string, PricedChannelCell>>,
  asin: string,
  listingFieldUrl?: string | null,
): string | null {
  const cell = prices.get(asin.trim())?.get("musicians-friend");
  return checkedPageUrl(cell?.url, listingFieldUrl);
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

/** Price and URL keyed by ASIN, then channel slug. Rows without a price are dropped. */
export function channelPriceLookup(
  prices: ChannelPriceRow[],
): Map<string, Map<string, PricedChannelCell>> {
  const byAsin = new Map<string, Map<string, PricedChannelCell>>();
  for (const row of prices) {
    const channel = channelSlug(row.channel);
    const price = storedPrice(row.price);
    const asin = row.asin?.trim();
    if (!channel || price == null || !asin) continue;
    let byChannel = byAsin.get(asin);
    if (!byChannel) {
      byChannel = new Map();
      byAsin.set(asin, byChannel);
    }
    const url = typeof row.url === "string" && row.url.trim() ? row.url.trim() : null;
    byChannel.set(channel, { price, url });
  }
  return byAsin;
}

/**
 * Channel counts are listings below MAP on that channel.
 * A stored price that is at or above MAP is not a count.
 * A channel with no stored price on a returned listing is omitted.
 */
export function mapTabModel(rows: MapSourceRow[], channelPrices: ChannelPriceRow[] = []): MapTabModel {
  const prices = channelPriceLookup(channelPrices);
  const below = new Map<string, number>();
  const present = new Set<string>();
  const extraOrder: string[] = [];

  for (const row of rows) {
    const facts = listingChannelFacts(row, prices.get(row.asin.trim()));
    for (const fact of facts) {
      if (!present.has(fact.key) && !FIXED_CHANNELS.some((channel) => channel.key === fact.key)) {
        extraOrder.push(fact.key);
      }
      present.add(fact.key);
      if (belowMap(fact.gap)) below.set(fact.key, (below.get(fact.key) ?? 0) + 1);
    }
  }

  const channels: MapChannelSummary[] = [];
  for (const channel of FIXED_CHANNELS) {
    const count = below.get(channel.key) ?? 0;
    if (count > 0) channels.push({ name: channel.name, count });
  }

  const extraChannels = extraOrder
    .map((channel) => ({
      channel,
      name: channelDisplayName(channel),
      count: below.get(channel) ?? 0,
    }))
    .sort(channelSort);

  const gaps = rows
    .map((row) => finite(row.worst_leakage))
    .filter((gap): gap is number => gap != null);
  const combinedGap = gaps.reduce((sum, gap) => sum + gap, 0);

  return {
    count: rows.length,
    averageGap: gaps.length ? combinedGap / gaps.length : null,
    combinedGap: gaps.length ? combinedGap : null,
    channels,
    extraChannels,
    showAmazon: present.has("amazon"),
    showWalmart: present.has("walmart"),
    showMusiciansFriend: present.has("musicians-friend"),
  };
}

/** The fields of a retail listing row the channel facts read. */
export type ChannelSourceRow = {
  asin: string;
  model_name: string | null;
  title: string | null;
  map_price: number | null;
  offer_price: number | null;
  amz_leakage?: number | null;
  worst_leakage: number | null;
  wmt_price: number | null;
  wmt_leakage?: number | null;
  wmt_url: string | null;
  mf_price?: number | null;
  mf_leakage?: number | null;
};

export function mapSourceRow(row: ChannelSourceRow): MapSourceRow {
  return {
    asin: row.asin,
    model_name: row.model_name,
    title: row.title,
    map_price: row.map_price,
    offer_price: row.offer_price,
    amz_leakage: row.amz_leakage ?? null,
    worst_leakage: row.worst_leakage,
    wmt_price: row.wmt_price,
    wmt_leakage: row.wmt_leakage,
    wmt_url: row.wmt_url,
    mf_price: row.mf_price ?? null,
    mf_leakage: row.mf_leakage ?? null,
  };
}

export type ExploreChannelColumn = { key: string; name: string };

/**
 * The retailer columns Explore all listings shows: a fixed retailer only when at least one
 * listing stores a price or gap for it, then the extra retailers in their preferred order.
 * A client with no Musician's Friend data gets no Musician's Friend column.
 */
export function exploreChannelColumns(
  rows: readonly ChannelSourceRow[],
  prices: Map<string, Map<string, PricedChannelCell>>,
): ExploreChannelColumn[] {
  const present = new Set<string>();
  const extras = new Set<string>();
  for (const row of rows) {
    for (const fact of listingChannelFacts(mapSourceRow(row), prices.get(row.asin.trim()))) {
      if (FIXED_CHANNELS.some((channel) => channel.key === fact.key)) present.add(fact.key);
      else extras.add(fact.key);
    }
  }
  return [
    ...FIXED_CHANNELS.filter((channel) => present.has(channel.key)).map((channel) => ({
      key: channel.key as string,
      name: channel.name as string,
    })),
    ...[...extras]
      .map((channel) => ({ channel, name: channelDisplayName(channel), count: 0 }))
      .sort(channelSort)
      .map((channel) => ({ key: channel.channel, name: channel.name })),
  ];
}

export function listingLabel(row: MapSourceRow): string {
  return row.model_name?.trim() || row.title?.trim() || "Listing";
}
