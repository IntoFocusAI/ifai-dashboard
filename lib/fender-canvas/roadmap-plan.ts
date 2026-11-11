/**
 * The plan Action Items and the Roadmap share (decision 21, FDD S-02, N-01, N-04).
 *
 * Order (21f): the five findings keep the fix-list order, then the ecommerce signals and the
 * brand's own pages when a page factor is below Good (21c), then the source, competitor, and
 * fact-check actions by the share of answers they affect, then the focus items (21d: weakest
 * engine, weakest questions, cited sites moving fastest), then rewording the brand's pages.
 * Phases (21g): Days 1 to 30 listing fixes, 31 to 60 catalog and site content, 61 to 90
 * outreach programs. The plan is rebuilt from each read and dated from today (rolling 90 days),
 * so an action leaves when its trigger clears (21h) and a new one enters when its trigger is met.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { EvidenceFocus } from "@/lib/ai-search/evidence-focus";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { rankFixList, type FixListRow } from "@/lib/fender-canvas/action-items-fix-list";
import type { BriefingFinding, BriefingFindingId } from "@/lib/fender-canvas/briefing-retail-lead";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import {
  SITE_TYPE_LABELS,
  type CitedPage,
  type SiteType,
  type SourceAction,
} from "@/lib/fender-canvas/roadmap-sources";
import type { FocusAction, PlanFocus } from "@/lib/fender-canvas/roadmap-focus";
import type { OwnPageAction } from "@/lib/fender-canvas/roadmap-own-pages";
import type { SignalAction } from "@/lib/fender-canvas/roadmap-signals";
import { findingAction, hasStoredReading } from "@/lib/fender-canvas/urgent-interventions-rows";

export type PlanPhase = "days_1_30" | "days_31_60" | "days_61_90";

export const PLAN_PHASES: ReadonlyArray<{ id: PlanPhase; label: string; focus: string }> = [
  { id: "days_1_30", label: "Days 1 to 30", focus: "Listing fixes" },
  { id: "days_31_60", label: "Days 31 to 60", focus: "Catalog and site content" },
  { id: "days_61_90", label: "Days 61 to 90", focus: "Outreach programs" },
];

/** Shown where an item has no dated phase: unbranded discovery moves with the fixes before it. */
export const ALL_PHASES_LABEL = "All phases";

const FINDING_PHASE: Record<BriefingFindingId, PlanPhase | null> = {
  buy_box: "days_1_30",
  map_leakage: "days_1_30",
  splintered_bundles: "days_1_30",
  exact_official_product: "days_31_60",
  unbranded_discovery: null,
};

const SOURCE_PHASE: Partial<Record<SiteType, PlanPhase>> = {
  retailer: "days_1_30",
  competitor_brand: "days_31_60",
  reference: "days_31_60",
  publication: "days_61_90",
  community: "days_61_90",
  video: "days_61_90",
};

const SIGNAL_PHASE: Record<string, PlanPhase> = {
  "signal:out_of_stock": "days_1_30",
  "signal:missing_specs": "days_31_60",
  "signal:fact_contradictions": "days_31_60",
};

/** 21d: the weakest engine and questions are site content; a moving site keeps its type's phase. */
const FOCUS_PHASE: Record<"engine" | "question", PlanPhase> = {
  engine: "days_31_60",
  question: "days_31_60",
};

export type PlanKind = "finding" | "signal" | "source" | "own_page" | "focus";

export type PlanItem = {
  id: string;
  kind: PlanKind;
  rank: number;
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
};

export const RECOMMENDED_LABEL = "Recommended";

function findingItem(row: FixListRow): PlanItem {
  const { finding } = row;
  return {
    id: `finding:${finding.id}`,
    kind: "finding",
    rank: row.rank,
    phase: FINDING_PHASE[finding.id],
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
  };
}

function signalItem(signal: SignalAction): PlanItem {
  const rival = signal.id.startsWith("signal:rival:");
  return {
    id: signal.id,
    kind: "signal",
    rank: 0,
    phase: rival ? "days_31_60" : (SIGNAL_PHASE[signal.id] ?? null),
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
  };
}

function sourceItem(source: SourceAction): PlanItem {
  return {
    id: `source:${source.domain}`,
    kind: "source",
    rank: 0,
    phase: SOURCE_PHASE[source.type] ?? null,
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
  };
}

function ownPageItem(own: OwnPageAction): PlanItem {
  return {
    id: own.id,
    kind: "own_page",
    rank: 0,
    phase: own.phase,
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
  };
}

function focusItem(focus: FocusAction): PlanItem {
  return {
    id: focus.id,
    kind: "focus",
    rank: 0,
    phase: focus.siteType ? (SOURCE_PHASE[focus.siteType] ?? null) : FOCUS_PHASE[focus.focus as "engine" | "question"],
    label: focus.label,
    percent: formatPct(focus.denominator > 0 ? (100 * focus.numerator) / focus.denominator : 0),
    ratio: formatRatio(focus.numerator, focus.denominator),
    tone: null,
    statusLabel: RECOMMENDED_LABEL,
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
  };
}

/** The five findings as the fix list ranks them, with their action lines. */
export function rankedFindings(findings: readonly BriefingFinding[]): FixListRow[] {
  return rankFixList(
    findings.map((finding) => ({ finding, action: findingAction(finding), stored: hasStoredReading(finding) })),
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

/** Every item in Action Items order, ranked 1 to N. */
export function buildPlan(input: PlanInput): PlanItem[] {
  const findings = rankedFindings(input.findings).map(findingItem);
  const ecommerce = input.signals.filter((signal) => signal.group === "ecommerce").map(signalItem);
  const own = input.ownPages ? ownPageItem(input.ownPages) : null;
  const { merged, rest } = mergeMovement(input.sources, input.focus ?? []);
  const shares = new Map<string, number>();
  const answers = [
    ...input.signals.filter((signal) => signal.group === "answers").map((signal) => {
      shares.set(signal.id, signal.share);
      return signalItem(signal);
    }),
    ...input.sources.map((source) => {
      shares.set(`source:${source.domain}`, source.share);
      const item = sourceItem(source);
      const trend = merged.get(item.id);
      return trend ? { ...item, fact: `${item.fact} ${trend}` } : item;
    }),
  ].sort((a, b) => (shares.get(b.id) ?? 0) - (shares.get(a.id) ?? 0) || a.label.localeCompare(b.label));
  const urgentOwn = own && input.ownPages?.urgent ? [own] : [];
  const laterOwn = own && !input.ownPages?.urgent ? [own] : [];
  return [...findings, ...ecommerce, ...urgentOwn, ...answers, ...rest.map(focusItem), ...laterOwn].map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/**
 * The plan for a client focus: brand-wide items stay, and an item tied to categories stays when
 * one of them is the focus. Ranks are renumbered. The brand focus returns the plan unchanged.
 */
export function focusPlan(plan: readonly PlanItem[], focus: PlanFocus): PlanItem[] {
  if (focus.kind === "brand") return [...plan];
  return plan
    .filter((item) => item.categories.length === 0 || item.categories.includes(focus.key))
    .map((item, index) => ({ ...item, rank: index + 1 }));
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
    return `No finding with a stored reading needs action. ${unread} of ${plan.filter((item) => item.kind === "finding").length} readings are not stored.`;
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
        missing: `${unread} of ${rows.length} current findings have no stored reading, so they are left out of this count.`,
        coverage: `${stored.length} of ${rows.length} findings`,
        source: "Summary Briefing findings",
      }
    : null;
  return { phase: "ready", needs, stored: stored.length, total: rows.length, value: `${needs} of ${stored.length}`, partial };
}
