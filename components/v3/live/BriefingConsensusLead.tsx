"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { briefingConsensusSentence } from "@/lib/fender-canvas/briefing-consensus-sentence";
import {
  scoreAgainst100Pie,
  scoreToneColor,
} from "@/lib/fender-canvas/consensus-score-display";
import { consensusFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

/**
 * One Summary Briefing bubble. Same live score as Performance, sized like the
 * other briefing bubbles. The result sentence is the title tooltip only.
 */
export function BriefingConsensusLead({
  bundle,
  retail,
}: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
}) {
  const findability = useFindability();
  const ai = useAiSearch();
  const loading =
    retail.phase === "loading" || findability.phase === "loading" || ai.phase === "loading";

  const consensus = loading
    ? null
    : consensusFromLive({
        findability,
        specPages: bundle.specPages,
        retail,
        ai,
      });
  const sentence = loading ? null : briefingConsensusSentence(consensus);
  const score = consensus?.score ?? null;
  const coverage = consensus?.coverage ?? null;
  const percent = loading ? "Loading" : score == null ? "Not available" : formatPct(score, 0);
  const pie = loading ? null : scoreAgainst100Pie("score-consensus", "AI Consensus", score);
  const tip =
    score != null && coverage
      ? `AI Consensus: ${formatPct(score)} · ${formatRatio(coverage.numerator, coverage.denominator)} of inputs in.`
      : undefined;

  return (
    <div
      className="retail-finding retail-overview-hero briefing-finding briefing-consensus"
      data-briefing-consensus=""
    >
      {sentence ? (
        <span
          className="metric-card-label ifai-term"
          data-briefing-consensus-title=""
          data-ifai-tooltip-title="AI Consensus"
          data-ifai-tooltip-desc={sentence}
          tabIndex={0}
          aria-label={`AI Consensus: ${sentence}`}
        >
          AI Consensus
        </span>
      ) : (
        <span className="metric-card-label" data-briefing-consensus-title="">
          AI Consensus
        </span>
      )}
      <div className="retail-overview-hero-row">
        <span className="retail-overview-hero-figures">
          <span
            className="ai-lead-figure"
            data-briefing-consensus-score=""
            style={{ color: loading ? "var(--text-muted)" : scoreToneColor(score) }}
          >
            {percent}
          </span>
          {coverage ? (
            <span className="retail-overview-hero-ratio" data-briefing-consensus-coverage="">
              {formatRatio(coverage.numerator, coverage.denominator)}
            </span>
          ) : null}
        </span>
        {pie ? <CitationPieDisc pie={pie} sizeClass={PIE_SIZE} tip={tip} /> : null}
      </div>
    </div>
  );
}
