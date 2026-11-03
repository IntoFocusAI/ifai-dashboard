import { formatInt, formatPct } from "@/lib/fender-canvas/format";
import type { CanvasMetricsRow } from "@/lib/fender-canvas/types";

function finite(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

export type ActiveOfferSplit = { oneP: number; threeP: number; unknown: number; noOffer: number; active: number };

/** Null when any side of the offer split is not stored. */
export function activeOfferSplit(metrics: CanvasMetricsRow): ActiveOfferSplit | null {
  const oneP = finite(metrics.bb_1p);
  const threeP = finite(metrics.bb_3p);
  const unknown = finite(metrics.bb_unharvested);
  const noOffer = finite(metrics.bb_no_offer);
  if (oneP == null || threeP == null || unknown == null || noOffer == null) return null;
  return { oneP, threeP, unknown, noOffer, active: oneP + threeP + unknown };
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

  const { oneP, threeP, unknown, noOffer, active } = split;
  if (active <= 0) {
    return `${formatInt(noOffer)} listings have no Amazon offer. None of those listings are in an active-offer count.`;
  }

  const share = (count: number) => formatPct((count / active) * 100);
  return [
    `${formatInt(active)} listings have an active Amazon offer.`,
    `${formatInt(noOffer)} listings have no Amazon offer.`,
    `Those ${formatInt(noOffer)} listings are not part of the active-offer count.`,
    `Of the ${formatInt(active)} listings with an offer, Amazon holds the Buy Box on ${formatInt(oneP)} of ${formatInt(active)} (${share(oneP)}).`,
    `A third-party seller holds the Buy Box on ${formatInt(threeP)} of ${formatInt(active)} (${share(threeP)}).`,
    `${formatInt(unknown)} of ${formatInt(active)} offers have no stored seller name (${share(unknown)}).`,
  ].join(" ");
}
