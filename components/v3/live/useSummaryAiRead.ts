"use client";

import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useAiStale } from "@/components/v3/live/ai-search/AiStaleMark";
import { useMapAiSearch } from "@/components/v3/live/ai-search/useApiEngineLoad";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";

/**
 * The AI read Summary shows (Brian Magazu, 12 Nov 2026; replaces decision 7): the date-pill
 * window with its API runs, as the AI Search tabs and the map read it, so a Briefing or
 * Performance figure reads the same number everywhere. The reads are shared through the caches
 * in useApiEngineLoad and the history provider.
 */
export function useSummaryAiRead(): AiSearchRead {
  return useMapAiSearch(useAiHistory().current);
}

/**
 * X-25: the asterisk reading for a Summary AI rate, as the AI Search tabs mark theirs: stale when
 * the window ends on a published run past its check schedule, and mixed when the window spans a
 * question-set change. Null for the labeled sample copy and while the read is not ready.
 */
export function useSummaryAiStale(read: AiSearchRead): PartialFigure | null {
  const partial = useAiStale();
  return read.phase === "ready" ? partial : null;
}
