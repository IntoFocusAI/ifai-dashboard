/* R-15 decision (a): the seller(s) holding a withheld Amazon offer, so the partner-led next step
   can name who to ask. The Buy Box seller harvester reads Keepa's live offers for each withheld
   listing and stores the seller id(s) at the lowest landed New price, the offer Amazon is
   withholding (canvas_withheld_offer_sellers, the same view name in every client's schema).
   Sellers tied at that price are all listed. */

import type { PriceMatchScopeRow } from "@/lib/fender-canvas/price-match";

/** One row of canvas_withheld_offer_sellers. seller_names follows seller_ids, null when unknown. */
export type WithheldOfferSellerRow = {
  asin: string;
  seller_ids?: readonly string[] | null;
  seller_names?: readonly (string | null)[] | null;
  landed_cents?: number | string | null;
  checked_at?: string | null;
  featured_offer_state?: string | null;
};

export type WithheldOfferSellers = { names: string[]; total: number };

/** Sellers per listing, for listings whose Featured Offer is still withheld. */
export function withheldOfferSellers(rows: readonly WithheldOfferSellerRow[]): Map<string, WithheldOfferSellers> {
  const out = new Map<string, WithheldOfferSellers>();
  for (const row of rows) {
    if (!row?.asin || row.featured_offer_state !== "withheld") continue;
    const ids = (row.seller_ids ?? []).filter((id) => typeof id === "string" && id.trim() !== "");
    if (!ids.length) continue;
    const names: string[] = [];
    for (const name of row.seller_names ?? []) {
      const n = typeof name === "string" ? name.trim() : "";
      if (n && !names.includes(n)) names.push(n);
    }
    out.set(row.asin, { names, total: Math.max(ids.length, names.length) });
  }
  return out;
}

/** "A", "A and B", "A, B and C", or "A, B, C and 2 more" (unnamed sellers count in "more"). */
export function sellerListLabel(names: readonly string[], total: number, max = 3): string | null {
  if (!names.length) return null;
  const shown = names.slice(0, max);
  const more = Math.max(total, names.length) - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

/** Puts the named seller(s) on each listing in scope. A listing with no named seller is unchanged. */
export function withOfferSellers<T extends PriceMatchScopeRow>(
  scope: readonly T[],
  sellers: ReadonlyMap<string, WithheldOfferSellers>,
): T[] {
  return scope.map((listing) => {
    const found = sellers.get(listing.asin);
    const label = found ? sellerListLabel(found.names, found.total) : null;
    return label ? { ...listing, offerSeller: label, offerSellerCount: found!.total } : listing;
  });
}
