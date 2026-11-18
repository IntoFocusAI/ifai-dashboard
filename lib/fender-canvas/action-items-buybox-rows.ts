/**
 * Action Items fix list: the Buy Box withheld row split by cause (roadmap gap audit recommendation
 * 3, Brian Magazu, 18 Nov 2026). One row for the listings priced above Amazon's reference price,
 * one for the other withheld listings. Line 2's dollar is split over the same two groups: the price
 * row takes its listings' parts, the other row takes every other part of line 2, so the two rows add
 * up to line 2 and the fix list still adds up to Phase 1. One template for every client.
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

export const BUY_BOX_CAUSE_ROW_IDS: Readonly<Record<BuyBoxCause, string>> = {
  price: "finding:buy_box:price",
  other: "finding:buy_box:other",
};

const CAUSES: readonly BuyBoxCause[] = ["price", "other"];

const TRAIL_TITLES: Record<BuyBoxCause, string> = {
  price: "Buy Box withheld, priced above Amazon's reference price",
  other: "Buy Box withheld, other or unknown cause",
};

const TRAIL_MEANS: Record<BuyBoxCause, string> = {
  price:
    "The brand's Amazon sales lost in a year on days when a listing had stock and no Buy Box, for the listings priced above Amazon's reference price today.",
  other:
    "The brand's Amazon sales lost in a year on days when a listing had stock and no Buy Box, for every other listing: those withheld today for another or an unknown cause, and those that lost the Buy Box on earlier days.",
};

export function buyBoxCauseOf(itemId: string): BuyBoxCause | null {
  return CAUSES.find((cause) => BUY_BOX_CAUSE_ROW_IDS[cause] === itemId) ?? null;
}

/** The price row keeps its listings; the other row keeps every other listing of line 2. */
function keeper(cause: BuyBoxCause, split: BuyBoxCauseSplit): (asin: string) => boolean {
  return cause === "price" ? (asin) => split.priceAsins.has(asin) : (asin) => !split.priceAsins.has(asin);
}

const lineCache = new WeakMap<ClientEstimates, WeakMap<BuyBoxCauseSplit, Partial<Record<BuyBoxCause, EstimateResult>>>>();

/** Line 2 run on the cause's listings only, so the trail lists exactly the row's listings and inputs. */
export function buyBoxCauseLine(est: ClientEstimates, cause: BuyBoxCause, split: BuyBoxCauseSplit): EstimateResult {
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
  const cached = lines[cause];
  if (cached) return cached;
  const keep = keeper(cause, split);
  const line = estimateBuyBox(
    est.inputs.filter((listing) => keep(listing.asin)),
    est.ctx,
  );
  const result = { ...line, trail: { ...line.trail, title: TRAIL_TITLES[cause], means: TRAIL_MEANS[cause] } };
  lines[cause] = result;
  return result;
}

/** The dollar on any fix-list row: a cause row reads its part of line 2, every other row its line. */
export function fixRowFigure(
  itemId: string,
  est: ClientEstimates,
  split: BuyBoxCauseSplit | null,
): LineListingsEstimate | null {
  const cause = buyBoxCauseOf(itemId);
  if (!cause || !split) return fixRowEstimate(itemId, est);
  const figure = lineFromListings(est, "buy_box", keeper(cause, split));
  return figure ? { ...figure, line: buyBoxCauseLine(est, cause, split) } : null;
}

function denominatorOf(ratio: string | null): number | null {
  const match = /^[\d,]+ of ([\d,]+)/.exec(ratio ?? "");
  const n = match ? Number(match[1]!.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The two cause rows from the Buy Box row, each with its count of the same population. */
export function buyBoxCauseItems(base: PlanItem, split: BuyBoxCauseSplit): PlanItem[] {
  const total = denominatorOf(base.ratio) ?? split.withheld;
  return CAUSES.map((cause) => {
    const listings = split[cause];
    return {
      ...base,
      id: BUY_BOX_CAUSE_ROW_IDS[cause],
      siteType: BUY_BOX_CAUSE_LABELS[cause],
      percent: formatPct((100 * listings) / total),
      ratio: formatRatio(listings, total),
      action: buyBoxCauseAction(cause, listings),
    };
  });
}

/**
 * The plan with the Buy Box row replaced by its two cause rows, ranks renumbered. Unchanged while
 * the split is loading or failed, while the row has no reading, or when every withheld listing has
 * one cause (the single row then already says it).
 */
export function planWithBuyBoxCauses(plan: readonly PlanItem[], split: BuyBoxCauseSplit | null): readonly PlanItem[] {
  if (!split || split.price === 0 || split.other === 0) return plan;
  const at = plan.findIndex((item) => item.id === BUY_BOX_ROW_ID);
  const base = at >= 0 ? plan[at] : null;
  if (!base || base.loading || base.noReading) return plan;
  const next = [...plan.slice(0, at), ...buyBoxCauseItems(base, split), ...plan.slice(at + 1)];
  return next.map((item, index) => ({ ...item, rank: index + 1 }));
}
