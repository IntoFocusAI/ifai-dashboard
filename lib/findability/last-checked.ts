/**
 * Freshness for one stored read (FDD X-12): the newest stored check time among rows
 * that were checked. An unchecked row's time is not a check time. Findability uses it
 * for the official-page read; Amazon Specs uses it for the Amazon spec read (FDD D-04).
 */

import { isPastCheckSchedule, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatInt } from "@/lib/fender-canvas/format";
import { RECHECK_DAYS, rowsStale } from "@/lib/fender-canvas/row-stale";
import { findabilityOutcome, type FindabilityRow } from "@/lib/findability/outcomes";

export const LAST_CHECKED_UNAVAILABLE_LABEL = "Not available*";

export const LAST_CHECKED_UNAVAILABLE_TITLE = "Last checked";

export const LAST_CHECKED_UNAVAILABLE_DESC =
  "This official-page read has no stored check time.";

export const AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC =
  "The Amazon listing check has no check time recorded for any listing whose Amazon page was checked.";

export const AMAZON_SPECS_LAST_CHECKED_FAILED_DESC =
  "The Amazon listings did not load, so their check time is not shown. Reload to try again.";

/**
 * Newest parseable stored time among rows `checked` accepts, as ISO in UTC.
 * Null, blank, and unparseable times are ignored. Null when no checked row has one.
 */
export function newestCheckTime<T>(
  rows: readonly T[],
  checked: (row: T) => boolean,
  storedAt: (row: T) => string | null | undefined,
): string | null {
  let newestMs: number | null = null;
  for (const row of rows) {
    if (!checked(row)) continue;
    const raw = storedAt(row)?.trim();
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) continue;
    if (newestMs == null || ms > newestMs) newestMs = ms;
  }
  return newestMs == null ? null : new Date(newestMs).toISOString();
}

/**
 * Newest parseable latest_attempt_at among rows whose outcome is not unchecked.
 * Blank latest_state is unchecked.
 */
export function newestCheckedAttemptAt(rows: readonly FindabilityRow[]): string | null {
  return newestCheckTime(
    rows,
    (row) => findabilityOutcome(row) !== "not_checked",
    (row) => row.latest_attempt_at,
  );
}

export type AmazonSpecCheckRow = {
  amazon_checked?: boolean | null;
  checked_at?: string | null;
};

/** Newest checked_at among Amazon Specs listings whose Amazon page was read (amazon_checked true). */
export function newestAmazonSpecCheckAt(rows: readonly AmazonSpecCheckRow[]): string | null {
  return newestCheckTime(
    rows,
    (row) => row.amazon_checked === true,
    (row) => row.checked_at,
  );
}

/**
 * The per-row stale reading (X-25) for the Amazon spec figures: each Amazon-checked listing's own
 * spec_readiness.checked_at against twice the weekly schedule.
 */
export function amazonSpecsStale(rows: readonly AmazonSpecCheckRow[], now: number = Date.now()): PartialFigure | null {
  return rowsStale(
    rows.filter((row) => row.amazon_checked === true),
    (row) => row.checked_at,
    { intervalDays: RECHECK_DAYS.weekly, check: "Amazon spec check", source: "canvas_spec_readiness", figure: "completeness figures" },
    now,
  );
}

/** Lead sentence when a usable check time exists, in UTC. Null when it does not. */
export function lastCheckedSentence(iso: string | null): string | null {
  const formatted = formatCheckedAt(iso);
  if (!formatted) return null;
  return `Last checked ${formatted}.`;
}

/** Client lead sentence when a usable check time exists. Null when it does not. */
export function findabilityLastCheckedSentence(iso: string | null): string | null {
  return lastCheckedSentence(iso);
}

/**
 * Spec and Findability checks run weekly (X-25, decision 4). A figure is stale once its
 * newest check is older than twice that, 14 days. Change this one number to move the rule.
 */
export const WEEKLY_CHECK_DAYS = 7;

const DAY_MS = 86_400_000;

export type WeeklyCheck = {
  /** The check, as a client reads it: "official-page check", "Amazon listing check". */
  check: string;
  /** The table or view the figure reads. */
  source: string;
  /** What the figure counts, for the effect sentence: "outcome shares". */
  figure: string;
};

/**
 * The stale reading (X-25) for a figure from a weekly check whose newest stored check time is
 * past twice the schedule. Null while the check is current, or when no check time is stored
 * (Last checked then reads Not available*).
 */
export function weeklyCheckStale(
  checkedAt: string | null | undefined,
  { check, source, figure }: WeeklyCheck,
  now: number = Date.now(),
): PartialFigure | null {
  if (!isPastCheckSchedule(checkedAt, WEEKLY_CHECK_DAYS * DAY_MS, now)) return null;
  const since = formatCheckedAt(checkedAt) ?? "the last check";
  return {
    reason: "stale",
    missing: `The ${check} runs weekly and has not run since ${since}, so changes after that check are missing`,
    source,
    lastCheck: checkedAt ?? null,
    effect: `The ${figure} show the last check and may differ from the pages today`,
  };
}

/** A row is current while its own check is no older than twice the weekly schedule. */
export const STALE_WINDOW_DAYS = 2 * WEEKLY_CHECK_DAYS;

export type CheckCoverage = {
  /** Rows whose own stored check is inside the stale window. */
  recent: number;
  /** Every row in the figure's population. */
  total: number;
};

/**
 * How many rows were checked inside the stale window, counted from each row's own stored
 * check time. A row with no check (unchecked, or no stored time) is not recent.
 */
export function checkCoverage<T>(
  rows: readonly T[],
  checked: (row: T) => boolean,
  storedAt: (row: T) => string | null | undefined,
  now: number = Date.now(),
): CheckCoverage {
  const windowMs = STALE_WINDOW_DAYS * DAY_MS;
  let recent = 0;
  for (const row of rows) {
    if (!checked(row)) continue;
    const at = new Date(storedAt(row)?.trim() ?? "").getTime();
    if (Number.isFinite(at) && now - at <= windowMs) recent += 1;
  }
  return { recent, total: rows.length };
}

/** Official-page rows checked in the last 14 days, of every row in the Findability read. */
export function findabilityCoverage(rows: readonly FindabilityRow[], now: number = Date.now()): CheckCoverage {
  return checkCoverage(
    rows,
    (row) => findabilityOutcome(row) !== "not_checked",
    (row) => row.latest_attempt_at,
    now,
  );
}

/** "26 of 1,061 listings checked in the last 14 days" */
export function findabilityCoverageLine({ recent, total }: CheckCoverage): string {
  return `${formatInt(recent)} of ${formatInt(total)} listings checked in the last ${STALE_WINDOW_DAYS} days`;
}

/**
 * The partial reading (X-25) for every Findability figure: the tab heroes, the map's
 * Findability bubble, and the Minimal tiles. The official-page check now rechecks a few
 * listings at a time, so the newest check says little about the rest. A figure carries the
 * asterisk while any listing in the read has no check inside the stale window.
 */
export function findabilityStale(rows: readonly FindabilityRow[], now: number = Date.now()): PartialFigure | null {
  const coverage = findabilityCoverage(rows, now);
  if (coverage.total === 0 || coverage.recent === coverage.total) return null;
  const older = coverage.total - coverage.recent;
  return {
    reason: "coverage",
    missing: `${formatInt(older)} ${older === 1 ? "listing has" : "listings have"} no official-page check in the last ${STALE_WINDOW_DAYS} days`,
    coverage: findabilityCoverageLine(coverage),
    source: "canvas_spec_findability",
    effect: "The outcome shares include older checks and may differ from the pages today",
  };
}

/** The Last checked tooltip: the newest check, and how many listings the window covers. */
export function findabilityLastCheckedTip(rows: readonly FindabilityRow[], now: number = Date.now()): string {
  const coverage = findabilityCoverage(rows, now);
  return `This is the newest official-page check. ${findabilityCoverageLine(coverage)}.`;
}
