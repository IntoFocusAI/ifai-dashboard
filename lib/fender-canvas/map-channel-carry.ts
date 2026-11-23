import { retailListingHeadCountQuery } from "@/lib/canvasData";
import type { ChannelCarry, ChannelCarryMap } from "@/lib/fender-canvas/map-reading-status";
import { loadRetailerPrices } from "@/lib/fender-canvas/retailer-prices-read";
import type { RetailerPriceIndex } from "@/lib/fender-canvas/retailer-prices";

async function amazonCarry(): Promise<ChannelCarry | null> {
  try {
    const [carried, priced] = await Promise.all([
      retailListingHeadCountQuery(),
      retailListingHeadCountQuery({ amazonPriced: true }),
    ]);
    if (carried.error || priced.error || carried.count == null || priced.count == null) return null;
    return { carried: carried.count, missing: Math.max(0, carried.count - priced.count) };
  } catch {
    return null;
  }
}

/**
 * Per MAP-channel retailer, from its price-check rows: the listings it carries (a price, or a
 * checked page without one) and how many of those have no price. A retailer with no rows carries
 * nothing and is missing nothing.
 */
export function retailerCarry(index: RetailerPriceIndex): ChannelCarryMap {
  const out: ChannelCarryMap = {};
  for (const retailer of index.retailers) {
    if (!retailer.mapChannel) continue;
    let carried = 0;
    let priced = 0;
    for (const cells of index.byAsin.values()) {
      const cell = cells.find((entry) => entry.key === retailer.key);
      if (!cell) continue;
      if (cell.price != null) priced += 1;
      if (cell.price != null || cell.url != null) carried += 1;
    }
    out[retailer.name] = { carried, missing: Math.max(0, carried - priced) };
  }
  return out;
}

/**
 * Amazon, plus each MAP-channel retailer on the client's list: the listings it carries, and how
 * many of those have no price read. Listings a retailer does not carry are neither counted nor
 * missing. A failed retailer read leaves those channels out, so their lines keep the count alone.
 */
export async function loadChannelCarry(): Promise<ChannelCarryMap> {
  const [amazon, retailers] = await Promise.all([
    amazonCarry(),
    loadRetailerPrices().then(retailerCarry, () => ({}) as ChannelCarryMap),
  ]);
  return { Amazon: amazon, ...retailers };
}
