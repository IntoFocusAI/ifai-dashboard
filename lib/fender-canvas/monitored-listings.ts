/**
 * All monitored listings: the one number every "of all monitored listings" phrase uses (the
 * Buy Box, MAP and splintered hero bands and the central ranking's common base for listings).
 * It is the monitored retail population from the Buy Box (Featured Offer) read, and the MAP
 * read's population when the Buy Box read has none. Null when neither read is stored.
 */

import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";

export function monitoredListingsTotal(snapshot: PortfolioRetailSnapshot): number | null {
  const candidates = [snapshot.suppressedListings.detail?.counts.population, snapshot.mapLeakage.detail?.population];
  for (const value of candidates) if (value != null && value > 0) return value;
  return null;
}
