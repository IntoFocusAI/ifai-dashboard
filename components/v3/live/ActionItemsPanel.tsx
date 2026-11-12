"use client";

import "@/components/v3/live/roadmap-plan.css";
import { useState } from "react";
import { ActionItemsFixTable } from "@/components/v3/live/ActionItemsFixTable";
import { useRoadmapPlan } from "@/components/v3/live/RoadmapPlanData";
import { FIX_LIST_PRIORITY_RULE, FIX_LIST_TITLE } from "@/lib/fender-canvas/action-items-fix-list";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { emptyPlanLine } from "@/lib/fender-canvas/roadmap-plan";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/**
 * Action Items · Urgent Interventions (N-01, N-04): the five current findings in priority order,
 * then the decision 21 actions, on the map's AI population. When nothing needs action the list
 * says so in one plain line above the table.
 */
export function ActionItemsPanel({ read, bundle }: { read: RetailCanvasRead; bundle: CanvasBundle | null }) {
  const { plan, sources } = useRoadmapPlan(read, bundle);
  const [today] = useState(() => new Date());
  const empty = sources.phase === "ready" ? emptyPlanLine(plan) : null;

  return (
    <div className="content-box" data-fix-list="" data-fix-sources={sources.phase}>
      <div className="content-box-title">
        <span
          className="ifai-term"
          data-ifai-tooltip-title={FIX_LIST_TITLE}
          data-ifai-tooltip-desc={FIX_LIST_PRIORITY_RULE}
          tabIndex={0}
          aria-label={`${FIX_LIST_TITLE}: ${FIX_LIST_PRIORITY_RULE}`}
        >
          {FIX_LIST_TITLE}
        </span>
      </div>
      {empty ? (
        <p className="plan-empty" data-fix-empty="">
          {empty}
        </p>
      ) : null}
      <ActionItemsFixTable plan={plan} today={today} />
      {sources.phase === "loading" ? (
        <p className="plan-note" data-fix-sources-loading="">
          Loading the source actions and the last 30 days of AI Search answers.
        </p>
      ) : null}
    </div>
  );
}
