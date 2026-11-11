/**
 * The per-row stale rule (X-25, Brian 9 Nov 2026; method approved 11 Nov): a figure carries the
 * asterisk when part of its population is stale. A row is stale when its own check time is older
 * than twice its recheck interval; a row with no stored check time is stale too. The tooltip
 * reads "N of M listings checked in the last X days", the same coverage pattern Findability uses.
 */

import { formatInt } from "@/lib/fender-canvas/format";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";

const DAY_MS = 86_400_000;

/** Recheck intervals in days (Watson, 11 Nov 2026). A row is stale after twice its interval. */
export const RECHECK_DAYS = {
  /** Buy Box, suppression, Amazon MAP, Splintered Listings "for sale now": featured_offer_checked_at. */
  buyBox: 1,
  /** Walmart price (Fender): wmt_checked_at. */
  walmartFender: 1,
  /** Walmart price (Ledlenser): wmt_checked_at. */
  walmartLedlenser: 2,
  /** Musician's Friend price (Fender only): mf_checked_at. */
  musiciansFriend: 3,
  /** Out of Stock unit estimates: smartscout_products.snapshot_date. */
  smartscout: 7,
  /** Keepa daily history: keepa_daily.day. */
  keepa: 1,
  /** Amazon specs (spec_readiness.checked_at) and listing content (content_checked_at). */
  weekly: 7,
} as const;

export type RowCheckRule = {
  /** The recheck interval in days. A row is stale after twice this. */
  intervalDays: number;
  /** The check, as a client reads it: "Buy Box check". */
  check: string;
  /** The table or view the figure reads. */
  source: string;
  /** What the figure counts, for the effect sentence: "Buy Box shares". */
  figure: string;
  /** What one row is, plural. Default "listings". */
  unit?: string;
};

export type RowCoverage = {
  /** Rows whose own check is inside the stale window. */
  recent: number;
  /** Every row in the figure's population. */
  total: number;
  /** Newest stored check time among the rows, as ISO in UTC. Null when none has one. */
  newest: string | null;
};

export function staleWindowDays(intervalDays: number): number {
  return 2 * intervalDays;
}

/** A stored time as milliseconds. Blank, missing, and unparseable times are null. */
function timeMs(value: string | null | undefined): number | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  // A bare date (snapshot_date, history day) is a UTC day.
  const ms = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Counts the rows checked inside the stale window, from each row's own stored check time. */
export function rowCoverage<T>(
  rows: readonly T[],
  storedAt: (row: T) => string | null | undefined,
  intervalDays: number,
  now: number = Date.now(),
): RowCoverage {
  const windowMs = staleWindowDays(intervalDays) * DAY_MS;
  let recent = 0;
  let newestMs: number | null = null;
  for (const row of rows) {
    const at = timeMs(storedAt(row));
    if (at == null) continue;
    if (newestMs == null || at > newestMs) newestMs = at;
    if (now - at <= windowMs) recent += 1;
  }
  return { recent, total: rows.length, newest: newestMs == null ? null : new Date(newestMs).toISOString() };
}

/** "26 of 1,061 listings checked in the last 2 days" */
export function rowCoverageLine({ recent, total }: RowCoverage, intervalDays: number, unit = "listings"): string {
  const days = staleWindowDays(intervalDays);
  return `${formatInt(recent)} of ${formatInt(total)} ${unit} checked in the last ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The partial reading for one population: null while every row has a check inside the stale
 * window (and for an empty population), otherwise a coverage reading naming how many are older.
 */
export function rowsStale<T>(
  rows: readonly T[],
  storedAt: (row: T) => string | null | undefined,
  rule: RowCheckRule,
  now: number = Date.now(),
): PartialFigure | null {
  const coverage = rowCoverage(rows, storedAt, rule.intervalDays, now);
  if (coverage.total === 0 || coverage.recent === coverage.total) return null;
  const older = coverage.total - coverage.recent;
  const days = staleWindowDays(rule.intervalDays);
  const unit = rule.unit ?? "listings";
  return {
    reason: "coverage",
    missing: `${formatInt(older)} ${older === 1 ? `${unit.replace(/s$/, "")} has` : `${unit} have`} no ${rule.check} in the last ${days} ${days === 1 ? "day" : "days"}`,
    coverage: rowCoverageLine(coverage, rule.intervalDays, unit),
    source: rule.source,
    lastCheck: coverage.newest ?? null,
    effect: `The ${rule.figure} include older checks and may differ from the listings today`,
  };
}

/**
 * Several stale readings behind one figure (for example MAP prices across three channels) as
 * one partial figure. Null when none is stale.
 */
export function combineStale(
  parts: readonly { label: string; stale: PartialFigure | null }[],
  figure: string,
): PartialFigure | null {
  const stale = parts.filter((part): part is { label: string; stale: PartialFigure } => part.stale != null);
  if (stale.length === 0) return null;
  if (stale.length === 1 && parts.length === 1) return stale[0].stale;
  const newest = stale
    .map((part) => part.stale.lastCheck)
    .filter((at): at is string => Boolean(at))
    .sort()
    .pop();
  return {
    reason: "coverage",
    missing: stale.map((part) => `${part.label}: ${part.stale.missing}`).join(". "),
    coverage: stale.map((part) => `${part.label}: ${part.stale.coverage}`).join("; "),
    source: Array.from(new Set(stale.map((part) => part.stale.source))).join(" and "),
    lastCheck: newest ?? null,
    effect: `The ${figure} include older checks and may differ from the listings today`,
  };
}

/** Two partial readings behind one figure, as one. Either may be null. */
export function mergePartial(a: PartialFigure | null, b: PartialFigure | null): PartialFigure | null {
  if (!a || !b) return a ?? b;
  return {
    reason: "coverage",
    missing: `${a.missing.replace(/\.$/, "")}. ${b.missing}`,
    coverage: [a.coverage, b.coverage].filter(Boolean).join("; ") || null,
    source: a.source === b.source ? a.source : `${a.source} and ${b.source}`,
    lastCheck: b.lastCheck ?? a.lastCheck,
    effect: [a.effect, b.effect].filter(Boolean).join(" ") || null,
  };
}
