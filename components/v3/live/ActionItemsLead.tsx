"use client";

import { ShareHeroCard } from "@/components/v3/live/ShareHeroCard";
import { actionItemsLead } from "@/lib/fender-canvas/action-items-lead";
import type { BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";

/** Critical findings as N of M with a status disc, ahead of the Action Items cards. */
export function ActionItemsLead({ findings }: { findings: BriefingFinding[] }) {
  const lead = actionItemsLead(findings);
  return (
    <div style={{ marginBottom: 10 }}>
      <ShareHeroCard hero={lead} dataAttr="data-action-items-lead" open={false} controls="" />
    </div>
  );
}
