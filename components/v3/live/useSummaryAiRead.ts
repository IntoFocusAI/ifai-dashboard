"use client";

import { useMemo } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useMapAiSearch } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { aiSearchStale } from "@/lib/ai-search/stale";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";

/**
 * The AI read Summary shows (decision 7, FDD X-09): the map's population, the published run
 * with its matching API run, so a Briefing or Performance figure reads the same number as the
 * map. The AI Search tabs' context follows the date pill instead, so Summary does not read it.
 * The API runs are read once and shared with the map through the caches in useApiEngineLoad.
 */
export function useSummaryAiRead(): AiSearchRead {
  return useMapAiSearch(useAiHistory().current);
}

/**
 * X-25: the stale reading for a Summary AI figure. The map's run is the published run, so it is
 * stale once that run is past its check schedule. The labeled sample copy is never marked.
 */
export function useSummaryAiStale(read: AiSearchRead): PartialFigure | null {
  const source = useAiHistory().source;
  const run = read.phase === "ready" ? read.snapshot.run : null;
  return useMemo(() => (run && source === "live" ? aiSearchStale(run) : null), [run, source]);
}
