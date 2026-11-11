"use client";

import { useMemo } from "react";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { utcDay } from "@/lib/ai-search/history-eligibility";
import { aiSearchStale, selectionEndsOnPublishedRun } from "@/lib/ai-search/stale";
import { PARTIAL_MARK, PARTIAL_TITLE, partialFigureTip, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";

/**
 * The stale reading for the figures on screen (X-25): the published run is older than its check
 * schedule allows, and the selection ends on it. Null for the labeled sample copy.
 */
export function useAiStale(): PartialFigure | null {
  const history = useAiHistoryOptional();
  const current = history?.current ?? null;
  const run = current?.phase === "ready" ? current.snapshot.run : null;
  const mode = history?.mode ?? null;
  const source = history?.source ?? null;
  return useMemo(() => {
    if (!run || !mode || source !== "live") return null;
    const day = utcDay(run.published_at ?? run.completed_at);
    if (!selectionEndsOnPublishedRun(mode, run.audit_run_id, day)) return null;
    return aiSearchStale(run);
  }, [mode, run, source]);
}

/** The asterisk beside a lead figure whose published run is past its check schedule. */
export function AiStaleMark() {
  const stale = useAiStale();
  if (!stale) return null;
  return (
    <span
      {...figureTipAttrs(PARTIAL_TITLE.stale, partialFigureTip(stale), "ai-stale")}
      className="ifai-term partial-figure-mark"
      data-ai-stale=""
    >
      {PARTIAL_MARK}
    </span>
  );
}
