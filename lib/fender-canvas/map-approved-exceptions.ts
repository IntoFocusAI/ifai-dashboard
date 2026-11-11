/**
 * MAP approved exceptions (FDD R-12).
 *
 * A MAP row set aside with the reason "Approved exception" (for example a promotion the
 * brand signed off) is left out of every MAP violation figure. The exclusion happens once,
 * here, on the shared retail snapshot, so the MAP tab, Retail Overview, Summary Briefing,
 * the Catalog Health satellite, and Minimal view all read the same count.
 *
 * Only an active set-aside with that reason counts. Done, other reasons, and reopened rows
 * stay in the figures.
 */

import { formatInt } from "./format";
import {
  mapAsinKey,
  mapLeakageFinding,
  selectRetailHeadline,
  type PortfolioRetailSnapshot,
} from "./portfolio-retail";

export const APPROVED_EXCEPTION_REASON = "approved_exception";

/** The fields of a set-aside row this rule reads. */
export type MapSetAsideFields = {
  entity_key: string;
  status: string;
  outcome?: string | null;
  reason_code: string | null;
};

export function isApprovedException(row: MapSetAsideFields): boolean {
  return (
    row.status === "active" &&
    (row.outcome ?? "set_aside") === "set_aside" &&
    row.reason_code === APPROVED_EXCEPTION_REASON
  );
}

/** Upper-case ASINs with an active Approved exception on the MAP check. */
export function approvedExceptionAsins(rows: readonly MapSetAsideFields[]): Set<string> {
  const asins = new Set<string>();
  for (const row of rows) {
    if (!isApprovedException(row)) continue;
    const key = mapAsinKey(row.entity_key);
    if (key) asins.add(key);
  }
  return asins;
}

/** Rows whose ASIN is not an approved exception. */
export function withoutApprovedExceptions<T extends { asin?: string | null }>(
  rows: readonly T[],
  asins: ReadonlySet<string>,
): T[] {
  if (!asins.size) return [...rows];
  return rows.filter((row) => {
    const key = mapAsinKey(row.asin);
    return key == null || !asins.has(key);
  });
}

/**
 * The snapshot with the MAP reading recomputed without approved exceptions, and the
 * headline reselected from it. Unchanged when the MAP rows were not kept.
 */
export function withMapApprovedExceptions(
  snapshot: PortfolioRetailSnapshot,
  asins: ReadonlySet<string>,
  options?: { failed?: boolean },
): PortfolioRetailSnapshot {
  const read = snapshot.mapRead;
  if (!read) return snapshot;
  const mapLeakage = mapLeakageFinding(read.rows, {
    truncated: read.truncated,
    approvedExceptions: asins,
  });
  const findings = { ...snapshot, mapLeakage };
  return {
    ...findings,
    headline: selectRetailHeadline(findings),
    mapApprovedExceptionsFailed: Boolean(options?.failed),
  };
}

/** Tooltip sentence: how many listings were left out as approved exceptions. */
export function approvedExceptionsSentence(count: number, failed = false): string {
  if (failed) return "MAP set-asides could not be loaded, so no approved exception is left out of this count.";
  if (count === 1) return "1 listing set aside as an approved exception is left out of this count.";
  return `${formatInt(count)} listings set aside as approved exceptions are left out of this count.`;
}
