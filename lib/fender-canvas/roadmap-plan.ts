/**
 * Strategy Roadmap plan. Three windows roll forward from the day the page is
 * opened. Placement uses each briefing finding's tone and whether a reading
 * is stored. No new findings, dollars, or owners.
 */

import {
  BRIEFING_COUNT_MISSING,
  type BriefingFinding,
} from "@/lib/fender-canvas/briefing-retail-lead";

export const ROADMAP_OWNER_SENTENCE =
  "Shared plan. The activity follows the current findings. It does not set a new owner.";

export type RoadmapPhaseId = "days-1-30" | "days-31-60" | "days-61-90";

export type RoadmapPhaseWindow = {
  id: RoadmapPhaseId;
  label: string;
  /** Inclusive offset from the day the page is opened. Day 1 is offset 0. */
  startOffset: number;
  endOffset: number;
};

export const ROADMAP_PHASE_WINDOWS: readonly RoadmapPhaseWindow[] = [
  { id: "days-1-30", label: "Days 1 to 30", startOffset: 0, endOffset: 29 },
  { id: "days-31-60", label: "Days 31 to 60", startOffset: 30, endOffset: 59 },
  { id: "days-61-90", label: "Days 61 to 90", startOffset: 60, endOffset: 89 },
];

export type RoadmapPhasePlan = {
  id: RoadmapPhaseId;
  label: string;
  start: Date;
  end: Date;
  rangeLabel: string;
  findings: BriefingFinding[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function findingHasStoredReading(
  finding: Pick<BriefingFinding, "percent" | "numerator" | "denominator">,
): boolean {
  return (
    finding.percent !== BRIEFING_COUNT_MISSING &&
    finding.numerator != null &&
    finding.denominator != null
  );
}

/**
 * A danger finding, or any finding with no stored reading, is in the first
 * 30 days. A warning with a stored reading is in the next 30. A success
 * finding is in the last 30.
 */
export function roadmapPhaseForFinding(
  finding: Pick<BriefingFinding, "tone" | "percent" | "numerator" | "denominator">,
): RoadmapPhaseId {
  if (finding.tone === "danger" || !findingHasStoredReading(finding)) return "days-1-30";
  if (finding.tone === "warning") return "days-31-60";
  return "days-61-90";
}

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

/** Three dated windows. Findings stay in briefing order inside each window. */
export function buildRoadmapPlan(
  findings: readonly BriefingFinding[],
  openedOn: Date,
): RoadmapPhasePlan[] {
  const day = startOfLocalDay(openedOn);
  return ROADMAP_PHASE_WINDOWS.map((window) => {
    const start = addCalendarDays(day, window.startOffset);
    const end = addCalendarDays(day, window.endOffset);
    return {
      id: window.id,
      label: window.label,
      start,
      end,
      rangeLabel: formatRoadmapRange(start, end),
      findings: findings.filter((finding) => roadmapPhaseForFinding(finding) === window.id),
    };
  });
}
