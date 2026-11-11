/**
 * The Roadmap map bubble and its metric: current findings that need action, of those with a
 * stored reading. The same function the Roadmap tab leads with (planFindingsFigure), on the map's
 * AI population. A missing figure reads Not available* in the neutral color, never Champagne.
 */

import type { AiSearchRead } from "@/lib/ai-search/types";
import type { CanvasMetric, CanvasNode } from "@/lib/canvas-sdk/types";
import { BRIEFING_LOADING, briefingFindingsLead } from "@/lib/fender-canvas/briefing-retail-lead";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { PLAN_FIGURE_LABEL, planFindingsFigure } from "@/lib/fender-canvas/roadmap-plan";
import type { FindabilityRead } from "@/lib/findability/copy";

export const ROADMAP_TAB = "30-60-90 Days";
export const ROADMAP_METRIC_ID = "day-90-buy-box-target";

/** The bubble's hero text: "3 of 5", with the asterisk when a finding has no stored reading. */
export function roadmapHeroValue(
  retail: RetailCanvasRead,
  findability: FindabilityRead,
  ai: AiSearchRead,
): string {
  const figure = planFindingsFigure(briefingFindingsLead(retail, findability, ai).findings);
  if (figure.phase === "loading") return BRIEFING_LOADING;
  if (figure.phase === "missing") return READ_NOT_AVAILABLE;
  return figure.partial ? `${figure.value}*` : figure.value;
}

/** The face nodes-from-live gives the Roadmap bubble. Status stays neutral: a plan is not graded. */
export function roadmapBubbleFace(
  retail: RetailCanvasRead,
  findability: FindabilityRead,
  ai: AiSearchRead,
): Pick<CanvasNode, "status" | "heroValue" | "subTab"> {
  return {
    status: "neutral",
    heroValue: { value: roadmapHeroValue(retail, findability, ai), label: PLAN_FIGURE_LABEL },
    subTab: ROADMAP_TAB,
  };
}

/** The Roadmap metric for the widgets and the Minimal view. */
export function roadmapMetric(
  retail: RetailCanvasRead,
  findability: FindabilityRead,
  ai: AiSearchRead,
): CanvasMetric {
  return {
    id: ROADMAP_METRIC_ID,
    spokeId: "roadmap",
    label: "90-day plan",
    value: roadmapHeroValue(retail, findability, ai),
    detail: "Findings that need action now",
    tone: "neutral",
    subTab: ROADMAP_TAB,
    provenance: "live",
  };
}
