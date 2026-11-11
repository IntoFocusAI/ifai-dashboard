/**
 * The Roadmap map bubble and its metric. The bubble carries no hero figure: it reads a static
 * "30-60-90" for every client, so a sponsor knows a click opens the next 90 days of strategy
 * (decision, 11 Nov 2026). The findings figure lives on the 30-60-90 Days tab, not here. A plan is
 * not graded, so the bubble stays neutral, never Champagne.
 */

import type { CanvasMetric, CanvasNode } from "@/lib/canvas-sdk/types";

export const ROADMAP_TAB = "30-60-90 Days";
export const ROADMAP_METRIC_ID = "day-90-buy-box-target";

/** The bubble's static text. No percentage, no status, no label. */
export const ROADMAP_BUBBLE_VALUE = "30-60-90";

/** The face the Roadmap bubble gets, static and neutral. Click opens the 30-60-90 Days tab. */
export function roadmapBubbleFace(): Pick<CanvasNode, "status" | "heroValue" | "subTab"> {
  return {
    status: "neutral",
    heroValue: { value: ROADMAP_BUBBLE_VALUE, label: "" },
    subTab: ROADMAP_TAB,
  };
}

/** The Roadmap metric for the widgets and the Minimal view: the same static text. */
export function roadmapMetric(): CanvasMetric {
  return {
    id: ROADMAP_METRIC_ID,
    spokeId: "roadmap",
    label: "Roadmap",
    value: ROADMAP_BUBBLE_VALUE,
    detail: "The next 90 days of strategy",
    tone: "neutral",
    subTab: ROADMAP_TAB,
    provenance: "live",
  };
}
