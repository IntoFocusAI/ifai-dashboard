import { compareRuns, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { isReviewHistoryRun } from "@/lib/ai-search/review-runs";
import { isError } from "@/lib/ai-search/run-metrics";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * AI Search opens on the latest month: the UTC calendar month of the published run the map shows.
 * Only published review runs with answered calls count as client results in that month.
 */

export type MonthBounds = { from: string; to: string };

export const NO_MONTH_RUN_HEADING = "No published run this month";

export function noMonthRunLine(day: string | null | undefined): string {
  return `${monthName(day) ?? "The latest month"} has no published run with answered calls.`;
}

/** Why a run in the latest month is not counted as a client result. */
export type MonthExclusion = "outside-review" | "unpublished" | "no-answers";

export function runDay(run: Pick<HistoryRunSummary, "published_at" | "completed_at">): string | null {
  return utcDay(run.published_at ?? run.completed_at);
}

/** First and last UTC day of the calendar month holding `day`. */
export function calendarMonthBounds(day: string | null | undefined): MonthBounds | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(day ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${match[1]}-${match[2]}-01`, to: `${match[1]}-${match[2]}-${String(last).padStart(2, "0")}` };
}

/** "November 2026" for any day in that month. */
export function monthName(day: string | null | undefined): string | null {
  const bounds = calendarMonthBounds(day);
  if (!bounds) return null;
  const [year, month] = bounds.from.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/**
 * Null when the run counts in the latest month. Unpublished review runs stay in Date range and
 * All time only, failed and fragment runs are outside the review history, and a run whose catalog
 * row records no answered call is empty.
 */
export function monthRunExclusion(run: HistoryRunSummary): MonthExclusion | null {
  if (run.is_published !== true || !run.published_at) return "unpublished";
  if (!isReviewHistoryRun(run)) return "outside-review";
  if (run.answered_calls != null && run.answered_calls <= 0) return "no-answers";
  return null;
}

/** The runs dated inside the month, split into the ones counted and the ones left out. */
export function latestMonthRuns(
  runs: readonly HistoryRunSummary[],
  anchorDay: string | null,
): {
  bounds: MonthBounds | null;
  included: HistoryRunSummary[];
  excluded: Array<{ run: HistoryRunSummary; reason: MonthExclusion }>;
} {
  const bounds = calendarMonthBounds(anchorDay);
  if (!bounds) return { bounds: null, included: [], excluded: [] };
  const included: HistoryRunSummary[] = [];
  const excluded: Array<{ run: HistoryRunSummary; reason: MonthExclusion }> = [];
  for (const run of [...runs].sort(compareRuns)) {
    const day = runDay(run);
    if (!day || day < bounds.from || day > bounds.to) continue;
    const reason = monthRunExclusion(run);
    if (reason) excluded.push({ run, reason });
    else included.push(run);
  }
  return { bounds, included, excluded };
}

/** The latest month counted from the most recent published review run in a catalog. */
export function latestPublishedDay(runs: readonly HistoryRunSummary[]): string | null {
  const published = runs.filter((run) => run.is_published === true && isReviewHistoryRun(run));
  const latest = [...published].sort(compareRuns).at(-1);
  return latest ? runDay(latest) : null;
}

/** A loaded run with at least one answered call. Provider errors alone are not a result. */
export function snapshotHasAnswers(snapshot: AiSearchSnapshot): boolean {
  return snapshot.calls.some((call) => !isError(call));
}

/** Loaded runs that count in the latest month: published, and with answered calls. */
export function clientMonthSnapshots(snapshots: readonly AiSearchSnapshot[]): AiSearchSnapshot[] {
  return snapshots.filter((snapshot) => snapshot.run.is_published === true && snapshotHasAnswers(snapshot));
}
