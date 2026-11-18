"use client";

import { BriefingConsensusLead } from "@/components/v3/live/BriefingConsensusLead";
import { BriefingFindingCard } from "@/components/v3/live/BriefingFindingCard";
import { DeckLauncher } from "@/components/v3/live/deck/DeckLauncher";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useSummaryAiRead, useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import { EstimateFigure } from "@/components/v3/live/estimates/OpportunityEstimates";
import { estimateMonthlyPotential } from "@/lib/estimates/monthly";
import type { ClientEstimatesRead } from "@/lib/estimates/live-inputs";
import {
  BRIEFING_LOST_REVENUE_LABEL,
  briefingFindingsLead,
  orderBriefingFindings,
} from "@/lib/fender-canvas/briefing-retail-lead";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

/** Phase 1 divided by 12 from the shared estimate read, with the same trail as Phase 1. */
function MonthlyLostRevenue({ read }: { read: ClientEstimatesRead | undefined }) {
  const monthly = read?.phase === "ready" ? estimateMonthlyPotential(read.estimates.phase1) : null;
  return (
    <div className="briefing-revenue-placeholder" data-briefing-revenue-placeholder="">
      <span className="metric-card-label" data-briefing-revenue-label="">
        {BRIEFING_LOST_REVENUE_LABEL}
      </span>
      <span className="ai-lead-figure" data-briefing-revenue-figure="">
        <EstimateFigure read={read} result={monthly} hero />
      </span>
    </div>
  );
}

/**
 * Summary Briefing hero row: AI Consensus, the monthly lost-revenue card, then the five findings
 * by result, worst first (Poor, Fair, Good, Not available*). The monthly card is not a sixth finding.
 */
export function BriefingRetailHero({
  bundle,
  read,
}: {
  bundle: CanvasBundle;
  read: RetailCanvasRead;
}) {
  const findability = useFindability();
  // The date-pill window every AI figure reads: the Briefing, the tabs, and the map read one number.
  const ai = useSummaryAiRead();
  const aiStale = useSummaryAiStale(ai);
  const { findings } = briefingFindingsLead(read, findability, ai, { aiStale });
  const ordered = orderBriefingFindings(findings);

  return (
    <>
    <DeckLauncher bundle={bundle} retail={read} />
    <div className="briefing-findings" data-briefing-retail-hero="" data-briefing-findings="">
      <BriefingConsensusLead bundle={bundle} retail={read} ai={ai} />
      <MonthlyLostRevenue read={bundle.estimates} />
      {ordered.map((finding) => (
        <BriefingFindingCard key={finding.id} finding={finding} />
      ))}
    </div>
    </>
  );
}
