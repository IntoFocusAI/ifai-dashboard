/**
 * Action Items fix list: the Buy Box row split into three (roadmap gap audit recommendation 3, and
 * Brian Magazu's 18 Nov 2026 wording). One row for today's withheld listings priced above Amazon's
 * reference price, one for today's withheld listings with another or an unknown cause, and one for
 * the listings that lost the Buy Box on earlier days and have it back today.
 *
 * The dollar is the one Buy Box figure (R-06 and R-07, Brian Magazu, 23 Nov 2026): forward-looking,
 * for today's withheld listings, over the days in the date pill. Each withheld row carries its part
 * for exactly its own listings, so the two add up to the Suppressed Listings figure. The earlier-days
 * row keeps its count and has no dollar: the backward-looking figure it carried is retired. One
 * template for every client.
 */

import { buyBoxForPeriod } from "@/lib/estimates/buy-box";
import type { ClientEstimates } from "@/lib/estimates/live-inputs";
import { DEFAULT_PERIOD_DAYS } from "@/lib/estimates/period";
import type { EstimateResult } from "@/lib/estimates/types";
import {
  fixRowEstimate,
  FIX_ROW_LINES,
  type LineListingsEstimate,
} from "@/lib/fender-canvas/action-items-fix-list";
import {
  BUY_BOX_CAUSE_LABELS,
  buyBoxCauseAction,
  type BuyBoxCause,
  type BuyBoxCauseSplit,
} from "@/lib/fender-canvas/buy-box-cause";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import { itemCount, rankReason } from "@/lib/fender-canvas/priority-rank";
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

const TRAIL_TITLES: Record<Exclude<BuyBoxRowGroup, "earlier">, string> = {
  price: "Buy Box withheld, priced above Amazon's reference price",
  other: "Buy Box withheld, other or unknown cause",
};

const TRAIL_SCOPE: Record<Exclude<BuyBoxRowGroup, "earlier">, string> = {
  price: "Only the listings withheld today and priced above Amazon's reference price.",
  other: "Only the listings withheld today for another or an unknown cause.",
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

const lineCache = new WeakMap<ClientEstimates, WeakMap<BuyBoxCauseSplit, Map<string, EstimateResult>>>();

/**
 * The Buy Box figure over `periodDays` for one withheld cause row's listings only, so the trail
 * counts exactly the row's listings and inputs.
 */
export function buyBoxCauseLine(
  est: ClientEstimates,
  group: Exclude<BuyBoxRowGroup, "earlier">,
  split: BuyBoxCauseSplit,
  periodDays: number = DEFAULT_PERIOD_DAYS,
): EstimateResult {
  let bySplit = lineCache.get(est);
  if (!bySplit) {
    bySplit = new WeakMap();
    lineCache.set(est, bySplit);
  }
  let lines = bySplit.get(split);
  if (!lines) {
    lines = new Map();
    bySplit.set(split, lines);
  }
  const key = `${group}:${periodDays}`;
  const cached = lines.get(key);
  if (cached) return cached;
  const line = buyBoxForPeriod(est, periodDays, keeper(group, split));
  const result = {
    ...line,
    trail: { ...line.trail, title: TRAIL_TITLES[group], notes: [TRAIL_SCOPE[group], ...line.trail.notes] },
  };
  lines.set(key, result);
  return result;
}

/** A Buy Box line as a fix-list figure: its range, its listings, and how many have a sales rate. */
export function buyBoxRowEstimate(line: EstimateResult): LineListingsEstimate {
  const listings = line.trail.coverage.total;
  const priced = listings - line.trail.coverage.notAvailable;
  return {
    lineId: "buy_box",
    line,
    range: line.range,
    listings,
    priced,
    status: listings === 0 ? "none" : priced === 0 ? "not_available" : "estimated",
    inPhase1: true,
  };
}

/**
 * The dollar on any fix-list row. A Buy Box row reads the one Buy Box figure over the date pill's
 * days: the whole figure, or a withheld cause row's part. The earlier-days row has no dollar. Every
 * other row reads its yearly line.
 */
export function fixRowFigure(
  itemId: string,
  est: ClientEstimates,
  split: BuyBoxCauseSplit | null,
  periodDays: number = DEFAULT_PERIOD_DAYS,
): LineListingsEstimate | null {
  const group = buyBoxCauseOf(itemId);
  if (group === "earlier") return null;
  if (group && split) return buyBoxRowEstimate(buyBoxCauseLine(est, group, split, periodDays));
  if (FIX_ROW_LINES[itemId] === "buy_box") return buyBoxRowEstimate(buyBoxForPeriod(est, periodDays));
  return fixRowEstimate(itemId, est);
}

function denominatorOf(ratio: string | null): number | null {
  const match = /^[\d,]+ of ([\d,]+)/.exec(ratio ?? "");
  const n = match ? Number(match[1]!.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Listings not withheld today that had days with stock and no Buy Box in the last 12 months. */
export function earlierBuyBoxListings(est: ClientEstimates | null, split: BuyBoxCauseSplit): number {
  if (!est) return 0;
  const keep = keeper("earlier", split);
  return est.inputs.filter((l) => (l.noBuyBoxDays365 ?? 0) > 0 && keep(l.asin)).length;
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
  const total = base.count?.base ?? denominatorOf(base.ratio) ?? split.withheld;
  const counts: Record<BuyBoxRowGroup, number> = {
    price: split.price,
    other: split.other,
    earlier: earlierBuyBoxListings(est, split),
  };
  return GROUPS.filter((group) => counts[group] > 0).map((group) => {
    const listings = counts[group];
    // Each row's one count is its own listings, so its figure and its rank reason show one N. The
    // row keeps the Buy Box row's rank.
    const inputs = { ...base.inputs, affected: listings, base: total };
    return {
      ...base,
      inputs,
      count: itemCount(inputs, base.count?.label ?? base.label, base.partial != null),
      reason: rankReason(inputs),
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
