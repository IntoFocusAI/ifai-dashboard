import { activeClient, brandName } from "@/lib/client/active-client";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import type { CanvasMetricsRow } from "@/lib/fender-canvas/types";

function finite(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

export type ActiveOfferSplit = {
  /** Listings where the brand's own seller account (settings brand_seller_ids) holds the Buy Box. Zero for partner-led clients. */
  brand: number;
  oneP: number;
  threeP: number;
  unknown: number;
  noOffer: number;
  active: number;
};

/** A brand-led client's own seller accounts are meant to hold the Buy Box (settings seller_type). */
export function brandSellerLed(): boolean {
  return activeClient().sellerModel === "Brand-led";
}

/**
 * Null when any side of the offer split is not stored. For a brand-led client the brand's own store is
 * its own side (bb_brand, the listings whose Buy Box seller is in brand_seller_ids); a third-party
 * seller is any other seller. When a brand-led client's metrics row does not store bb_brand the split
 * is null, so no Buy Box held by the brand is ever counted as Amazon's or a third party's.
 */
export function activeOfferSplit(metrics: CanvasMetricsRow): ActiveOfferSplit | null {
  const brand = brandSellerLed() ? finite(metrics.bb_brand) : (finite(metrics.bb_brand) ?? 0);
  const oneP = finite(metrics.bb_1p);
  const threeP = finite(metrics.bb_3p);
  const unknown = finite(metrics.bb_unharvested);
  const noOffer = finite(metrics.bb_no_offer);
  if (brand == null || oneP == null || threeP == null || unknown == null || noOffer == null) return null;
  return { brand, oneP, threeP, unknown, noOffer, active: brand + oneP + threeP + unknown };
}

/**
 * Active offers are listings with a seller status other than no offer.
 * The no-offer count is a separate population. Percentages use the active-offer count.
 */
export function activeOfferClarity(metrics: CanvasMetricsRow): string {
  const split = activeOfferSplit(metrics);
  if (!split) {
    return "The offer split is not stored, so this briefing does not state an active-offer count.";
  }

  const { brand, oneP, threeP, unknown, noOffer, active } = split;
  if (active <= 0) {
    return `${formatInt(noOffer)} listings have no Amazon offer. None of those listings are in an active-offer count.`;
  }

  const share = (count: number) => formatPct((count / active) * 100);
  return [
    `${formatInt(active)} listings have an active Amazon offer.`,
    `${formatInt(noOffer)} listings have no Amazon offer.`,
    `Those ${formatInt(noOffer)} listings are not part of the active-offer count.`,
    ...(brandSellerLed()
      ? [`${brandName()}'s own store holds the Buy Box on ${formatInt(brand)} of ${formatInt(active)} (${share(brand)}).`]
      : []),
    `Of the ${formatInt(active)} listings with an offer, Amazon holds the Buy Box on ${formatInt(oneP)} of ${formatInt(active)} (${share(oneP)}).`,
    `A third-party seller holds the Buy Box on ${formatInt(threeP)} of ${formatInt(active)} (${share(threeP)}).`,
    `${formatInt(unknown)} of ${formatInt(active)} offers have no stored seller name (${share(unknown)}).`,
  ].join(" ");
}
