"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import type { BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";

const BRIEFING_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

/** One Summary Briefing / Current findings share: percent, N of M, optional pie. */
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
              style={{ color: finding.color }}
            >
              {finding.percent}
            </span>
            {finding.ratio ? (
              <span className="retail-overview-hero-ratio" data-briefing-finding-ratio="">
                {finding.ratio}
              </span>
            ) : null}
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
