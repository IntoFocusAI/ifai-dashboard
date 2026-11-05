/**
 * Strategy Roadmap plan. Three windows roll forward from the day the page is
 * opened. Each finding stays in its phase. A missing figure stays Not available*
 * and does not move the step. No new findings, dollars, or owners.
 */

import type { BriefingFinding, BriefingFindingId } from "@/lib/fender-canvas/briefing-retail-lead";

export const ROADMAP_OWNER_SENTENCE =
  "Shared plan. The activity follows the current findings. It does not set a new owner.";

export const ROADMAP_ACTIONS = {
  buy_box: "Correct each offer so a shopper can add the product to the cart.",
  map_leakage: "Raise advertised prices back to the agreed floor.",
  splintered_bundles: "Nest each bundle under its official parent listing.",
  exact_official_product: "Publish one fender.com page for each exact product that lacks one.",
  unbranded_discovery:
    "Confirm assistants name Fender when the shopper does not. That result moves when the offers, prices, bundles, and exact pages are fixed.",
} as const satisfies Record<BriefingFindingId, string>;

export type RoadmapPhaseId = "days-1-30" | "days-31-60" | "days-61-90";

export type RoadmapPhaseWindow = {
  id: RoadmapPhaseId;
  label: string;
  /** A few words for what this window is about. */
  focus: string;
  /** Inclusive offset from the day the page is opened. Day 1 is offset 0. */
  startOffset: number;
  endOffset: number;
  stepIds: readonly BriefingFindingId[];
};

export const ROADMAP_PHASE_WINDOWS: readonly RoadmapPhaseWindow[] = [
  {
    id: "days-1-30",
    label: "Days 1 to 30",
    focus: "the offer",
    startOffset: 0,
    endOffset: 29,
    stepIds: ["buy_box", "map_leakage"],
  },
  {
    id: "days-31-60",
    label: "Days 31 to 60",
    focus: "the catalog",
    startOffset: 30,
    endOffset: 59,
    stepIds: ["splintered_bundles", "exact_official_product"],
  },
  {
    id: "days-61-90",
    label: "Days 61 to 90",
    focus: "the AI result",
    startOffset: 60,
    endOffset: 89,
    stepIds: ["unbranded_discovery"],
  },
];

export type RoadmapPlanStep = {
  finding: BriefingFinding;
  action: string;
};

export type RoadmapPhasePlan = {
  id: RoadmapPhaseId;
  label: string;
  focus: string;
  heading: string;
  start: Date;
  end: Date;
  rangeLabel: string;
  steps: RoadmapPlanStep[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarDays(date: Date, days: number): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatRoadmapDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatRoadmapRange(start: Date, end: Date): string {
  return `${formatRoadmapDay(start)} to ${formatRoadmapDay(end)}`;
}

/** Three dated windows. Steps stay in the fixed phase order. */
export function buildRoadmapPlan(
  findings: readonly BriefingFinding[],
  openedOn: Date,
): RoadmapPhasePlan[] {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const day = startOfLocalDay(openedOn);
  return ROADMAP_PHASE_WINDOWS.map((window) => {
    const start = addCalendarDays(day, window.startOffset);
    const end = addCalendarDays(day, window.endOffset);
    return {
      id: window.id,
      label: window.label,
      focus: window.focus,
      heading: `${window.label}, ${window.focus}`,
      start,
      end,
      rangeLabel: formatRoadmapRange(start, end),
      steps: window.stepIds.flatMap((id) => {
        const finding = byId.get(id);
        if (!finding) return [];
        return [{ finding, action: ROADMAP_ACTIONS[id] }];
      }),
    };
  });
}
