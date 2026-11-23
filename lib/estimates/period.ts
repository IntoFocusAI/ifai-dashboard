// R-07: the period a period-scaled dollar figure (the Buy Box figure, R-06) counts, read from the
// shared date pill, the only period label on screen.
//
//   Last 30 days        30 days
//   Date range          the days picked, both ends counted
//   All time            the first run's day to the window's last day, both ends counted
//   A single run        30 days: a run is one day, so the figure keeps the pill's default window
//
// Nothing here names a client.

/** The pill's default window, and the period a single run or an unread window falls back to. */
export const DEFAULT_PERIOD_DAYS = 30;

/** The pill's selection, as lib/ai-search/history-mode.ts names it. */
export type PeriodSelection =
  | { kind: "month" }
  | { kind: "range"; from: string; to: string }
  | { kind: "all" }
  | { kind: "run"; runId: string }
  | { kind: "legacy"; runId: string };

const DAY_MS = 86_400_000;

function dayNumber(day: string | null | undefined): number | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / DAY_MS) : null;
}

/** Days from `from` to `to`, both counted. null when either day is missing or out of order. */
export function daysInclusive(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a == null || b == null || b < a) return null;
  return b - a + 1;
}

/**
 * The period's length in days for the pill's selection. `runDays` are the days of the runs the
 * window holds (All time reads its first one); `windowEnd` is the default window's last day.
 */
export function periodDaysFor(mode: PeriodSelection, opts: { windowEnd?: string | null; runDays?: readonly (string | null)[] } = {}): number {
  if (mode.kind === "range") return daysInclusive(mode.from, mode.to) ?? DEFAULT_PERIOD_DAYS;
  if (mode.kind === "all") {
    const days = (opts.runDays ?? []).filter((d): d is string => dayNumber(d) != null).sort();
    if (days.length === 0) return DEFAULT_PERIOD_DAYS;
    const last = opts.windowEnd && dayNumber(opts.windowEnd) != null && opts.windowEnd > days[days.length - 1]! ? opts.windowEnd : days[days.length - 1]!;
    return daysInclusive(days[0], last) ?? DEFAULT_PERIOD_DAYS;
  }
  return DEFAULT_PERIOD_DAYS;
}
