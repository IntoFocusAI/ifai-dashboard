/**
 * Rolling 90 days (Brian, 11 Nov 2026): the plan is not a one-time 90 days. Each refresh dates
 * the phases from today, so there is always a current Days 1 to 30, 31 to 60, and 61 to 90.
 */

import type { PlanPhase } from "@/lib/fender-canvas/roadmap-plan";

const DAY_MS = 86_400_000;

/** First and last day of each phase, counted from today (day 1). */
const PHASE_DAYS: Record<PlanPhase, [number, number]> = {
  days_1_30: [1, 30],
  days_31_60: [31, 60],
  days_61_90: [61, 90],
};

export type PhaseWindow = { start: Date; end: Date; label: string };

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  // Calendar days, so a daylight-saving change never moves the date.
  const next = new Date(date.getTime() + days * DAY_MS + DAY_MS / 2);
  return localDay(next);
}

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "Nov 11 to Dec 10, 2026"; both years when the window crosses one. */
export function windowLabel(start: Date, end: Date): string {
  if (start.getFullYear() === end.getFullYear()) return `${MONTH_DAY.format(start)} to ${MONTH_DAY_YEAR.format(end)}`;
  return `${MONTH_DAY_YEAR.format(start)} to ${MONTH_DAY_YEAR.format(end)}`;
}

export function phaseWindow(phase: PlanPhase, today: Date): PhaseWindow {
  const [first, last] = PHASE_DAYS[phase];
  const day = localDay(today);
  const start = addDays(day, first - 1);
  const end = addDays(day, last - 1);
  return { start, end, label: windowLabel(start, end) };
}
