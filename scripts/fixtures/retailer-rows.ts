/**
 * R-10 test fixtures: retailer cells built through the same code the live read uses
 * (retailerPriceIndex), so a test states prices as rows, not as wmt_* / mf_* columns.
 */

import {
  retailerPriceIndex,
  type RetailerCell,
  type RetailerListRow,
  type RetailPriceRow,
} from "../../lib/fender-canvas/retailer-prices.ts";

/** Fender's list as step 1 seeded it. */
export const FENDER_RETAILERS: RetailerListRow[] = [
  { slug: "walmart", display_name: "Walmart", map_channel: true, active: true, sort_order: 10 },
  { slug: "musicians-friend", display_name: "Musician's Friend", map_channel: true, active: true, sort_order: 20 },
  { slug: "sweetwater", display_name: "Sweetwater", map_channel: false, active: false, sort_order: 30 },
  { slug: "reverb", display_name: "Reverb", map_channel: false, active: false, sort_order: 40 },
];

/** Ledlenser's list: Walmart only. */
export const LEDLENSER_RETAILERS: RetailerListRow[] = [
  { slug: "walmart", display_name: "Walmart", map_channel: true, active: true, sort_order: 10 },
];

export type CellSpec = {
  price?: number | null;
  url?: string | null;
  checkedAt?: string | null;
  /** Defaults to the listing's map_price. */
  map?: number | null;
};

/**
 * Cells for one listing: `{ walmart: { price: 77 }, "musicians-friend": { price: 79 } }`.
 * A spec with no price is a no_match check.
 */
export function cells(
  asin: string,
  specs: Record<string, CellSpec>,
  mapPrice: number | null = null,
  retailers: RetailerListRow[] = FENDER_RETAILERS,
): RetailerCell[] {
  const latest: RetailPriceRow[] = Object.entries(specs).map(([retailer, spec]) => {
    const map = spec.map === undefined ? mapPrice : spec.map;
    const price = spec.price ?? null;
    return {
      asin,
      retailer,
      status: price != null ? "priced" : "no_match",
      observed_at: spec.checkedAt ?? "2026-11-23T00:00:00Z",
      price,
      url: spec.url ?? null,
      map_price: map,
      leakage: price != null && map != null ? Math.round((price - map) * 100) / 100 : null,
    };
  });
  return retailerPriceIndex(retailers, latest).byAsin.get(asin) ?? [];
}
