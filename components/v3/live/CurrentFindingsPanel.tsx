"use client";

import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { BriefingFindingCard } from "@/components/v3/live/BriefingFindingCard";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { briefingFindingsLead } from "@/lib/fender-canvas/briefing-retail-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

/**
 * Action Items · Current findings: the same five Summary Briefing shares.
 * No lost-revenue placeholder and no history line.
 */
export function CurrentFindingsPanel({ read }: { read: RetailCanvasRead }) {
  const findability = useFindability();
  const ai = useAiSearch();
  const { findings } = briefingFindingsLead(read, findability, ai);

  return (
    <div className="content-box" data-current-findings-panel="">
      <div className="content-box-title">Current findings</div>
      <div className="briefing-findings" data-current-findings="">
        {findings.map((finding) => (
          <BriefingFindingCard key={finding.id} finding={finding} />
        ))}
      </div>
    </div>
  );
}
