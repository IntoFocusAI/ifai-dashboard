import { citationMonthBounds } from "@/lib/ai-search/citation-aggregate";
import { compareRuns, formatDay, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { isReviewHistoryRun } from "@/lib/ai-search/review-runs";
import { isError } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * AI Search opens on the last 30 days: 30 UTC days ending on the day of the published run the map
 * shows. Only published review runs with answered calls count as client results in that window.
 */

export type WindowBounds = { from: string; to: string };

export const LAST_30_DAYS_LABEL = "Last 30 days";

export const NO_WINDOW_RUN_HEADING = "No published run in the last 30 days";

/** Why a run dated inside the window is not counted as a client result. */
export type WindowExclusion = "outside-review" | "unpublished" | "no-answers";

export function runDay(run: Pick<HistoryRunSummary, "published_at" | "completed_at">): string | null {
  return utcDay(run.published_at ?? run.completed_at);
}

/** The 30 UTC days ending on `endDay`, both ends included. */
export function defaultWindowBounds(endDay: string | null | undefined): WindowBounds | null {
  if (!endDay || !/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return null;
  return citationMonthBounds(endDay);
}

/** "Oct 5 to Nov 3, 2026". The first year is kept when the span crosses a year. */
export function daySpan(bounds: WindowBounds): string {
  const from = formatDay(bounds.from);
  const to = formatDay(bounds.to);
  return bounds.from.slice(0, 4) === bounds.to.slice(0, 4) ? `${from.replace(/, \d{4}$/, "")} to ${to}` : `${from} to ${to}`;
}

/** The shared pill's name for the default window, e.g. "Last 30 days · Oct 5 to Nov 3, 2026". */
export function defaultWindowLabel(endDay: string | null | undefined): string {
  const bounds = defaultWindowBounds(endDay);
  return bounds ? `${LAST_30_DAYS_LABEL} · ${daySpan(bounds)}` : LAST_30_DAYS_LABEL;
}

export function noWindowRunLine(endDay: string | null | undefined): string {
  const bounds = defaultWindowBounds(endDay);
  return bounds
    ? `No run published between ${daySpan(bounds).replace(" to ", " and ")} has answered calls.`
    : "No run published in the last 30 days has answered calls.";
}

/**
 * Null when the run counts in the default window. Unpublished review runs stay in Date range and
 * All time only, failed and fragment runs are outside the review history, and a run whose catalog
 * row records no answered call is empty.
 */
export function windowRunExclusion(run: HistoryRunSummary): WindowExclusion | null {
  if (run.is_published !== true || !run.published_at) return "unpublished";
  if (!isReviewHistoryRun(run)) return "outside-review";
  if (run.answered_calls != null && run.answered_calls <= 0) return "no-answers";
  return null;
}

/** The runs dated inside the default window, split into the ones counted and the ones left out. */
export function defaultWindowRuns(
  runs: readonly HistoryRunSummary[],
  endDay: string | null,
): {
  bounds: WindowBounds | null;
  included: HistoryRunSummary[];
  excluded: Array<{ run: HistoryRunSummary; reason: WindowExclusion }>;
} {
  const bounds = defaultWindowBounds(endDay);
  if (!bounds) return { bounds: null, included: [], excluded: [] };
  const included: HistoryRunSummary[] = [];
  const excluded: Array<{ run: HistoryRunSummary; reason: WindowExclusion }> = [];
  for (const run of [...runs].sort(compareRuns)) {
    const day = runDay(run);
    if (!day || day < bounds.from || day > bounds.to) continue;
    const reason = windowRunExclusion(run);
    if (reason) excluded.push({ run, reason });
    else included.push(run);
  }
  return { bounds, included, excluded };
}

/** The day of the most recent published review run in a catalog. */
export function latestPublishedDay(runs: readonly HistoryRunSummary[]): string | null {
  const published = runs.filter((run) => run.is_published === true && isReviewHistoryRun(run));
  const latest = [...published].sort(compareRuns).at(-1);
  return latest ? runDay(latest) : null;
}

/** A loaded run with at least one answered call. Provider errors alone are not a result. */
export function snapshotHasAnswers(snapshot: AiSearchSnapshot): boolean {
  return snapshot.calls.some((call) => !isError(call));
}

/** Loaded runs that count in the default window: published, and with answered calls. */
export function clientWindowSnapshots(snapshots: readonly AiSearchSnapshot[]): AiSearchSnapshot[] {
  return snapshots.filter((snapshot) => snapshot.run.is_published === true && snapshotHasAnswers(snapshot));
}
