"use client";

import "@/components/v3/live/summary.css";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import { BRIEFING_LOADING, type BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";
import { heroFigureColor, heroFigureTone } from "@/lib/fender-canvas/retail-overview-lead";

const BRIEFING_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

/**
 * One Summary Briefing / Current findings share: percent, N of M, the status mark and word,
 * and the share disc. A partial or stale figure carries the asterisk and its tooltip (X-25).
 */
export function BriefingFindingCard({ finding }: { finding: BriefingFinding }) {
  return (
    <div
      className="retail-finding retail-overview-hero briefing-finding"
      data-briefing-finding={finding.id}
    >
      <span
        className="metric-card-label ifai-term"
        data-briefing-finding-label=""
        data-ifai-tooltip-title={finding.label}
        data-ifai-tooltip-desc={finding.explainer}
        tabIndex={0}
        aria-label={`${finding.label}: ${finding.explainer}`}
      >
        {finding.label}
      </span>
      <button
        type="button"
        className="retail-finding-hit"
        data-ifai-open={finding.spokeId}
        data-ifai-tab={finding.tab}
        aria-label={finding.label}
      >
        <span className="retail-overview-hero-row" data-briefing-finding-row="">
          <span className="retail-overview-hero-figures">
            <span
              className="ai-lead-figure"
              data-briefing-finding-percent=""
              data-briefing-finding-tone={finding.tone}
              data-briefing-finding-numerator={finding.numerator ?? ""}
              data-briefing-finding-denominator={finding.denominator ?? ""}
              data-briefing-finding-loading={finding.loading ? "" : undefined}
              style={{ color: heroFigureColor(finding) }}
            >
              <PartialFigureMark partial={finding.partial} testId={`briefing-${finding.id}`}>
                {finding.loading ? BRIEFING_LOADING : finding.percent}
              </PartialFigureMark>
            </span>
            {finding.ratio ? (
              <span className="retail-overview-hero-ratio" data-briefing-finding-ratio="">
                {finding.ratio}
              </span>
            ) : null}
            <RetailStatusMark tone={heroFigureTone(finding)} />
          </span>
          {finding.pie ? (
            <CitationPieDisc
              pie={finding.pie}
              sizeClass={BRIEFING_PIE_SIZE}
              tip={finding.tip ?? undefined}
            />
          ) : null}
        </span>
      </button>
    </div>
  );
}
