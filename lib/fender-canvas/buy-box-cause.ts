/**
 * Buy Box withheld, split by cause (roadmap gap audit recommendation 3, approved by Brian Magazu on
 * 18 Nov 2026). The cause is the one already stored: `canvas_retail_listings.competitive_offer_suppressed`
 * marks a withheld listing whose offer plus shipping sits above the benchmark Amazon published in the
 * same check. Every other withheld listing has another or an unknown cause. One template for every
 * client; nothing here names one.
 */

import {
  FEATURED_OFFER_COLUMNS,
  featuredOfferState,
  isConfirmedHighPriceSuppression,
  observedOfferDollars,
  type FeaturedOfferRow,
} from "@/lib/fender-canvas/featured-offer";

export type BuyBoxCause = "price" | "other";

/** A withheld row with its stored cause and the outside prices the MAP checks already hold. */
export type WithheldCauseRow = FeaturedOfferRow & {
  competitive_offer_suppressed?: boolean | null;
  wmt_price?: number | string | null;
  wmt_url?: string | null;
  /** Fender only; the Ledlenser read drops it (lib/client/column-aliases). */
  mf_price?: number | string | null;
};

/** The Featured Offer columns plus the stored cause and the stored outside prices. */
export const WITHHELD_CAUSE_COLUMNS = [
  FEATURED_OFFER_COLUMNS,
  "competitive_offer_suppressed",
  "wmt_price",
  "wmt_url",
  "mf_price",
].join(",");

export const BUY_BOX_CAUSE_LABELS: Record<BuyBoxCause, string> = {
  price: "Priced above Amazon's reference price",
  other: "Other or unknown cause",
};

/** "Review pricing on 51 listings priced above Amazon's reference price." */
export function buyBoxCauseAction(cause: BuyBoxCause, listings: number): string {
  const noun = listings === 1 ? "listing" : "listings";
  return cause === "price"
    ? `Review pricing on ${listings} ${noun} priced above Amazon's reference price.`
    : `Check ${listings} ${noun} without the Buy Box for other causes.`;
}

/**
 * The stored flag decides. A read without the column (null or absent) falls back to the same rule
 * the view applies, so the split never depends on which build of the view a client has.
 */
export function buyBoxCause(row: WithheldCauseRow): BuyBoxCause {
  if (row.competitive_offer_suppressed === true) return "price";
  if (row.competitive_offer_suppressed === false) return "other";
  return isConfirmedHighPriceSuppression(row) ? "price" : "other";
}

export type BuyBoxCauseSplit = {
  withheld: number;
  price: number;
  other: number;
  priceAsins: ReadonlySet<string>;
  otherAsins: ReadonlySet<string>;
};

/** Withheld listings only; any other row is ignored. price + other = withheld. */
export function splitBuyBoxCauses(rows: readonly WithheldCauseRow[]): BuyBoxCauseSplit {
  const priceAsins = new Set<string>();
  const otherAsins = new Set<string>();
  for (const row of rows) {
    if (featuredOfferState(row) !== "withheld" || typeof row.asin !== "string") continue;
    (buyBoxCause(row) === "price" ? priceAsins : otherAsins).add(row.asin);
  }
  return {
    withheld: priceAsins.size + otherAsins.size,
    price: priceAsins.size,
    other: otherAsins.size,
    priceAsins,
    otherAsins,
  };
}

export type LowerPriceElsewhere = { channel: string; price: number; url: string | null };

function dollars(value: unknown): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * For any withheld listing, whatever its cause (Brian Magazu, 18 Nov 2026): the stored Walmart and
 * Musician's Friend prices below the Amazon offer, lowest first, with the page when one is stored.
 * Empty for a listing that is not withheld, and when no stored price is lower.
 */
export function lowerPricesElsewhere(row: WithheldCauseRow): LowerPriceElsewhere[] {
  if (featuredOfferState(row) !== "withheld") return [];
  const offer = observedOfferDollars(row);
  if (offer == null) return [];
  const found: LowerPriceElsewhere[] = [];
  const walmart = dollars(row.wmt_price);
  if (walmart != null && walmart < offer) found.push({ channel: "Walmart", price: walmart, url: safeUrl(row.wmt_url) });
  const mf = dollars(row.mf_price);
  if (mf != null && mf < offer) found.push({ channel: "Musician's Friend", price: mf, url: null });
  return found.sort((a, b) => a.price - b.price);
}
