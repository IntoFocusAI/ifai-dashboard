/**
 * Stored retailer pages for one suppressed listing.
 * A page counts only when the MAP tab would treat it as a stored http(s) URL:
 * `checkedPageUrl` for a channel cell or the Walmart listing field, and
 * `musiciansFriendCheckedPageUrl` for Musician's Friend.
 * This does not search, and it does not build a retailer page from an ASIN.
 */

import { listingChannelPricesQuery } from "@/lib/canvasData";
import {
  MISSING_CHECKED_PAGE_LABEL,
  channelPriceLookup,
  checkedPageUrl,
  musiciansFriendCheckedPageUrl,
  type ChannelPriceRow,
  type PricedChannelCell,
} from "@/lib/fender-canvas/map-channels";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export const PRICE_MATCH_LABEL = "Price match";

/** Tooltip on the label. The label is a stored page, not a confirmed cause. */
export const PRICE_MATCH_DESC =
  "A page the read already stored for this product. It is not an Amazon-confirmed cause of the suppression.";

export const PRICE_MATCH_MISSING_LABEL = MISSING_CHECKED_PAGE_LABEL;

export const PRICE_MATCH_MISSING_DESC = "No checked page was stored for this product.";

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/** Same first extras as the MAP tab. Anything else follows alphabetically. */
const PREFERRED_EXTRAS = ["sweetwater", "reverb"];

/**
 * Amazon is the listing under review, not an outside page. Walmart and
 * Musician's Friend are added on their own, in that order.
 */
const HANDLED_CHANNELS = new Set(["amazon", "walmart", "musicians-friend"]);

export type PriceMatchSources = {
  prices: Map<string, Map<string, PricedChannelCell>>;
  walmartUrls: Map<string, string | null>;
};

export function emptyPriceMatchSources(): PriceMatchSources {
  return { prices: new Map(), walmartUrls: new Map() };
}

function extraOrder(a: string, b: string): number {
  const ai = PREFERRED_EXTRAS.indexOf(a);
  const bi = PREFERRED_EXTRAS.indexOf(b);
  const ao = ai === -1 ? PREFERRED_EXTRAS.length : ai;
  const bo = bi === -1 ? PREFERRED_EXTRAS.length : bi;
  if (ao !== bo) return ao - bo;
  return a.localeCompare(b);
}

function addHref(hrefs: string[], seen: Set<string>, href: string | null): void {
  if (!href || seen.has(href)) return;
  seen.add(href);
  hrefs.push(href);
}

/**
 * Stored http(s) pages for one ASIN, in MAP channel order.
 * An empty list means the row should say Not available*.
 */
export function priceMatchHrefs(
  asin: string,
  prices: Map<string, Map<string, PricedChannelCell>>,
  walmartUrl?: string | null,
): string[] {
  const hrefs: string[] = [];
  const seen = new Set<string>();
  const byChannel = prices.get(asin.trim());
  const walmartCell = byChannel?.get("walmart");

  addHref(hrefs, seen, checkedPageUrl(walmartCell?.url, null));
  addHref(hrefs, seen, checkedPageUrl(null, walmartUrl));
  addHref(hrefs, seen, musiciansFriendCheckedPageUrl(prices, asin));

  if (!byChannel) return hrefs;
  const extras = [...byChannel.keys()].filter((channel) => !HANDLED_CHANNELS.has(channel)).sort(extraOrder);
  for (const channel of extras) {
    addHref(hrefs, seen, checkedPageUrl(byChannel.get(channel)?.url, null));
  }
  return hrefs;
}

async function loadChannelPriceRows(): Promise<ChannelPriceRow[]> {
  const rows: ChannelPriceRow[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const { data, error } = await listingChannelPricesQuery(page, PAGE_SIZE);
      if (error) return rows;
      const batch = (data ?? []) as ChannelPriceRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return rows;
    }
  } catch {
    return rows;
  }
  return rows;
}

/** Walmart pages live on the listing (`wmt_url`), the same field the MAP tab links. */
async function loadWalmartUrls(): Promise<Map<string, string | null>> {
  const urls = new Map<string, string | null>();
  try {
    const supabase = getCanvasSupabase();
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("canvas_retail_listings")
        .select("asin,wmt_url")
        .eq("featured_offer_state", "withheld")
        .order("asin")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return urls;
      const batch = data ?? [];
      for (const row of batch) {
        const asin = typeof row.asin === "string" ? row.asin.trim() : "";
        if (!asin) continue;
        urls.set(asin, typeof row.wmt_url === "string" ? row.wmt_url : null);
      }
      if (batch.length < PAGE_SIZE) return urls;
    }
  } catch {
    return urls;
  }
  return urls;
}

/** Channel prices and Walmart listing URLs. A failed read comes back empty. */
export async function loadPriceMatchSources(): Promise<PriceMatchSources> {
  const [channelPrices, walmartUrls] = await Promise.all([loadChannelPriceRows(), loadWalmartUrls()]);
  return { prices: channelPriceLookup(channelPrices), walmartUrls };
}
