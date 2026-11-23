/**
 * One central ranking (Brian Magazu, 23 Nov 2026). Every list of prioritized findings or actions
 * reads the order this module returns: Priorities, Action Items > Urgent Interventions, the deck's
 * fix slide, the map's action cards, the Briefing's first move, and Roadmap > 30-60-90 Days.
 *
 * The rule, approved:
 *   0. Severity first (Brian Magazu, 23 Nov 2026 fix round 2): Critical, then At risk, then
 *      every ungraded item (Recommended, No reading), then lower (Watch, On track). SEVERITY_ORDER
 *      is the one order; severityOf maps every severity word the dashboard uses onto it. A
 *      Critical or At risk item leads only when its count is at least SEVERITY_FLOOR of its common
 *      base (fix round 3); under it, the item ranks with the ungraded items and keeps its tag.
 *   1. Reach in AI answers: the share of a common base the gap touches. An item that counts
 *      answers is measured against all resolved AI answers; an item that counts listings against
 *      all monitored listings (Brian Magazu, 23 Nov 2026 fix round: never its own base, so a
 *      question with 112 answers cannot outrank a fix touching thousands).
 *   2. Ties broken by the monthly analyst-estimate dollars already on the item (no new formula).
 *   3. Then by effort: quicker fixes first.
 *
 * Decided 23 Nov 2026 and built as final: rule 1 on the common base; at 6 or more Roadmap items
 * no column holds more than half; items with no answer or listing count (the Actuation confirm
 * and renew items among them) follow every counted item. Proposed for approval (PR body): shares
 * compared in whole percentage points; watch lines, on-track findings and the outcome (Unbranded
 * Discovery) after the items that need action; effort from the work type decision 21g already
 * assigns; the dependency list; and the phase placement.
 *
 * Pure: no reads, no client names.
 */

import { formatInt, formatMoneyShort, formatPct } from "@/lib/fender-canvas/format";

/** What an item's count counts. Answers and listings each have a common base; links have none. */
export type RankUnit = "answers" | "listings" | "links";

/** The units rule 1 measures, each against its common base. */
export type ReachUnit = Extract<RankUnit, "answers" | "listings">;

/** The common base per unit: all resolved AI answers, all monitored listings. */
export type ReachTotals = Partial<Record<ReachUnit, number | null>>;

/** S = a listing or offer fix, M = catalog and site content, L = an outreach program (21g's work types). */
export type Effort = "S" | "M" | "L";

/**
 * The severity floor (Brian Magazu, 23 Nov 2026 fix round 3): a Critical or At risk item ranks in
 * its severity tier only when its count is at least this share of its common base (all monitored
 * listings, or all resolved AI answers). Under it, the item ranks with everything else by reach,
 * then monthly dollars, then effort, and keeps its severity tag.
 */
export const SEVERITY_FLOOR = 0.05;

/** The floor as the screens state it: "5%". */
export const SEVERITY_FLOOR_LABEL = `${Math.round(100 * SEVERITY_FLOOR)}%`;

/** The floor in one plain sentence, for the Priorities description and the Action Items rule tooltip. */
export const SEVERITY_FLOOR_SENTENCE = `A Critical or At risk item that touches under ${SEVERITY_FLOOR_LABEL} of all monitored listings, or of all resolved AI answers, ranks with the rest and keeps its tag.`;

/**
 * action = needs action now (or has no stored reading yet), ranked by rules 1 to 3.
 * watch = a 21d watch line. on_track = a finding that needs no action.
 * outcome = the result every fix moves (Unbranded Discovery); it is tracked, never ranked as a fix.
 */
export type RankTier = "action" | "watch" | "on_track" | "outcome";

/**
 * The one severity order (Brian Magazu, 23 Nov 2026 fix round 2): Critical > At risk (High) >
 * Moderate (Recommended, No reading: no grade) > lower (Watch, On track, the outcome).
 */
export type Severity = "critical" | "at_risk" | "moderate" | "low";

export const SEVERITY_ORDER: Readonly<Record<Severity, number>> = { critical: 0, at_risk: 1, moderate: 2, low: 3 };

/**
 * Every severity word the dashboard uses, mapped once onto the order: node tones (danger,
 * warning, success), the fix list's statuses (critical, at_risk, on_track, no_reading), the
 * Priorities words (critical, high, moderate), data statuses (bad, okay, good) and the status
 * labels (Critical, At risk, Recommended, Watch, On track, No reading). Anything else is moderate.
 */
const SEVERITY_WORDS: Readonly<Record<string, Severity>> = {
  danger: "critical",
  critical: "critical",
  bad: "critical",
  warning: "at_risk",
  at_risk: "at_risk",
  "at risk": "at_risk",
  high: "at_risk",
  okay: "at_risk",
  moderate: "moderate",
  recommended: "moderate",
  no_reading: "moderate",
  "no reading": "moderate",
  neutral: "moderate",
  success: "low",
  good: "low",
  on_track: "low",
  "on track": "low",
  watch: "low",
  low: "low",
};

export function severityOf(word: string | null | undefined): Severity {
  return (word && SEVERITY_WORDS[word.trim().toLowerCase()]) || "moderate";
}

export type RankInputs = {
  /**
   * Critical, At risk, moderate, or lower (SEVERITY_ORDER). Absent reads as moderate. rankPlan
   * sets it from each item's status, so every list orders the same.
   */
  severity?: Severity;
  /** Answers, listings, or links the gap touches. Null when the item has no single count. */
  affected: number | null;
  /** The population that count is out of, as the item's own figure shows it. */
  base: number | null;
  unit: RankUnit | null;
  /**
   * What the count counts, as the problem, when the item's own label names something else:
   * "Listings without an exact official product page" for a finding whose label counts the pages
   * found. The item's label otherwise.
   */
  counts?: string;
  /**
   * The common base rule 1 measures against: all resolved AI answers for an answers item, all
   * monitored listings for a listings item. Null for a unit with no common base. rankPriorities
   * sets it; when it is absent, rankShare falls back to the own base.
   */
  reach?: number | null;
  /** Monthly analyst estimate (the line's yearly mid divided by 12), USD. Null when no line covers the item. */
  monthly: number | null;
  effort: Effort;
  /** Ids of items that must be done before this one, when they are in the list. */
  dependsOn: readonly string[];
  tier: RankTier;
};

/**
 * The one count an item carries (Brian Magazu, 23 Nov 2026 fix round 2). Every surface renders an
 * item's figure and its rank reason from this field through countRatio, countFigure and
 * countReach, so the figure and the reason always show the same N.
 */
export type ItemCount = {
  /** What is counted, as the problem: "Listings without an exact official product page". */
  label: string;
  /** The problem count N. */
  affected: number;
  /** The item's own measured base M. */
  base: number;
  unit: RankUnit;
  /** The common base rule 1 measured N against; null for a unit with none (verified links). */
  common: number | null;
  /** True when the own base is a partial or filtered figure (it shows with an asterisk). */
  partial: boolean;
};

export type RankFields = {
  /** 1 = do this first. */
  rank: number;
  /** affected / base, 0 to 1; null when the item has no count. */
  share: number | null;
  /** One plain line naming the rank inputs. */
  reason: string;
  /** The item's one count; null when it has no single count. */
  count: ItemCount | null;
};

export const EFFORT_LABEL: Record<Effort, string> = {
  S: "a listing or offer fix",
  M: "catalog and site content",
  L: "an outreach program",
};

/** The effort in words (fix round 3): never the bare letter on screen or in a CSV. */
export const EFFORT_WORD: Record<Effort, string> = { S: "Small effort", M: "Medium effort", L: "Large effort" };

/** "Medium effort, catalog and site content". */
export function effortPhrase(effort: Effort): string {
  return `${EFFORT_WORD[effort]}, ${EFFORT_LABEL[effort]}`;
}

const TIER_ORDER: Record<RankTier, number> = { action: 0, watch: 1, on_track: 2, outcome: 3 };
const EFFORT_ORDER: Record<Effort, number> = { S: 0, M: 1, L: 2 };

export function rankShare(inputs: Pick<RankInputs, "affected" | "base" | "reach">): number | null {
  const { affected } = inputs;
  const base = inputs.reach === undefined ? inputs.base : inputs.reach;
  if (affected == null || base == null || base <= 0 || affected < 0) return null;
  return Math.min(1, affected / base);
}

function isReachUnit(unit: RankUnit | null): unit is ReachUnit {
  return unit === "answers" || unit === "listings";
}

/**
 * The common base per unit. For listings, the read's total (monitoredListingsTotal) is the base
 * when there is one, the same number the retail heroes grade on; items never widen it. Otherwise
 * (and always for answers) the base is the largest of the read's total, any common base an item
 * already carries and every item's own base, so no item touches more than its common base.
 */
export function commonReach(items: readonly { inputs: RankInputs }[], totals: ReachTotals = {}): Record<ReachUnit, number | null> {
  const reach: Record<ReachUnit, number | null> = { answers: totals.answers ?? null, listings: totals.listings ?? null };
  const fixed = { answers: false, listings: reach.listings != null };
  for (const { inputs } of items) {
    if (!isReachUnit(inputs.unit) || fixed[inputs.unit]) continue;
    for (const value of [inputs.base, inputs.reach]) {
      if (value != null && value > 0) reach[inputs.unit] = Math.max(reach[inputs.unit] ?? 0, value);
    }
  }
  return reach;
}

/** Each item with its common base set (null for a unit with none, such as verified links). */
export function withCommonReach<T extends { inputs: RankInputs }>(items: readonly T[], totals: ReachTotals = {}): T[] {
  const reach = commonReach(items, totals);
  return items.map((item) => ({
    ...item,
    inputs: { ...item.inputs, reach: isReachUnit(item.inputs.unit) ? reach[item.inputs.unit] : null },
  }));
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

/**
 * The severity the order uses: the item's own, except that a Critical or At risk item whose count
 * is under SEVERITY_FLOOR of its common base (or that has no count on one) ranks as moderate,
 * with everything else. The item's tag still shows its own severity.
 */
export function rankSeverity(inputs: Pick<RankInputs, "severity" | "affected" | "base" | "reach">): Severity {
  const severity = inputs.severity ?? "moderate";
  if (severity !== "critical" && severity !== "at_risk") return severity;
  const share = rankShare(inputs);
  return share != null && share >= SEVERITY_FLOOR ? severity : "moderate";
}

/** Negative when `a` ranks before `b`. Equal inputs return 0, so callers keep their input order. */
export function compareRankInputs(a: RankInputs, b: RankInputs): number {
  return (
    TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
    SEVERITY_ORDER[rankSeverity(a)] - SEVERITY_ORDER[rankSeverity(b)] ||
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

/** The common base's words, when rule 1 measured against it. */
const REACH_WORD: Record<ReachUnit, [string, string]> = {
  answers: ["resolved AI answer", "resolved AI answers"],
  listings: ["monitored listing", "monitored listings"],
};

/** The item's one count from its rank inputs, or null when it has no single count. */
export function itemCount(inputs: RankInputs, label: string, partial = false): ItemCount | null {
  const { affected, base, unit } = inputs;
  if (affected == null || base == null || base <= 0 || affected < 0 || !unit) return null;
  const common = isReachUnit(unit) ? (inputs.reach === undefined ? null : inputs.reach) : null;
  return { label: inputs.counts ?? label, affected, base, unit, common, partial };
}

/** "1,018 of 1,109", with the asterisk when the own base is partial. */
export function countRatio(count: ItemCount): string {
  return `${formatInt(count.affected)} of ${formatInt(count.base)}${count.partial ? "*" : ""}`;
}

/** N as a share of its own base: "91.8%". */
export function countPercent(count: ItemCount): string {
  return formatPct(count.base > 0 ? (100 * count.affected) / count.base : 0);
}

/** The figure line: "Listings without an exact official product page: 1,018 of 1,109". */
export function countFigure(count: ItemCount): string {
  return `${count.label}: ${countRatio(count)}`;
}

/**
 * Rule 1's sentence, from the same count: "Touches 1,018 of 1,198 monitored listings (85.0%)."
 * Measured on the common base when there is one, on the own base otherwise.
 */
export function countReach(count: ItemCount): string {
  const common = count.common != null && count.common > 0 && isReachUnit(count.unit);
  const base = common ? count.common! : count.base;
  const word = (common ? REACH_WORD[count.unit as ReachUnit] : UNIT_WORD[count.unit])[base === 1 ? 0 : 1];
  const share = Math.min(1, count.affected / base);
  return `Touches ${formatInt(count.affected)} of ${formatInt(base)} ${word} (${formatPct(100 * share)}).`;
}

/**
 * The item's data line, and nothing else (Brian Magazu, 23 Nov 2026 fix round 3: the severity tag
 * and the panel description already say why it sits where it does): "Touches 524 of 1,170
 * monitored listings (44.8%). $12.3K a month, analyst estimate. Medium effort, catalog and site content."
 */
export function rankReason(inputs: RankInputs): string {
  const parts: string[] = [];
  const count = itemCount(inputs, "");
  if (count) parts.push(countReach(count));
  if (inputs.monthly != null) parts.push(`${formatMoneyShort(inputs.monthly)} a month, analyst estimate.`);
  parts.push(`${effortPhrase(inputs.effort)}.`);
  return parts.join(" ");
}

/**
 * The one ordered list: each item's common base set, then sorted by tier, then rules 1 to 3, ties
 * keeping input order. Ranks run 1 to N over every item; each item keeps its fields and gains
 * rank, share, and reason.
 */
export function rankPriorities<T extends { inputs: RankInputs; label?: string; partial?: unknown }>(
  items: readonly T[],
  totals: ReachTotals = {},
): Array<T & RankFields> {
  return withCommonReach(items, totals)
    .map((item, order) => ({ item, order }))
    .sort((a, b) => compareRankInputs(a.item.inputs, b.item.inputs) || a.order - b.order)
    .map(({ item }, index) => ({
      ...item,
      rank: index + 1,
      share: rankShare(item.inputs),
      reason: rankReason(item.inputs),
      count: itemCount(item.inputs, item.label ?? "", item.partial != null),
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
