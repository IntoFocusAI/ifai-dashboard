"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { catalogLoadState, useApiRunCatalog, useApiSnapshots } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useStockLossRead } from "@/components/v3/live/useMinimalMetricReads";
import { useSummaryAiRead, useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import { readPublishedRun, useFocusWindows } from "@/components/v3/live/useFocusWindows";
import { apiRunsCoveringBattery, batteryQuestions, nearestApiRun } from "@/lib/ai-search/api-runs";
import { engineGroupRead } from "@/lib/ai-search/engine-group-read";
import { compareRuns, isTrustworthyRun, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import { briefingFindingsLead, type BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { buildPlan, focusPlan, type PlanItem } from "@/lib/fender-canvas/roadmap-plan";
import { focusActions, staffFocus, type HeldItem, type PlanFocus } from "@/lib/fender-canvas/roadmap-focus";
import { ownPagesAction } from "@/lib/fender-canvas/roadmap-own-pages";
import { signalActions } from "@/lib/fender-canvas/roadmap-signals";
import { SOURCE_RUNS_WINDOW, sourceActions } from "@/lib/fender-canvas/roadmap-sources";
import type { WindowSummary } from "@/lib/fender-canvas/roadmap-window";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const LOADING: AiSearchRead = { phase: "loading" };

/** One earlier published run as the map reads a run: with its matching API run (decision 7). */
function useMapPopulation(published: AiSearchRead): AiSearchRead {
  const catalog = useApiRunCatalog();
  const snapshot = published.phase === "ready" ? published.snapshot : null;
  const paired = useMemo(() => {
    if (catalog.phase !== "ready" || !snapshot) return [];
    const battery = batteryQuestions([snapshot]);
    const run = nearestApiRun(apiRunsCoveringBattery(catalog.runs, battery), battery[0]?.day ?? null);
    return run ? [run] : [];
  }, [catalog, snapshot]);
  const load = useApiSnapshots(paired);
  const pending = useMemo(() => catalogLoadState(catalog), [catalog]);
  return useMemo(() => engineGroupRead(published, pending ?? load, "all"), [published, pending, load]);
}

/** The published runs before the map's run, latest first, at most two. */
function priorRunIds(runs: readonly HistoryRunSummary[], currentId: string): string[] {
  const trusted = runs.filter(isTrustworthyRun).sort(compareRuns);
  const index = trusted.findIndex((run) => run.audit_run_id === currentId);
  const before = index >= 0 ? trusted.slice(0, index) : trusted.filter((run) => run.audit_run_id !== currentId);
  return before.slice(-(SOURCE_RUNS_WINDOW - 1)).reverse().map((run) => run.audit_run_id);
}

function usePriorRun(runId: string | null): AiSearchRead {
  const [state, setState] = useState<{ id: string | null; read: AiSearchRead }>({ id: null, read: LOADING });
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    void readPublishedRun(runId).then((result) => {
      if (cancelled) return;
      setState({
        id: runId,
        read: result.phase === "ready" ? { phase: "ready", snapshot: result.snapshot } : { phase: "error", message: result.message },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [runId]);
  return runId && state.id === runId ? state.read : LOADING;
}

export type SourceRunsRead =
  | { phase: "loading" }
  | { phase: "ready"; snapshots: AiSearchSnapshot[]; failed: number };

/** The last published runs, latest first, each read as the map reads a run. */
function useSourceRuns(current: AiSearchRead): SourceRunsRead {
  const history = useAiHistory();
  const currentId = current.phase === "ready" ? current.snapshot.run.audit_run_id : null;
  const ids = useMemo(() => {
    if (!currentId || history.source !== "live" || history.catalog.phase !== "ready") return null;
    return priorRunIds(history.catalog.runs, currentId);
  }, [currentId, history.catalog, history.source]);
  const first = useMapPopulation(usePriorRun(ids?.[0] ?? null));
  const second = useMapPopulation(usePriorRun(ids?.[1] ?? null));

  return useMemo(() => {
    if (current.phase !== "ready") return { phase: "loading" };
    const catalogFailed = history.source === "live" && history.catalog.phase === "error";
    if (!ids && !catalogFailed && history.source === "live") return { phase: "loading" };
    const prior = (ids ?? []).map((_, index) => (index === 0 ? first : second));
    if (prior.some((read) => read.phase === "loading")) return { phase: "loading" };
    const ready = prior.flatMap((read) => (read.phase === "ready" ? [read.snapshot] : []));
    return {
      phase: "ready",
      snapshots: [current.snapshot, ...ready],
      failed: prior.length - ready.length + (catalogFailed ? 1 : 0),
    };
  }, [current, first, second, history.catalog.phase, history.source, ids]);
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

/**
 * The plan Action Items and the Roadmap show, on the map's AI population (decision 7). It is
 * rebuilt on every read, so actions whose trigger clears drop off and new ones enter. The focus
 * IntoFocus staff set per client (staffFocus) narrows the plan to one category; the default is
 * the whole brand.
 */
export function useRoadmapPlan(retail: RetailCanvasRead, bundle: CanvasBundle | null, focus: PlanFocus = staffFocus()): RoadmapPlanRead {
  const ai = useSummaryAiRead();
  const aiStale = useSummaryAiStale(ai);
  const findability = useFindability();
  const stock = useStockLossRead();
  const sources = useSourceRuns(ai);
  const windows = useFocusWindows();

  return useMemo(() => {
    const { findings } = briefingFindingsLead(retail, findability, ai, { aiStale });
    const current = ai.phase === "ready" ? ai.snapshot : null;
    const own = ownPagesAction(bundle, current);
    const focused = focusActions({ windows: windows.phase === "ready" ? windows.windows : null, focus });
    const held: HeldItem[] =
      windows.phase === "error"
        ? [{ id: "focus:window", label: "The last 30 days", guardrail: "data", detail: windows.message }, ...focused.held]
        : focused.held;
    const plan = buildPlan({
      findings,
      signals: signalActions({ retail, ai, stock }),
      sources: sources.phase === "ready" ? sourceActions(sources.snapshots) : [],
      ownPages: own.action,
      focus: focused.actions,
    });
    const window = windows.phase === "ready" ? windows.summary : null;
    const waiting: SourceRunsRead = windows.phase === "loading" ? { phase: "loading" } : sources;
    return { plan: focusPlan(plan, focus), findings, sources: waiting, ai, held, window, ownPagesReason: own.reason };
  }, [ai, aiStale, bundle, findability, focus, retail, sources, stock, windows]);
}
