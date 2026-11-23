/**
 * The plan Action Items and the Roadmap share (decision 21, FDD S-02, N-01, N-04), in the one
 * central order (priority-rank.ts, Brian Magazu, 23 Nov 2026): Critical items first, then At risk,
 * then the rest (fix round 2); within each, first by reach, the share of all
 * resolved AI answers or all monitored listings each gap touches, then by monthly
 * analyst-estimate dollars, then by effort. Priorities, the
 * deck's fix slide, the map's action cards, and the Briefing's first move read the same list.
 * Roadmap columns follow the rank and each item's prerequisites (placeByRank), not the item type;
 * 21g's work types now set the effort only. The plan is rebuilt from each read and dated from
 * today (rolling 90 days), so an action leaves when its trigger clears (21h) and a new one enters
 * when its trigger is met.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { FactCheckReviewAnswer } from "@/lib/ai-search/drift";
import type { EvidenceFocus } from "@/lib/ai-search/evidence-focus";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { brandSite } from "@/lib/brand-copy";
import type { ClientEstimates } from "@/lib/estimates/live-inputs";
import {
  fixRowMonthly,
  rankFixList,
  type FixListRow,
} from "@/lib/fender-canvas/action-items-fix-list";
import type { BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import {
  placeByRank,
  rankPriorities,
  countPercent,
  countRatio,
  severityOf,
  type Effort,
  type ItemCount,
  type RankInputs,
  type ReachTotals,
} from "@/lib/fender-canvas/priority-rank";
import {
  SITE_TYPE_LABELS,
  type CitedPage,
  type SiteType,
  type SourceAction,
} from "@/lib/fender-canvas/roadmap-sources";
import type { ActuationAction, SuggestedTarget } from "@/lib/fender-canvas/roadmap-actuation";
import type { FocusAction, PlanFocus } from "@/lib/fender-canvas/roadmap-focus";
import {
  FACTOR_COVERED_BY,
  OWN_SITE_CITED_THRESHOLD,
  urgentOwnPagesAction,
  type OwnPageAction,
  type OwnPageFactor,
} from "@/lib/fender-canvas/roadmap-own-pages";
import type { SignalAction } from "@/lib/fender-canvas/roadmap-signals";
import { findingAction, hasStoredReading } from "@/lib/fender-canvas/urgent-interventions-rows";

export type PlanPhase = "days_1_30" | "days_31_60" | "days_61_90";

export const PLAN_PHASES: ReadonlyArray<{ id: PlanPhase; label: string; focus: string }> = [
  { id: "days_1_30", label: "Days 1 to 30", focus: "Highest ranked first" },
  { id: "days_31_60", label: "Days 31 to 60", focus: "Next by rank" },
  { id: "days_61_90", label: "Days 61 to 90", focus: "Then by rank" },
];

/** Shown where an item has no dated phase: Unbranded Discovery moves with the fixes before it. */
export const ALL_PHASES_LABEL = "All phases";

/**
 * Effort (rule 3) from the work type 21g already assigns: a listing or offer fix is S, catalog and
 * site content is M, an outreach program is L. The type no longer sets the Roadmap column.
 */
const EFFORT_OF_WORK: Record<PlanPhase, Effort> = { days_1_30: "S", days_31_60: "M", days_61_90: "L" };

const SOURCE_WORK: Partial<Record<SiteType, PlanPhase>> = {
  retailer: "days_1_30",
  competitor_brand: "days_31_60",
  reference: "days_31_60",
  publication: "days_61_90",
  community: "days_61_90",
  video: "days_61_90",
};

const SIGNAL_WORK: Record<string, PlanPhase> = {
  "signal:out_of_stock": "days_1_30",
  "signal:missing_specs": "days_31_60",
  "signal:fact_contradictions": "days_31_60",
};

/**
 * Prerequisites (proposed): content published on the brand's site waits on the exact official
 * product pages it sits on. Fact corrections start on those pages, comparison content and the
 * rewording of the brand's pages are published there. An item is placed in a later Roadmap
 * column than each prerequisite that is in the list.
 */
export const OFFICIAL_PAGES_ID = "finding:exact_official_product";

function prerequisitesOf(id: string): string[] {
  if (id === "signal:fact_contradictions" || id.startsWith("signal:rival:") || id === "own:wording") {
    return [OFFICIAL_PAGES_ID];
  }
  return [];
}

function effortOf(work: PlanPhase | null | undefined): Effort {
  return work ? EFFORT_OF_WORK[work] : "M";
}

export type PlanKind = "finding" | "signal" | "source" | "own_page" | "focus" | "actuation";

export type PlanItem = {
  id: string;
  kind: PlanKind;
  /** The central rank, 1 = do this first (priority-rank.ts). */
  rank: number;
  /** The Roadmap column, by rank and prerequisites; null for an item the Roadmap does not show. */
  phase: PlanPhase | null;
  label: string;
  /** The figure, as its home tab shows it. */
  percent: string;
  ratio: string | null;
  /** Status tone for a finding; null for a signal or source action, which carry no grade. */
  tone: Exclude<NodeStatus, "neutral"> | null;
  statusLabel: string;
  fact: string;
  action: string;
  /** Critical or at risk, or a signal or source over its threshold. */
  needsAction: boolean;
  /** A finding whose reading is not stored. */
  noReading: boolean;
  loading: boolean;
  partial: PartialFigure | null;
  open: { spokeId: string; tab: string };
  siteType: string | null;
  pages: CitedPage[];
  /** The rows the evidence button opens on, when the tab can narrow to them. */
  evidence: EvidenceFocus | null;
  /** Stored category keys the item belongs to; empty when it is brand-wide (client focus). */
  categories: string[];
  /** An AI row's tooltip: the latest run's count, "Latest run (Nov 12): X of Y" (roadmap-latest). */
  tip?: string | null;
  /** An Actuation confirm item's suggested target sites, each opening its Citation Ecosystem rows. */
  targets?: { label: string; sites: SuggestedTarget[] } | null;
  /** The fact-check review task's flagged answers, each linking to its quote and source fact. */
  reviews?: FactCheckReviewAnswer[];
  /** The central rank's inputs (priority-rank.ts). */
  inputs: RankInputs;
  /** affected / base, 0 to 1; null when the item has no count. */
  share: number | null;
  /** One plain line naming the rank inputs. */
  reason: string;
  /**
   * The item's one count (priority-rank.ts): the problem count N of its own base M, and the common
   * base rule 1 used. Every surface shows the figure and the rank reason from it.
   */
  count: ItemCount | null;
  /** The own-pages item's factors below Good, worst first, so rankPlan can skip one another item fixes. */
  ownFactors?: OwnPageFactor[];
  /** The item as a task ("Publish one brand-site page for each exact product"), never a finding label. */
  title: string;
  /** A grouped item's members (the questions that share its action), each with its own figure. */
  members?: Array<{ id: string; label: string; ratio: string }>;
};

/** An item before rankPlan gives it a rank, a share, a reason, a task title, and a column. */
export type UnrankedPlanItem = Omit<PlanItem, "rank" | "phase" | "share" | "reason" | "title" | "count">;

/** The five findings as tasks (the deck outline's short actions). */
function findingTask(id: string): string | null {
  const tasks: Record<string, string> = {
    "finding:exact_official_product": `Publish one ${brandSite()} page for each exact product`,
    "finding:map_leakage": "Raise offers below MAP back to the floor",
    "finding:splintered_bundles": "Nest each bundle under the official parent listing",
    "finding:buy_box": "Correct each offer so the Buy Box returns",
    "finding:unbranded_discovery": "Track Unbranded Discovery as the result",
  };
  return tasks[id] ?? null;
}

const SIGNAL_TASK: Record<string, string> = {
  "signal:out_of_stock": "Restock or correct the out-of-stock listings",
  "signal:missing_specs": "Fill the missing Amazon spec fields",
  "signal:fact_contradictions": "Review the answers the fact check flagged",
};

/**
 * The item as a task. Findings and the listing signals have a short task; every other item's
 * action already opens on its verb, so its title is that first sentence or clause.
 */
export function actionTitle(item: Pick<PlanItem, "id" | "action">): string {
  const fixed = findingTask(item.id) ?? SIGNAL_TASK[item.id];
  if (fixed) return fixed;
  const first = item.action.split(/(?<=\.)\s|:\s/)[0] ?? item.action;
  return first.replace(/\.$/, "").trim();
}

export const RECOMMENDED_LABEL = "Recommended";
/** 21d: a weakest engine or question less than 10 points behind the best, shown so the client sees it. */
export const WATCH_LABEL = "Watch";

function findingItem(row: FixListRow): UnrankedPlanItem {
  const { finding } = row;
  return {
    id: `finding:${finding.id}`,
    kind: "finding",
    label: finding.label,
    percent: finding.percent,
    ratio: finding.ratio,
    tone: row.status === "no_reading" ? null : finding.tone,
    statusLabel: row.statusLabel,
    fact: finding.explainer,
    action: finding.loading ? "Loading the reading." : row.action,
    needsAction: row.status === "critical" || row.status === "at_risk",
    noReading: row.status === "no_reading",
    loading: finding.loading,
    partial: finding.partial,
    open: { spokeId: finding.spokeId, tab: finding.tab },
    siteType: null,
    pages: [],
    evidence: null,
    categories: [],
    inputs: row.inputs,
  };
}

function signalItem(signal: SignalAction, est: ClientEstimates | null): UnrankedPlanItem {
  const rival = signal.id.startsWith("signal:rival:");
  return {
    id: signal.id,
    kind: "signal",
    label: signal.label,
    percent: formatPct(100 * (signal.denominator ? signal.numerator / signal.denominator : signal.share)),
    ratio: signal.denominator != null ? formatRatio(signal.numerator, signal.denominator) : null,
    tone: null,
    statusLabel: RECOMMENDED_LABEL,
    fact: signal.fact,
    action: signal.action,
    needsAction: true,
    noReading: false,
    loading: false,
    partial: signal.partial,
    open: signal.open,
    siteType: null,
    pages: [],
    evidence: null,
    categories: signal.categories ?? [],
    ...(signal.reviews ? { reviews: signal.reviews } : {}),
    inputs: {
      affected: signal.denominator != null ? signal.numerator : null,
      base: signal.denominator,
      unit: signal.group === "ecommerce" ? "listings" : "answers",
      monthly: fixRowMonthly(signal.id, est),
      effort: effortOf(rival ? "days_31_60" : SIGNAL_WORK[signal.id]),
      dependsOn: prerequisitesOf(signal.id),
      tier: "action",
    },
  };
}

function sourceItem(source: SourceAction): UnrankedPlanItem {
  return {
    id: `source:${source.domain}`,
    kind: "source",
    label: source.domain,
    percent: formatPct(100 * source.share),
    ratio: formatRatio(source.answers, source.answersWithSources),
    tone: null,
    statusLabel: RECOMMENDED_LABEL,
    fact: source.fact,
    action: source.action,
    needsAction: true,
    noReading: false,
    loading: false,
    partial: null,
    open: { spokeId: "aeo", tab: "Citation Ecosystem" },
    siteType: SITE_TYPE_LABELS[source.type],
    pages: source.pages,
    evidence: { field: "domain", value: source.domain },
    categories: source.categoryKeys,
    inputs: {
      affected: source.answers,
      base: source.answersWithSources,
      unit: "answers",
      monthly: null,
      effort: effortOf(SOURCE_WORK[source.type]),
      dependsOn: [],
      tier: "action",
    },
  };
}

/**
 * The brand's own pages. The urgent row ranks by its worst factor (Brian Magazu, 23 Nov 2026 fix
 * round): the listings that factor falls short on. The wording row counts the answers short of
 * 21c's 30% target.
 */
function ownPageInputs(own: OwnPageAction): RankInputs {
  const counted = own.id === "own:wording" && own.cited ? own.cited : null;
  const short = counted ? Math.max(0, Math.ceil(OWN_SITE_CITED_THRESHOLD * counted.total) - counted.answers) : null;
  const worst = own.id === "own:pages" ? (own.worst ?? null) : null;
  const counts = worst
    ? worst.short
    : counted
      ? `Answers with sources short of ${brandSite()}'s ${Math.round(100 * OWN_SITE_CITED_THRESHOLD)}% citation target`
      : null;
  return {
    affected: worst ? worst.affected : short,
    base: worst ? worst.base : counted ? counted.total : null,
    unit: worst ? "listings" : counted ? "answers" : null,
    ...(counts ? { counts } : {}),
    monthly: null,
    // Fix round 3: the urgent row's effort is the factor it works on, not its phase.
    effort: own.effort ?? effortOf(own.phase),
    dependsOn: prerequisitesOf(own.id),
    tier: "action",
  };
}

function ownPageItem(own: OwnPageAction): UnrankedPlanItem {
  return {
    id: own.id,
    kind: "own_page",
    label: own.label,
    percent: own.percent,
    ratio: own.ratio,
    tone: own.tone,
    statusLabel: own.tone === "danger" ? "Critical" : own.tone === "warning" ? "At risk" : RECOMMENDED_LABEL,
    fact: own.fact,
    action: own.action,
    needsAction: true,
    noReading: false,
    loading: false,
    partial: null,
    open: own.open,
    siteType: null,
    pages: [],
    evidence: own.id === "own:wording" ? { field: "class", value: "fender_owned" } : null,
    categories: [],
    inputs: ownPageInputs(own),
    // The same gap in distinct pages, as the figure's tooltip (worker 32.18).
    tip: own.tip ?? null,
    ...(own.below ? { ownFactors: own.below } : {}),
  };
}

/** Answers short of the best comparable: the gap in points times the resolved answers. */
function shortOfBest(item: { gap: number; denominator: number }): number {
  return Math.round((item.gap / 100) * item.denominator);
}

/**
 * A weakest engine or question counts the answers it is short of the best comparable (its gap in
 * points times its resolved answers); a group of questions adds its questions' counts. A moving
 * site counts the answers that cite it. Rule 1 measures each against all resolved AI answers.
 */
function focusInputs(focus: FocusAction): RankInputs {
  const site = focus.focus === "site";
  const affected = site
    ? focus.numerator
    : focus.members
      ? focus.members.reduce((sum, member) => sum + shortOfBest(member), 0)
      : shortOfBest(focus);
  const counts = site
    ? null
    : focus.focus === "engine"
      ? `Answers behind the best engine on ${focus.label}`
      : "Answers behind the best question";
  return {
    affected: focus.denominator > 0 ? affected : null,
    base: focus.denominator > 0 ? focus.denominator : null,
    unit: "answers",
    ...(counts ? { counts } : {}),
    monthly: null,
    effort: focus.tier === "watch" ? "L" : effortOf(focus.siteType ? SOURCE_WORK[focus.siteType] : "days_31_60"),
    dependsOn: [],
    tier: focus.tier === "watch" ? "watch" : "action",
  };
}

function focusItem(focus: FocusAction): UnrankedPlanItem {
  return {
    id: focus.id,
    kind: "focus",
    label: focus.label,
    percent: formatPct(focus.denominator > 0 ? (100 * focus.numerator) / focus.denominator : 0),
    ratio: formatRatio(focus.numerator, focus.denominator),
    tone: null,
    statusLabel: focus.tier === "watch" ? WATCH_LABEL : RECOMMENDED_LABEL,
    fact: focus.fact,
    action: focus.action,
    needsAction: true,
    noReading: false,
    loading: false,
    partial: focus.partial,
    open: focus.open,
    siteType: focus.siteType ? SITE_TYPE_LABELS[focus.siteType] : null,
    pages: focus.pages,
    evidence: focus.evidence,
    categories: focus.categories,
    inputs: focusInputs(focus),
    ...(focus.members
      ? { members: focus.members.map((member) => ({ id: member.id, label: member.label, ratio: formatRatio(shortOfBest(member), member.denominator) })) }
      : {}),
  };
}

/** A confirm or renew item has no count; an activity item counts the verified links short of its target. */
function actuationInputs(item: ActuationAction): RankInputs {
  const activity = item.rule === "activity" && item.counts ? item.counts : null;
  return {
    affected: activity ? Math.max(0, activity.target - activity.count) : null,
    base: activity ? activity.target : null,
    unit: activity ? "links" : null,
    ...(activity ? { counts: "Verified links short of the target" } : {}),
    monthly: null,
    effort: effortOf(item.phase),
    dependsOn: [],
    tier: "action",
  };
}

function actuationItem(item: ActuationAction): UnrankedPlanItem {
  return {
    id: item.id,
    kind: "actuation",
    label: item.label,
    percent: item.percent,
    ratio: item.ratio,
    tone: null,
    statusLabel: RECOMMENDED_LABEL,
    fact: item.fact,
    action: item.action,
    needsAction: true,
    noReading: false,
    loading: false,
    partial: null,
    open: { spokeId: "aeo", tab: "Citation Ecosystem" },
    siteType: null,
    pages: [],
    evidence: null,
    categories: [],
    targets: item.targets,
    inputs: actuationInputs(item),
  };
}

/** The five findings in the central order, with their action lines and rank inputs. */
export function rankedFindings(findings: readonly BriefingFinding[], est: ClientEstimates | null = null): FixListRow[] {
  return rankFixList(
    findings.map((finding) => ({ finding, action: findingAction(finding), stored: hasStoredReading(finding) })),
    est,
  );
}

export type PlanInput = {
  findings: readonly BriefingFinding[];
  signals: readonly SignalAction[];
  sources: readonly SourceAction[];
  /** 21c: the own-page action, when a factor is below Good or the brand site is cited rarely. */
  ownPages?: OwnPageAction | null;
  /** 21d: the focus items, each past both guardrails. */
  focus?: readonly FocusAction[];
  /** SC-03: confirm, post against the target, or renew each Actuation program (roadmap-actuation). */
  actuation?: readonly ActuationAction[];
  /** The analyst estimates, for rule 2's monthly dollars. Null while they read. */
  estimates?: ClientEstimates | null;
  /** Rule 1's common bases from the reads: all resolved AI answers, all monitored listings. */
  reach?: ReachTotals;
  /** Other ranked candidates built from the reads (the Amazon bullets item). */
  extra?: readonly UnrankedPlanItem[];
};

/**
 * A moving site that already has a source action joins it: its movement sentence follows the
 * source action's fact, so one site is never listed twice.
 */
function mergeMovement(sources: readonly SourceAction[], focus: readonly FocusAction[]) {
  const domains = new Set(sources.map((source) => source.domain));
  const merged = new Map<string, string>();
  const rest: FocusAction[] = [];
  for (const item of focus) {
    const domain = item.focus === "site" && item.evidence?.field === "domain" ? item.evidence.value : null;
    if (domain && domains.has(domain) && item.trend) merged.set(`source:${domain}`, item.trend);
    else rest.push(item);
  }
  return { merged, rest };
}

/** True for an item the Roadmap shows in a column. Unbranded Discovery, the outcome, is never placed. */
export function onRoadmap(item: Pick<PlanItem, "needsAction" | "noReading" | "inputs">): boolean {
  return item.inputs.tier !== "outcome" && (item.needsAction || item.noReading);
}

/**
 * The one ordered list: every item ranked by priority-rank's rule, then placed in a Roadmap
 * column by rank and prerequisites. Items the Roadmap does not show have no column.
 */
export function rankPlan(items: readonly (UnrankedPlanItem | PlanItem)[], reach: ReachTotals = {}): PlanItem[] {
  const graded = withoutCoveredFactors(items).map((item) => ({
    ...item,
    rank: 0,
    phase: null,
    // Severity first (fix round 2), from the item's own status: one mapping for every list.
    inputs: { ...item.inputs, severity: severityOf(item.inputs.tier === "action" ? item.tone : "low") },
  }));
  // A re-rank (an added row, a focus) keeps the common base the first rank set: never a second one.
  const carried = (unit: "answers" | "listings") =>
    graded.find((item) => item.inputs.unit === unit && item.inputs.reach != null)?.inputs.reach ?? null;
  const ranked = rankPriorities(graded, {
    answers: reach.answers ?? carried("answers"),
    listings: reach.listings ?? carried("listings"),
  });
  const columns = placeByRank(ranked.filter(onRoadmap));
  return ranked.map((item) => {
    const column = columns.get(item.id);
    return { ...item, title: actionTitle(item), phase: column == null ? null : PLAN_PHASES[column]!.id } as PlanItem;
  });
}

/** True for a ranked item that needs action now: it can cover an own-pages factor. */
function fixesNow(item: Pick<PlanItem, "inputs" | "needsAction">): boolean {
  return item.inputs.tier === "action" && item.needsAction;
}

/**
 * No duplicate fixes (Brian Magazu, 23 Nov 2026 fix round 2): the own-pages item skips each factor
 * another item in the list already fixes (FACTOR_COVERED_BY) and starts on its worst remaining
 * factor. With no factor left, it drops. It is rebuilt from its full factor list each time, so a
 * factor returns when the item covering it leaves the list.
 */
function withoutCoveredFactors<T extends UnrankedPlanItem | PlanItem>(items: readonly T[]): T[] {
  const fixing = new Set(items.filter(fixesNow).map((item) => item.id));
  return items.flatMap((item) => {
    if (item.id !== "own:pages" || !item.ownFactors?.length) return [item];
    const all = urgentOwnPagesAction(item.ownFactors);
    const left = urgentOwnPagesAction(
      item.ownFactors.filter((factor) => {
        const by = FACTOR_COVERED_BY[factor.id];
        return !(by && fixing.has(by));
      }),
    );
    if (!left || !all) return [];
    // Keep any sentence added after the factor list (the AI Actuation gap).
    const added = item.fact.startsWith(all.fact) ? item.fact.slice(all.fact.length) : "";
    const rebuilt = ownPageItem({ ...left, fact: `${left.fact}${added}` });
    return [{ ...item, ...rebuilt, ownFactors: item.ownFactors } as T];
  });
}

/** Every item in the central order, ranked 1 to N. */
export function buildPlan(input: PlanInput): PlanItem[] {
  const est = input.estimates ?? null;
  const { merged, rest } = mergeMovement(input.sources, input.focus ?? []);
  return rankPlan([
    ...rankedFindings(input.findings, est).map(findingItem),
    ...input.signals.map((signal) => signalItem(signal, est)),
    ...(input.ownPages ? [ownPageItem(input.ownPages)] : []),
    ...input.sources.map((source) => {
      const item = sourceItem(source);
      const trend = merged.get(item.id);
      return trend ? { ...item, fact: `${item.fact} ${trend}` } : item;
    }),
    ...rest.map(focusItem),
    ...(input.actuation ?? []).map(actuationItem),
    ...(input.extra ?? []),
  ], input.reach);
}

/**
 * The figure every surface shows for an item (Action Items, the Roadmap, the CSV): from its one
 * count when it has one, so the label names the problem and N matches the rank reason. The ratio
 * carries no asterisk; the screens mark the percent, and the CSV marks it with markPartial.
 */
export function planFigure(item: Pick<PlanItem, "count" | "label" | "percent" | "ratio">): { label: string; percent: string; ratio: string | null } {
  if (item.count) return { label: item.count.label, percent: countPercent(item.count), ratio: countRatio({ ...item.count, partial: false }) };
  return { label: item.label, percent: item.percent, ratio: item.ratio };
}

/** True for a plan item Priorities lists: it needs action now, or its reading is not stored yet. */
export function inPriorities(item: Pick<PlanItem, "inputs" | "needsAction" | "noReading">): boolean {
  return item.inputs.tier === "action" && (item.needsAction || item.noReading);
}

/**
 * The first move: central #1, the first item Priorities lists (so Priorities' first card, the
 * command-center items' first entry, TODAY'S READ and the Briefing's first move are one item).
 * Null when nothing needs action.
 */
export function firstMove(plan: readonly PlanItem[]): PlanItem | null {
  return plan.find(inPriorities) ?? null;
}

/**
 * The plan for a client focus: brand-wide items stay, and an item tied to categories stays when
 * one of them is the focus. Ranks and columns are recomputed. The brand focus returns the plan unchanged.
 */
export function focusPlan(plan: readonly PlanItem[], focus: PlanFocus): PlanItem[] {
  if (focus.kind === "brand") return [...plan];
  return rankPlan(plan.filter((item) => item.categories.length === 0 || item.categories.includes(focus.key)));
}

/** Items in one phase, in plan order: those that need action, then findings with no reading. */
export function phaseItems(plan: readonly PlanItem[], phase: PlanPhase): PlanItem[] {
  return plan.filter((item) => item.phase === phase && (item.needsAction || item.noReading));
}

export function phaseLabel(phase: PlanPhase | null): string {
  return PLAN_PHASES.find((entry) => entry.id === phase)?.label ?? ALL_PHASES_LABEL;
}

/** N-04: the plain sentence when nothing needs action. Null when something does. */
export function emptyPlanLine(plan: readonly PlanItem[]): string | null {
  if (plan.some((item) => item.needsAction || item.loading)) return null;
  const unread = plan.filter((item) => item.noReading).length;
  if (unread > 0) {
    return `No finding with a stored reading needs action. ${formatInt(unread)} of ${formatInt(plan.filter((item) => item.kind === "finding").length)} readings are not stored.`;
  }
  return "Nothing needs action now. Every current finding is on track, and no other action meets its threshold.";
}

export const PLAN_FIGURE_LABEL = "findings need action";

/** The lead figure's disc: findings that need action (measured slice), then the rest read on track. */
export function planFindingsPie(figure: PlanFindingsFigure): PieDiscData | null {
  if (figure.phase !== "ready" || figure.stored <= 0) return null;
  return {
    id: "roadmap-findings",
    title: "Current findings",
    total: figure.stored,
    totalLabel: "current findings with a stored reading",
    slices: [
      { key: "measured", label: "Need action", count: figure.needs },
      { key: "rest", label: "On track", count: figure.stored - figure.needs },
    ].filter((slice) => slice.count > 0),
  };
}

export type PlanFindingsFigure =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; needs: number; stored: number; total: number; value: string; partial: PartialFigure | null };

/**
 * The Roadmap's lead figure and its map bubble: current findings that need action (Critical or
 * At risk) of those with a stored reading. One function, so the bubble and the tab agree.
 */
export function planFindingsFigure(findings: readonly BriefingFinding[]): PlanFindingsFigure {
  if (findings.some((finding) => finding.loading)) return { phase: "loading" };
  const rows = rankedFindings(findings);
  const stored = rows.filter((row) => row.status !== "no_reading");
  if (stored.length === 0) return { phase: "missing" };
  const needs = stored.filter((row) => row.status === "critical" || row.status === "at_risk").length;
  const unread = rows.length - stored.length;
  const partial: PartialFigure | null = unread
    ? {
        reason: "coverage",
        missing: `${formatInt(unread)} of ${formatInt(rows.length)} current findings have no stored reading, so they are left out of this count.`,
        coverage: `${formatInt(stored.length)} of ${formatInt(rows.length)} findings`,
        source: "Summary Briefing findings",
      }
    : null;
  return { phase: "ready", needs, stored: stored.length, total: rows.length, value: formatRatio(needs, stored.length), partial };
}
