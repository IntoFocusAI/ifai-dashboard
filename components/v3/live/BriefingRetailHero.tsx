"use client";

import { BriefingConsensusLead } from "@/components/v3/live/BriefingConsensusLead";
import { BriefingFindingCard } from "@/components/v3/live/BriefingFindingCard";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useSummaryAiRead, useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import {
  briefingFindingsLead,
  type BriefingLostRevenuePlaceholder,
} from "@/lib/fender-canvas/briefing-retail-lead";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

function LostRevenuePlaceholder({ placeholder }: { placeholder: BriefingLostRevenuePlaceholder }) {
  return (
    <div className="briefing-revenue-placeholder" data-briefing-revenue-placeholder="">
      <span
        className="metric-card-label ifai-term"
        data-briefing-revenue-label=""
        data-ifai-tooltip-title={placeholder.label}
        data-ifai-tooltip-desc={placeholder.explainer}
        tabIndex={0}
        aria-label={`${placeholder.label}: ${placeholder.explainer}`}
      >
        {placeholder.label}
      </span>
      <span className="ai-lead-figure" data-briefing-revenue-figure="">
        {placeholder.figure}
      </span>
    </div>
  );
}

/**
 * Summary Briefing hero row: AI Consensus, five findings, and the lost-revenue placeholder.
 * Buy Box stays beside that placeholder. The placeholder is not a sixth finding.
 */
export function BriefingRetailHero({
  bundle,
  read,
}: {
  bundle: CanvasBundle;
  read: RetailCanvasRead;
}) {
  const findability = useFindability();
  // The map's population (decision 7): the Briefing and the map read one number.
  const ai = useSummaryAiRead();
  const aiStale = useSummaryAiStale(ai);
  const { findings, lostRevenue } = briefingFindingsLead(read, findability, ai, { aiStale });
  const [buyBox, ...rest] = findings;

  return (
    <div className="briefing-findings" data-briefing-retail-hero="" data-briefing-findings="">
      <BriefingConsensusLead bundle={bundle} retail={read} ai={ai} />
      <BriefingFindingCard finding={buyBox} />
      <LostRevenuePlaceholder placeholder={lostRevenue} />
      {rest.map((finding) => (
        <BriefingFindingCard key={finding.id} finding={finding} />
      ))}
    </div>
  );
}
