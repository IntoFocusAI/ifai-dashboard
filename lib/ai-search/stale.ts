import type { HistoryMode } from "@/lib/ai-search/history-mode";
import type { AiCurrentRun } from "@/lib/ai-search/types";
import { isPastCheckSchedule, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";

/**
 * An AI Search figure is stale once its newest published run is older than this many days
 * (FDD X-25, decision 4). AI Search runs every 2 to 3 days (Sunday, Tuesday, Thursday). The
 * longest normal gap is Thursday to Sunday, 3 days, and a figure is stale at twice that.
 * Change this one number to move the rule.
 */
export const AI_SEARCH_STALE_AFTER_DAYS = 6;

const DAY_MS = 86_400_000;

type RunTimes = Pick<AiCurrentRun, "published_at" | "completed_at">;

/**
 * The partial-figure reading for a published run that is past its check schedule, or null
 * while it is current. The tooltip names what is missing, the coverage, the source, the last
 * check, and the effect.
 */
export function aiSearchStale(run: RunTimes | null | undefined, now: number = Date.now()): PartialFigure | null {
  const at = run?.published_at ?? run?.completed_at ?? null;
  // isPastCheckSchedule is true past twice the schedule, so the schedule is half the limit.
  if (!isPastCheckSchedule(at, (AI_SEARCH_STALE_AFTER_DAYS * DAY_MS) / 2, now)) return null;
  return {
    reason: "stale",
    missing: `No AI Search run has been published in ${AI_SEARCH_STALE_AFTER_DAYS} days`,
    coverage: null,
    source: "canvas_ai_current_run",
    lastCheck: at,
  };
}

const SHORT_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Nov 12" for a run's UTC day ("2026-11-12"). */
export function shortRunDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : SHORT_DAY.format(date);
}

/**
 * X-25 for an AI rate whose window mixes runs from before and after a question-set change
 * (`day` is the first run on the new set, from windowQuestionSetChange). Null when no change.
 */
export function questionSetMixed(day: string | null | undefined): PartialFigure | null {
  if (!day) return null;
  return {
    reason: "mixed",
    missing: `This window mixes runs before and after the question set changed on ${shortRunDay(day)}; rates are not fully comparable across that date.`,
    source: "canvas_ai_runs",
  };
}

/** One asterisk for both readings: stale names its title, and the tooltip carries both sentences. */
export function aiWindowPartial(stale: PartialFigure | null, mixed: PartialFigure | null): PartialFigure | null {
  if (!stale || !mixed) return stale ?? mixed;
  return { ...stale, missing: `${stale.missing}\n${mixed.missing}` };
}

/**
 * True when the selection on screen ends on the published run, so a stale published run makes
 * its figures stale. A run or a range the reader picked from the past is named by the date pill
 * and is not marked.
 */
export function selectionEndsOnPublishedRun(
  mode: HistoryMode,
  publishedRunId: string | null,
  publishedDay: string | null,
): boolean {
  if (mode.kind === "month" || mode.kind === "all") return true;
  if (mode.kind === "run") return publishedRunId != null && mode.runId === publishedRunId;
  if (mode.kind === "range") return publishedDay != null && mode.to >= publishedDay;
  return false;
}
