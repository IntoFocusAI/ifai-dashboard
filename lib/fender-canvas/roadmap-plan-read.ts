/**
 * The Action Items and Roadmap plan, assembled from its seven reads. The browser hooks
 * (RoadmapPlanData, useFocusWindows) and the server download (lib/export/action-items-export)
 * both build the plan with these functions, so the CSV holds the rows the screen shows.
 * Browser-safe and server-safe: no reads happen here.
 */
import { apiRunsCoveringBattery, apiRunsInScope, batteryQuestions, type ApiRunSummary } from "@/lib/ai-search/api-runs";
import type { ApiEngineLoad } from "@/lib/ai-search/engine-group-read";
import { compareRuns, isTrustworthyRun, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import { briefingFindingsLead, BRIEFING_LOADING, type BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";
import { markPartial, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import type { StockLossRead } from "@/lib/fender-canvas/minimal-metric-kit";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { phaseWindow } from "@/lib/fender-canvas/roadmap-dates";
import { withLatestRunTips } from "@/lib/fender-canvas/roadmap-latest";
import { focusActions, type FocusWindows, type HeldItem, type PlanFocus } from "@/lib/fender-canvas/roadmap-focus";
import { ownPagesAction } from "@/lib/fender-canvas/roadmap-own-pages";
import { buildPlan, focusPlan, phaseLabel, type PlanItem } from "@/lib/fender-canvas/roadmap-plan";
import { signalActions } from "@/lib/fender-canvas/roadmap-signals";
import { SOURCE_RUNS_WINDOW, sourceActions } from "@/lib/fender-canvas/roadmap-sources";
import { poolFocusWindow, previousWindowEnd, windowSummary, type WindowSummary } from "@/lib/fender-canvas/roadmap-window";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import type { FindabilityRead } from "@/lib/findability/copy";

export { pairedApiRuns } from "@/lib/ai-search/api-runs";

const MONTH = { kind: "month" } as const;

/** The published runs before the given run (the newest in the window), latest first, at most two. */
export function priorRunIds(runs: readonly HistoryRunSummary[], currentId: string): string[] {
  const trusted = runs.filter(isTrustworthyRun).sort(compareRuns);
  const index = trusted.findIndex((run) => run.audit_run_id === currentId);
  const before = index >= 0 ? trusted.slice(0, index) : trusted.filter((run) => run.audit_run_id !== currentId);
  return before.slice(-(SOURCE_RUNS_WINDOW - 1)).reverse().map((run) => run.audit_run_id);
}

export type SourceRunsRead =
  | { phase: "loading" }
  | { phase: "ready"; snapshots: AiSearchSnapshot[]; failed: number };

/** The last published runs, latest first: the newest run in the window, then the earlier runs that read. */
export function sourceRunsRead(input: {
  current: AiSearchRead;
  ids: readonly string[] | null;
  live: boolean;
  catalogFailed: boolean;
  /** One read per id, in the same order. */
  prior: readonly AiSearchRead[];
}): SourceRunsRead {
  const { current, ids, live, catalogFailed, prior } = input;
  if (current.phase !== "ready") return { phase: "loading" };
  if (!ids && !catalogFailed && live) return { phase: "loading" };
  if (prior.some((read) => read.phase === "loading")) return { phase: "loading" };
  const ready = prior.flatMap((read) => (read.phase === "ready" ? [read.snapshot] : []));
  return {
    phase: "ready",
    snapshots: [current.snapshot, ...ready],
    failed: prior.length - ready.length + (catalogFailed ? 1 : 0),
  };
}

export type FocusWindowsRead =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; windows: FocusWindows; summary: { current: WindowSummary; previous: WindowSummary } };

/** The API runs of each 30-day window that asked the fixed questions of the windows' battery runs. */
export function focusWindowApiRuns(
  catalogRuns: readonly ApiRunSummary[],
  split: { current: readonly AiSearchSnapshot[]; previous: readonly AiSearchSnapshot[] },
  end: string | null,
): { current: ApiRunSummary[]; previous: ApiRunSummary[] } {
  const eligible = apiRunsCoveringBattery(catalogRuns, batteryQuestions([...split.current, ...split.previous]));
  return {
    current: apiRunsInScope(eligible, MONTH, end),
    previous: apiRunsInScope(eligible, MONTH, previousWindowEnd(end)),
  };
}

/** Both 30-day windows pooled with their API runs, once the battery and API runs have read. */
export function focusWindowsReady(
  split: { current: readonly AiSearchSnapshot[]; previous: readonly AiSearchSnapshot[] },
  pending: ApiEngineLoad | null,
  currentApi: ApiEngineLoad,
  previousApi: ApiEngineLoad,
): FocusWindowsRead {
  const apiOf = (load: ApiEngineLoad): AiSearchSnapshot[] | null => {
    if (pending?.phase === "missing" || load.phase === "missing") return [];
    if (pending?.phase === "loading" || load.phase === "loading") return null;
    if (pending?.phase === "error") return [];
    return load.phase === "ready" ? load.snapshots : [];
  };
  const current = apiOf(currentApi);
  const previous = apiOf(previousApi);
  if (!current || !previous) return { phase: "loading" };
  const windows = { current: poolFocusWindow(split.current, current), previous: poolFocusWindow(split.previous, previous) };
  return {
    phase: "ready",
    windows,
    summary: {
      current: windowSummary(windows.current, split.current, current),
      previous: windowSummary(windows.previous, split.previous, previous),
    },
  };
}

export type RoadmapPlanRead = {
  plan: PlanItem[];
  findings: BriefingFinding[];
  /** Source actions wait on the earlier runs, and focus items on the two 30-day windows; the rest of the plan does not. */
  sources: SourceRunsRead;
  ai: AiSearchRead;
  /** 21d items a guardrail held back, and why no own-page action shows (21c). */
  held: HeldItem[];
  /** 21d: answers behind each engine and question in the two 30-day windows, per run. */
  window: { current: WindowSummary; previous: WindowSummary } | null;
  ownPagesReason: string;
};

export type RoadmapPlanInput = {
  retail: RetailCanvasRead;
  bundle: CanvasBundle | null;
  findability: FindabilityRead;
  /** The date-pill window with its API runs, narrowed by the engine switch, as every AI figure reads. */
  ai: AiSearchRead;
  aiStale: PartialFigure | null;
  stock: StockLossRead;
  /** The last published runs, from the newest run in the window back, each with its API run. */
  sources: SourceRunsRead;
  windows: FocusWindowsRead;
  focus: PlanFocus;
};

/**
 * The plan on the date-pill window every AI figure reads (Brian Magazu, 12 Nov 2026). It is
 * rebuilt on every read, so actions whose trigger clears drop off and new ones enter. Each AI row
 * names the newest run's count in its tooltip. The staff focus narrows it to one category.
 */
export function assembleRoadmapPlan(input: RoadmapPlanInput): RoadmapPlanRead {
  const { retail, bundle, findability, ai, aiStale, stock, sources, windows, focus } = input;
  const { findings } = briefingFindingsLead(retail, findability, ai, { aiStale });
  const current = ai.phase === "ready" ? ai.snapshot : null;
  const own = ownPagesAction(bundle, current);
  const focused = focusActions({ windows: windows.phase === "ready" ? windows.windows : null, focus });
  const held: HeldItem[] =
    windows.phase === "error"
      ? [{ id: "focus:window", label: "The last 30 days", guardrail: "data", detail: windows.message }, ...focused.held]
      : focused.held;
  const signals = signalActions({ retail, ai, stock });
  const built = buildPlan({
    findings,
    signals,
    sources: sources.phase === "ready" ? sourceActions(sources.snapshots, current) : [],
    ownPages: own.action,
    focus: focused.actions,
  });
  const plan = withLatestRunTips(built, sources.phase === "ready" ? (sources.snapshots[0] ?? null) : null, signals);
  const window = windows.phase === "ready" ? windows.summary : null;
  const waiting: SourceRunsRead = windows.phase === "loading" ? { phase: "loading" } : sources;
  return { plan: focusPlan(plan, focus), findings, sources: waiting, ai, held, window, ownPagesReason: own.reason };
}

/** The fix list's columns, as the Action Items table heads them. */
export const FIX_LIST_HEADER = ["#", "What to fix", "Finding", "Status", "Phase", "Evidence", "Cited pages"] as const;

function joined(...parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");
}

/** One fix-list row as the screen reads it; stacked lines are joined with " · ". */
export function fixListCells(item: PlanItem, today: Date): string[] {
  const figure = markPartial(item.loading ? BRIEFING_LOADING : item.percent, item.partial);
  return [
    String(item.rank),
    joined(item.kind === "finding" ? null : item.fact, item.action),
    joined(item.label, item.siteType, item.ratio ? `${figure} ${item.ratio}` : figure),
    item.statusLabel,
    joined(phaseLabel(item.phase), item.phase ? phaseWindow(item.phase, today).label : null),
    `${item.open.tab} tab`,
    item.pages.map((page) => `${page.url} (${page.answers} ${page.answers === 1 ? "answer" : "answers"})`).join("; "),
  ];
}
