/**
 * The one central ranking in the form other views consume (the Briefing's three gaps and first
 * move, Priorities, the deck, the map). A pure function of the plan Action Items shows; it adds
 * nothing to the order and drops nothing but the fields a reader does not need.
 */

import { countRatio, type RankFields, type RankInputs } from "@/lib/fender-canvas/priority-rank";
import type { PlanItem, PlanKind } from "@/lib/fender-canvas/roadmap-plan";

/**
 * What the gap is, from the item id: a finding or signal id ("buy_box", "out_of_stock",
 * "missing_specs", "fact_contradictions", "aplus"), or the family of a generated item ("rival",
 * "source", "engine", "question", "site", "own_pages", "own_wording", "actuation_confirm",
 * "actuation_activity", "actuation_renew").
 */
export type GapKind = string;

/**
 * Every item kind the plan can produce, and whether it carries the one count (priority-rank.ts
 * ItemCount). A counted kind shows its figure and its rank reason from that count. The test
 * builds a synthetic plan with every kind and fails on a kind missing here or a counted kind
 * without its count (Brian Magazu, 23 Nov 2026 fix round 2).
 */
export const GAP_KINDS: Readonly<Record<string, "counted" | "uncounted">> = {
  exact_official_product: "counted",
  map_leakage: "counted",
  splintered_bundles: "counted",
  buy_box: "counted",
  unbranded_discovery: "counted",
  out_of_stock: "counted",
  missing_specs: "counted",
  fact_contradictions: "counted",
  rival: "counted",
  aplus: "counted",
  amazon_bullets: "counted",
  source: "counted",
  own_pages: "counted",
  own_wording: "counted",
  engine: "counted",
  question: "counted",
  questions: "counted",
  site: "counted",
  actuation_activity: "counted",
  actuation_confirm: "uncounted",
  actuation_renew: "uncounted",
};

export type RankedPriority = RankFields & {
  id: string;
  kind: PlanKind;
  gapKind: GapKind;
  /** The task, phrased as an action. */
  actionTitle: string;
  /** The finding or signal label, as its home tab shows it. */
  label: string;
  /** The figure: the one count's N of M (countRatio), or the own figure for an item with no count. */
  figure: string | null;
  /** True when the figure is partial (it shows with an asterisk). */
  partial: boolean;
  inputs: RankInputs;
  /** Needs action now, or has no stored reading yet (it is on the Roadmap). */
  needsAction: boolean;
  open: { spokeId: string; tab: string };
};

export function gapKindOf(id: string): GapKind {
  const [family, second, third] = id.split(":");
  if (family === "finding" || family === "estimate") return second ?? family;
  if (family === "signal") return second === "rival" ? "rival" : (second ?? family);
  if (family === "focus") return second ?? family;
  if (family === "own") return `own_${second}`;
  if (family === "actuation") return `actuation_${third ?? second}`;
  return family ?? id;
}

/** The ranked list, best first, as a reader consumes it. */
export function priorityList(plan: readonly PlanItem[]): RankedPriority[] {
  return plan.map((item) => ({
    id: item.id,
    kind: item.kind,
    gapKind: gapKindOf(item.id),
    actionTitle: item.title,
    label: item.label,
    figure: item.count ? countRatio(item.count) : (item.ratio ?? item.percent),
    partial: item.partial != null,
    inputs: item.inputs,
    rank: item.rank,
    share: item.share,
    reason: item.reason,
    count: item.count,
    needsAction: item.inputs.tier === "action" && (item.needsAction || item.noReading),
    open: item.open,
  }));
}

/** The first move and the top gaps that need action, for the Briefing. */
export function topPriorities(plan: readonly PlanItem[], count: number): RankedPriority[] {
  return priorityList(plan).filter((item) => item.needsAction).slice(0, count);
}
