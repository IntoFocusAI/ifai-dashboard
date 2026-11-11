"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { catalogLoadState, useApiRunCatalog, useApiSnapshots } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useStockLossRead } from "@/components/v3/live/useMinimalMetricReads";
import { useSummaryAiRead, useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import { readPublishedRun, useFocusWindows } from "@/components/v3/live/useFocusWindows";
import { engineGroupRead } from "@/lib/ai-search/engine-group-read";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { staffFocus, type PlanFocus } from "@/lib/fender-canvas/roadmap-focus";
import {
  assembleRoadmapPlan,
  pairedApiRuns,
  priorRunIds,
  sourceRunsRead,
  type RoadmapPlanRead,
  type SourceRunsRead,
} from "@/lib/fender-canvas/roadmap-plan-read";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

export type { RoadmapPlanRead, SourceRunsRead };

const LOADING: AiSearchRead = { phase: "loading" };

/** One earlier published run as the map reads a run: with its matching API run (decision 7). */
function useMapPopulation(published: AiSearchRead): AiSearchRead {
  const catalog = useApiRunCatalog();
  const snapshot = published.phase === "ready" ? published.snapshot : null;
  const paired = useMemo(
    () => (catalog.phase === "ready" ? pairedApiRuns(catalog.runs, snapshot) : []),
    [catalog, snapshot],
  );
  const load = useApiSnapshots(paired);
  const pending = useMemo(() => catalogLoadState(catalog), [catalog]);
  return useMemo(() => engineGroupRead(published, pending ?? load, "all"), [published, pending, load]);
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

  return useMemo(
    () =>
      sourceRunsRead({
        current,
        ids,
        live: history.source === "live",
        catalogFailed: history.source === "live" && history.catalog.phase === "error",
        prior: (ids ?? []).map((_, index) => (index === 0 ? first : second)),
      }),
    [current, first, second, history.catalog.phase, history.source, ids],
  );
}

/**
 * The plan Action Items and the Roadmap show, on the map's AI population (decision 7). It is
 * rebuilt on every read, so actions whose trigger clears drop off and new ones enter. The focus
 * IntoFocus staff set per client (staffFocus) narrows the plan to one category; the default is
 * the whole brand. The server download builds the same plan with assembleRoadmapPlan.
 */
export function useRoadmapPlan(retail: RetailCanvasRead, bundle: CanvasBundle | null, focus: PlanFocus = staffFocus()): RoadmapPlanRead {
  const ai = useSummaryAiRead();
  const aiStale = useSummaryAiStale(ai);
  const findability = useFindability();
  const stock = useStockLossRead();
  const sources = useSourceRuns(ai);
  const windows = useFocusWindows();

  return useMemo(
    () => assembleRoadmapPlan({ retail, bundle, findability, ai, aiStale, stock, sources, windows, focus }),
    [ai, aiStale, bundle, findability, focus, retail, sources, stock, windows],
  );
}
