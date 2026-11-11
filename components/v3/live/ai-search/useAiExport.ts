"use client";

import { useMemo } from "react";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useEngineGroupChoice } from "@/components/v3/live/ai-search/engine-group-store";
import { useApiEngineLoad } from "@/components/v3/live/ai-search/useApiEngineLoad";
import { engineSwitchState } from "@/lib/ai-search/engine-group-read";
import type { AiSelectionScope } from "@/lib/ai-search/selection";

/**
 * What an AI Search table sends with Download CSV: the date pill's selection and the engine
 * switch, plus the tab's own controls. The server reads the same runs with it (X-10).
 * Null hides the download: the labeled sample copy and a legacy run have no server read.
 */
export function useAiExportScope(extra?: Record<string, unknown>): Record<string, unknown> | null {
  const history = useAiHistoryOptional();
  const [engines] = useEngineGroupChoice();
  const enginesReady = engineSwitchState(useApiEngineLoad(), engines).kind === "ready";
  const mode = history?.mode ?? null;
  const source = history?.source ?? null;
  const windowEnd = history?.windowEnd ?? null;
  const extraKey = extra ? JSON.stringify(extra) : "";
  return useMemo(() => {
    if (!mode || source !== "live" || mode.kind === "legacy") return null;
    const ai: AiSelectionScope = { mode, windowEnd, engines, enginesReady };
    return { ai, ...(extraKey ? (JSON.parse(extraKey) as Record<string, unknown>) : {}) };
  }, [engines, enginesReady, extraKey, mode, source, windowEnd]);
}
