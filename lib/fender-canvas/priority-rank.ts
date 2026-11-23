/**
 * One central ranking (Brian Magazu, 23 Nov 2026). Every list of prioritized findings or actions
 * reads the order this module returns: Priorities, Action Items > Urgent Interventions, the deck's
 * fix slide, the map's action cards, the Briefing's first move, and Roadmap > 30-60-90 Days.
 *
 * The rule, approved:
 *   1. Estimated effect on AI answers: the share of its own base the gap touches (answers
 *      affected of the answers counted, listings affected of the listings counted). Answers and
 *      listings are never compared as raw counts.
 *   2. Ties broken by the monthly analyst-estimate dollars already on the item (no new formula).
 *   3. Then by effort: quicker fixes first.
 *
 * Approved 23 Nov 2026 and built as final: rule 1 uses each item's own base, and at 6 or more
 * Roadmap items no column holds more than half. Proposed for approval (PR body): shares compared in whole
 * percentage points; items with no count after every counted item; watch lines, on-track
 * findings and the outcome (Unbranded Discovery) after the items that need action; effort from
 * the work type decision 21g already assigns; the dependency list; and the phase placement.
 *
 * Pure: no reads, no client names.
 */

import { formatInt, formatMoneyShort, formatPct } from "@/lib/fender-canvas/format";

/** What an item's count counts. Each is compared only as a share of its own base. */
export type RankUnit = "answers" | "listings" | "links";

/** S = a listing or offer fix, M = catalog and site content, L = an outreach program (21g's work types). */
export type Effort = "S" | "M" | "L";

/**
 * action = needs action now (or has no stored reading yet), ranked by rules 1 to 3.
 * watch = a 21d watch line. on_track = a finding that needs no action.
 * outcome = the result every fix moves (Unbranded Discovery); it is tracked, never ranked as a fix.
 */
export type RankTier = "action" | "watch" | "on_track" | "outcome";

export type RankInputs = {
  /** Answers, listings, or links the gap touches. Null when the item has no single count. */
  affected: number | null;
  /** The population that count is out of. */
  base: number | null;
  unit: RankUnit | null;
  /** Monthly analyst estimate (the line's yearly mid divided by 12), USD. Null when no line covers the item. */
  monthly: number | null;
  effort: Effort;
  /** Ids of items that must be done before this one, when they are in the list. */
  dependsOn: readonly string[];
  tier: RankTier;
};

export type RankFields = {
  /** 1 = do this first. */
  rank: number;
  /** affected / base, 0 to 1; null when the item has no count. */
  share: number | null;
  /** One plain line naming the rank inputs. */
  reason: string;
};

export const EFFORT_LABEL: Record<Effort, string> = {
  S: "a listing or offer fix",
  M: "catalog and site content",
  L: "an outreach program",
};

const TIER_ORDER: Record<RankTier, number> = { action: 0, watch: 1, on_track: 2, outcome: 3 };
const EFFORT_ORDER: Record<Effort, number> = { S: 0, M: 1, L: 2 };

export function rankShare(inputs: Pick<RankInputs, "affected" | "base">): number | null {
  const { affected, base } = inputs;
  if (affected == null || base == null || base <= 0 || affected < 0) return null;
  return Math.min(1, affected / base);
}

/** Rule 1 compares whole percentage points, so items a point apart or less tie and go to rule 2. */
export function sharePoints(share: number | null): number | null {
  return share == null ? null : Math.round(100 * share);
}

/** Larger first; a missing value goes after every present one. */
function descending(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

/** Negative when `a` ranks before `b`. Equal inputs return 0, so callers keep their input order. */
export function compareRankInputs(a: RankInputs, b: RankInputs): number {
  return (
    TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
    descending(sharePoints(rankShare(a)), sharePoints(rankShare(b))) ||
    descending(a.monthly, b.monthly) ||
    EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort]
  );
}

const UNIT_WORD: Record<RankUnit, [string, string]> = {
  answers: ["answer", "answers"],
  listings: ["listing", "listings"],
  links: ["verified link", "verified links"],
};

/** "Touches 524 of 1,080 listings (48.5%). $12.3K a month, analyst estimate. Effort M, catalog and site content." */
export function rankReason(inputs: RankInputs): string {
  const parts: string[] = [];
  if (inputs.tier === "outcome") parts.push("The result every fix moves, tracked rather than ranked.");
  else if (inputs.tier === "on_track") parts.push("On track, so it follows the items that need action.");
  else if (inputs.tier === "watch") parts.push("A watch line, so it follows the items that need action.");
  const share = rankShare(inputs);
  if (share != null && inputs.unit) {
    const word = UNIT_WORD[inputs.unit][inputs.base === 1 ? 0 : 1];
    parts.push(`Touches ${formatInt(inputs.affected)} of ${formatInt(inputs.base)} ${word} (${formatPct(100 * share)}).`);
  } else if (inputs.tier === "action") {
    parts.push("Has no single answer or listing count, so it follows the counted items.");
  }
  if (inputs.monthly != null) parts.push(`${formatMoneyShort(inputs.monthly)} a month, analyst estimate.`);
  parts.push(`Effort ${inputs.effort}, ${EFFORT_LABEL[inputs.effort]}.`);
  return parts.join(" ");
}

/**
 * The one ordered list: sorted by tier, then rules 1 to 3, ties keeping input order. Ranks run 1
 * to N over every item; each item keeps its fields and gains rank, share, and reason.
 */
export function rankPriorities<T extends { inputs: RankInputs }>(items: readonly T[]): Array<T & RankFields> {
  return items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => compareRankInputs(a.item.inputs, b.item.inputs) || a.order - b.order)
    .map(({ item }, index) => ({
      ...item,
      rank: index + 1,
      share: rankShare(item.inputs),
      reason: rankReason(item.inputs),
    }));
}

/** At 6 or more items, no column holds more than half of them (Brian Magazu, approved 23 Nov 2026). */
export const PHASE_CAP_FROM = 6;

/**
 * Roadmap placement by rank and dependency, for the items the Roadmap shows, in rank order.
 * Returns each item's column, 0 to `columns - 1`.
 *
 * Each column takes up to a third of the items (rounded up), best rank first. An item goes in a
 * later column than every prerequisite in the list. When a column is at its third, the item goes
 * to the next column; a column may pass its third to keep a dependency, but at 6 or more items
 * never holds more than half (the last column takes what is left). An item whose prerequisite
 * ranks below it is placed after that prerequisite.
 */
export function placeByRank<T extends { id: string; inputs: Pick<RankInputs, "dependsOn"> }>(
  ranked: readonly T[],
  columns = 3,
): Map<string, number> {
  const n = ranked.length;
  const placed = new Map<string, number>();
  if (n === 0) return placed;
  const target = Math.ceil(n / columns);
  const cap = n >= PHASE_CAP_FROM ? Math.floor(n / 2) : n;
  const counts = new Array<number>(columns).fill(0);
  const ids = new Set(ranked.map((item) => item.id));
  const prerequisites = (item: T) => item.inputs.dependsOn.filter((id) => ids.has(id) && id !== item.id);
  const waiting = [...ranked];
  while (waiting.length) {
    // The best-ranked item whose prerequisites are all placed; a cycle falls back to rank order.
    let index = waiting.findIndex((item) => prerequisites(item).every((id) => placed.has(id)));
    if (index < 0) index = 0;
    const item = waiting.splice(index, 1)[0]!;
    const after = prerequisites(item).map((id) => placed.get(id));
    const earliest = Math.min(columns - 1, Math.max(0, ...after.map((column) => (column == null ? 0 : column + 1))));
    let column = -1;
    for (const limit of [target, cap]) {
      for (let k = earliest; k < columns && column < 0; k += 1) if (counts[k]! < limit) column = k;
      if (column >= 0) break;
    }
    if (column < 0) column = columns - 1;
    counts[column]! += 1;
    placed.set(item.id, column);
  }
  return placed;
}
