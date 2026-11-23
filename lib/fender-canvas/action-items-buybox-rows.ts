/**
 * Action Items fix list: the Buy Box row split into three (roadmap gap audit recommendation 3, and
 * Brian Magazu's 18 Nov 2026 wording). One row for today's withheld listings priced above Amazon's
 * reference price, one for today's withheld listings with another or an unknown cause, and one for
 * every other line-2 listing: those that lost the Buy Box on earlier days. Each row's dollar is
 * line 2's part for exactly its own listings, so the three rows add up to line 2 and the fix list
 * still adds up to Phase 1. One template for every client.
 */

import { estimateBuyBox } from "@/lib/estimates/availability";
import type { ClientEstimates } from "@/lib/estimates/live-inputs";
import type { EstimateResult } from "@/lib/estimates/types";
import {
  fixRowEstimate,
  lineFromListings,
  type LineListingsEstimate,
} from "@/lib/fender-canvas/action-items-fix-list";
import {
  BUY_BOX_CAUSE_LABELS,
  buyBoxCauseAction,
  type BuyBoxCause,
  type BuyBoxCauseSplit,
} from "@/lib/fender-canvas/buy-box-cause";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import type { PlanItem } from "@/lib/fender-canvas/roadmap-plan";

export const BUY_BOX_ROW_ID = "finding:buy_box";

/** The three Buy Box rows: today's two withheld causes, then the listings that lost it earlier. */
export type BuyBoxRowGroup = BuyBoxCause | "earlier";

export const BUY_BOX_CAUSE_ROW_IDS: Readonly<Record<BuyBoxRowGroup, string>> = {
  price: "finding:buy_box:price",
  other: "finding:buy_box:other",
  earlier: "finding:buy_box:earlier",
};

const GROUPS: readonly BuyBoxRowGroup[] = ["price", "other", "earlier"];

/** Finding column label for the earlier-days row (the two withheld causes use BUY_BOX_CAUSE_LABELS). */
export const BUY_BOX_EARLIER_LABEL = "Lost the Buy Box earlier this year";

const TRAIL_TITLES: Record<BuyBoxRowGroup, string> = {
  price: "Buy Box withheld, priced above Amazon's reference price",
  other: "Buy Box withheld, other or unknown cause",
  earlier: "Buy Box lost earlier this year",
};

const TRAIL_MEANS: Record<BuyBoxRowGroup, string> = {
  price:
    "The brand's Amazon sales lost in a year on days when a listing had stock and no Buy Box, for the listings withheld today and priced above Amazon's reference price.",
  other:
    "The brand's Amazon sales lost in a year on days when a listing had stock and no Buy Box, for the listings withheld today for another or an unknown cause.",
  earlier:
    "The brand's Amazon sales lost in a year on days when a listing had stock and no Buy Box, for the listings not withheld today that lost the Buy Box on earlier days in the last 12 months.",
};

/** "Watch 686 listings that lost the Buy Box earlier this year." */
export function buyBoxRowAction(group: BuyBoxRowGroup, listings: number): string {
  if (group !== "earlier") return buyBoxCauseAction(group, listings);
  return `Watch ${listings} ${listings === 1 ? "listing" : "listings"} that lost the Buy Box earlier this year.`;
}

export function buyBoxCauseOf(itemId: string): BuyBoxRowGroup | null {
  return GROUPS.find((group) => BUY_BOX_CAUSE_ROW_IDS[group] === itemId) ?? null;
}

/** Each row keeps only its own listings: today's price cause, today's other cause, or neither. */
function keeper(group: BuyBoxRowGroup, split: BuyBoxCauseSplit): (asin: string) => boolean {
  if (group === "price") return (asin) => split.priceAsins.has(asin);
  if (group === "other") return (asin) => split.otherAsins.has(asin);
  return (asin) => !split.priceAsins.has(asin) && !split.otherAsins.has(asin);
}

const lineCache = new WeakMap<ClientEstimates, WeakMap<BuyBoxCauseSplit, Partial<Record<BuyBoxRowGroup, EstimateResult>>>>();

/** Line 2 run on the row's listings only, so the trail lists exactly the row's listings and inputs. */
export function buyBoxCauseLine(est: ClientEstimates, group: BuyBoxRowGroup, split: BuyBoxCauseSplit): EstimateResult {
  let bySplit = lineCache.get(est);
  if (!bySplit) {
    bySplit = new WeakMap();
    lineCache.set(est, bySplit);
  }
  let lines = bySplit.get(split);
  if (!lines) {
    lines = {};
    bySplit.set(split, lines);
  }
  const cached = lines[group];
  if (cached) return cached;
  const keep = keeper(group, split);
  const line = estimateBuyBox(
    est.inputs.filter((listing) => keep(listing.asin)),
    est.ctx,
  );
  const result = { ...line, trail: { ...line.trail, title: TRAIL_TITLES[group], means: TRAIL_MEANS[group] } };
  lines[group] = result;
  return result;
}

/** The dollar on any fix-list row: a Buy Box row reads its part of line 2, every other row its line. */
export function fixRowFigure(
  itemId: string,
  est: ClientEstimates,
  split: BuyBoxCauseSplit | null,
): LineListingsEstimate | null {
  const group = buyBoxCauseOf(itemId);
  if (!group || !split) return fixRowEstimate(itemId, est);
  const figure = lineFromListings(est, "buy_box", keeper(group, split));
  return figure ? { ...figure, line: buyBoxCauseLine(est, group, split) } : null;
}

function denominatorOf(ratio: string | null): number | null {
  const match = /^[\d,]+ of ([\d,]+)/.exec(ratio ?? "");
  const n = match ? Number(match[1]!.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Line-2 listings that are not withheld today: they lost the Buy Box on earlier days. */
export function earlierBuyBoxListings(est: ClientEstimates | null, split: BuyBoxCauseSplit): number {
  if (!est) return 0;
  return lineFromListings(est, "buy_box", keeper("earlier", split))?.listings ?? 0;
}

/**
 * The Buy Box rows from the Buy Box row, each with its count of the same population: today's two
 * withheld causes, then the earlier-days row (once the estimates are read). A group with no
 * listing is left out.
 */
export function buyBoxCauseItems(
  base: PlanItem,
  split: BuyBoxCauseSplit,
  est: ClientEstimates | null = null,
): PlanItem[] {
  const total = denominatorOf(base.ratio) ?? split.withheld;
  const counts: Record<BuyBoxRowGroup, number> = {
    price: split.price,
    other: split.other,
    earlier: earlierBuyBoxListings(est, split),
  };
  return GROUPS.filter((group) => counts[group] > 0).map((group) => {
    const listings = counts[group];
    return {
      ...base,
      id: BUY_BOX_CAUSE_ROW_IDS[group],
      siteType: group === "earlier" ? BUY_BOX_EARLIER_LABEL : BUY_BOX_CAUSE_LABELS[group],
      percent: formatPct((100 * listings) / total),
      ratio: formatRatio(listings, total),
      action: buyBoxRowAction(group, listings),
    };
  });
}

/**
 * The plan with the Buy Box row replaced by its rows in place. Each row keeps the Buy Box row's rank, so
 * every other item keeps the number the one central ranking gives it; the earlier-days
 * row sits just below the two withheld rows. Unchanged while the split is loading or failed, or
 * while the row has no reading.
 */
export function planWithBuyBoxCauses(
  plan: readonly PlanItem[],
  split: BuyBoxCauseSplit | null,
  est: ClientEstimates | null = null,
): readonly PlanItem[] {
  if (!split) return plan;
  const at = plan.findIndex((item) => item.id === BUY_BOX_ROW_ID);
  const base = at >= 0 ? plan[at] : null;
  if (!base || base.loading || base.noReading) return plan;
  const rows = buyBoxCauseItems(base, split, est);
  if (rows.length === 0) return plan;
  return [...plan.slice(0, at), ...rows, ...plan.slice(at + 1)];
}
