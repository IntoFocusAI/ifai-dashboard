"use client";

import { useAiHistoryOptional } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useEngineGroupRead } from "@/components/v3/live/ai-search/EngineGroupScope";
import { competitorsSpokeLead } from "@/lib/ai-search/canvas-surfaces";
import { selectionLine } from "@/lib/ai-search/displayed-read";

/**
 * Competitive Radar's opening sentence.
 * The spec string is built from the published run. This reads the snapshot the tables use,
 * narrowed by the engine switch.
 * The N-of-M clause is the figure. The rest of the sentence sits under it.
 */
export function CompetitorsSpokeDescription() {
  const { read } = useEngineGroupRead();
  const single = useAiHistoryOptional()?.mode.kind === "run";
  if (read.phase === "error" && read.selection) {
    return <span data-ai-competitor-desc="">{selectionLine(read.selection, single)}.</span>;
  }
  const { figure, explainer } = competitorsSpokeLead(read);
  return (
    <span data-ai-competitor-desc="">
      {explainer ? <span className="ai-lead-figure">{figure}</span> : figure}
      {explainer ? <span className="ai-lead-explainer">{explainer}</span> : null}
    </span>
  );
}
