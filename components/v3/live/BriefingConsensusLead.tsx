"use client";

import "@/components/v3/live/summary.css";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { StatusMark } from "@/components/v3/live/StatusMark";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { authorizedPartnersFromSave } from "@/lib/fender-canvas/authorized-sellers";
import { useAuthorizedSellers } from "@/lib/fender-canvas/authorized-sellers-store";
import { briefingConsensusSentence } from "@/lib/fender-canvas/briefing-consensus-sentence";
import {
  consensusPartial,
  scoreAgainst100Pie,
  scoreAgainstTarget,
  scoreFigure,
  scoreStatus,
  scoreTargetLabel,
  scoreToneColor,
} from "@/lib/fender-canvas/consensus-score-display";
import { consensusFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import { formatRatio } from "@/lib/fender-canvas/format";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

/**
 * One Summary Briefing bubble. Same live score as Performance (the map's AI read and the saved
 * authorized partners), sized like the other briefing bubbles, read against target 70 (H-07).
 * The result sentence is the title tooltip only.
 */
export function BriefingConsensusLead({
  bundle,
  retail,
  ai,
}: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
  /** The map's AI read (decision 7), from useSummaryAiRead. */
  ai: AiSearchRead;
}) {
  const findability = useFindability();
  const [saved] = useAuthorizedSellers();
  const authorizedPartners = authorizedPartnersFromSave(saved);
  const loading =
    retail.phase === "loading" || findability.phase === "loading" || ai.phase === "loading";

  const consensus = loading
    ? null
    : consensusFromLive({
        findability,
        specPages: bundle.specPages,
        retail,
        ai,
        authorizedPartners,
      });
  const sentence = loading ? null : briefingConsensusSentence(consensus);
  const score = consensus?.score ?? null;
  const coverage = consensus?.coverage ?? null;
  const status = loading ? null : scoreStatus(score);
  const figure = loading ? "Loading" : scoreFigure(score);
  const pie = loading ? null : scoreAgainst100Pie("score-consensus", "AI Consensus", score);
  const target = scoreAgainstTarget(score);
  const tip =
    target && coverage
      ? `AI Consensus: ${target} · ${formatRatio(coverage.numerator, coverage.denominator)} pillars in.`
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
            style={{ color: status ? scoreToneColor(score) : "var(--text-muted)" }}
          >
            <PartialFigureMark partial={consensus ? consensusPartial(consensus) : null} testId="briefing-consensus">
              {figure}
            </PartialFigureMark>
          </span>
          {target ? (
            <span className="retail-overview-hero-ratio" data-briefing-consensus-target="">
              {scoreTargetLabel()}
            </span>
          ) : null}
          {coverage && score != null ? (
            <span className="retail-overview-hero-ratio" data-briefing-consensus-coverage="">
              {formatRatio(coverage.numerator, coverage.denominator)} pillars
            </span>
          ) : null}
          {status ? <StatusMark status={status} /> : null}
        </span>
        {pie ? <CitationPieDisc pie={pie} sizeClass={PIE_SIZE} tip={tip} /> : null}
      </div>
    </div>
  );
}
