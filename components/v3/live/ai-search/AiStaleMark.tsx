"use client";

import { useMemo } from "react";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { utcDay } from "@/lib/ai-search/history-eligibility";
import { windowQuestionSetChange } from "@/lib/ai-search/history-trends";
import { aiSearchStale, aiWindowPartial, questionSetMixed, selectionEndsOnPublishedRun } from "@/lib/ai-search/stale";
import { PARTIAL_MARK, PARTIAL_TITLE, partialFigureTip, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";

/**
 * The asterisk reading for the AI rates on screen (X-25): stale when the published run is older
 * than its check schedule allows and the selection ends on it; mixed when the date-pill window
 * holds runs from before and after a question-set change. Null for the labeled sample copy.
 */
export function useAiStale(): PartialFigure | null {
  const history = useAiHistoryOptional();
  const current = history?.current ?? null;
  const run = current?.phase === "ready" ? current.snapshot.run : null;
  const mode = history?.mode ?? null;
  const source = history?.source ?? null;
  const trend = history?.trend ?? null;
  const windowed = mode != null && mode.kind !== "run" && mode.kind !== "legacy";
  const changedOn = useMemo(
    () => (windowed && trend?.phase === "ready" ? windowQuestionSetChange(trend.snapshots) : null),
    [trend, windowed],
  );
  return useMemo(() => {
    if (!run || !mode || source !== "live") return null;
    const day = utcDay(run.published_at ?? run.completed_at);
    const stale = selectionEndsOnPublishedRun(mode, run.audit_run_id, day) ? aiSearchStale(run) : null;
    return aiWindowPartial(stale, questionSetMixed(changedOn));
  }, [changedOn, mode, run, source]);
}

/** The asterisk beside a lead figure that is stale or mixes question sets. */
export function AiStaleMark() {
  const stale = useAiStale();
  if (!stale) return null;
  return (
    <span
      {...figureTipAttrs(PARTIAL_TITLE[stale.reason], partialFigureTip(stale), "ai-stale")}
      className="ifai-term partial-figure-mark"
      data-ai-stale=""
    >
      {PARTIAL_MARK}
    </span>
  );
}
