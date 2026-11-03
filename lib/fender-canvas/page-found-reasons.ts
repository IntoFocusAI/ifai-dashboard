/**
 * Why a checked SKU has no stored fender.com page. The spec read's own stored reason
 * leads; the listing's Findability result follows, matched by ASIN on the shared
 * Findability read (canvas_spec_findability). A SKU Findability has no row for, and no
 * stored reason, reads "Reason not recorded".
 */

import { REASON_NOT_RECORDED, type PageFoundRow } from "@/lib/fender-canvas/page-found-evidence";
import { OUTCOME_DEFINITION, bucketLabel, type FindabilityRead } from "@/lib/findability/copy";
import {
  FINDABILITY_OUTCOMES,
  findabilityOutcome,
  type FindabilityBucket,
  type FindabilityRow,
} from "@/lib/findability/outcomes";

export const FINDABILITY_SOURCE = "Findability";
export const FINDABILITY_LOADING = "Loading";
export const FINDABILITY_UNAVAILABLE = "Not available*";
export const FINDABILITY_UNAVAILABLE_TIP =
  "The Findability read did not load, so this listing's official-page result is not shown. Reload to read it again.";

export const REASON_COLUMN_TOOLTIP = {
  title: "fender.com page or reason",
  description:
    "Found rows link to the fender.com page this spec read stored. Not-found rows show the reason this read stored, when it stored one, then the listing's result on the Findability tab. Findability is a separate official-page check run at a different time, so its result can differ from this read.",
} as const;

export type FindabilityResult =
  | { kind: "outcome"; bucket: FindabilityBucket; label: string; definition: string | null }
  | { kind: "no_row" }
  | { kind: "loading" }
  | { kind: "unavailable" };

export type NotFoundReason = {
  stored: string | null;
  findability: FindabilityResult;
  /** The first reason the cell shows. The reason filter groups on it. */
  group: string;
};

export type ReasonGroup = { key: string; count: number };

export function findabilityIndex(read: FindabilityRead): Map<string, FindabilityRow> | null {
  if (read.phase !== "ready") return null;
  return new Map(read.rows.map((row) => [row.asin, row]));
}

export function findabilityResult(
  asin: string,
  read: FindabilityRead,
  index: ReadonlyMap<string, FindabilityRow> | null,
): FindabilityResult {
  if (read.phase === "loading") return { kind: "loading" };
  if (read.phase === "error") return { kind: "unavailable" };
  const row = index?.get(asin);
  if (!row) return { kind: "no_row" };
  const bucket = findabilityOutcome(row);
  return {
    kind: "outcome",
    bucket,
    label: bucketLabel(bucket),
    definition: bucket === "other" ? null : OUTCOME_DEFINITION[bucket],
  };
}

export function findabilityResultLabel(result: FindabilityResult): string {
  if (result.kind === "outcome") return result.label;
  if (result.kind === "loading") return FINDABILITY_LOADING;
  if (result.kind === "unavailable") return FINDABILITY_UNAVAILABLE;
  return REASON_NOT_RECORDED;
}

export function notFoundReason(
  row: Pick<PageFoundRow, "asin" | "storedReason">,
  read: FindabilityRead,
  index: ReadonlyMap<string, FindabilityRow> | null,
): NotFoundReason {
  const findability = findabilityResult(row.asin, read, index);
  return {
    stored: row.storedReason,
    findability,
    group: row.storedReason ?? findabilityResultLabel(findability),
  };
}

/** Every not-found row's reason, keyed by ASIN. Found rows have none. */
export function notFoundReasons(
  rows: readonly PageFoundRow[],
  read: FindabilityRead,
): Map<string, NotFoundReason> {
  const index = findabilityIndex(read);
  const out = new Map<string, NotFoundReason>();
  for (const row of rows) {
    if (!row.found) out.set(row.asin, notFoundReason(row, read, index));
  }
  return out;
}

const RESULT_ORDER: string[] = [
  ...FINDABILITY_OUTCOMES.map((outcome) => bucketLabel(outcome)),
  bucketLabel("other"),
  REASON_NOT_RECORDED,
  FINDABILITY_UNAVAILABLE,
  FINDABILITY_LOADING,
];

function groupRank(reason: NotFoundReason): number {
  if (reason.stored) return -1;
  const rank = RESULT_ORDER.indexOf(reason.group);
  return rank < 0 ? RESULT_ORDER.length : rank;
}

/**
 * The not-found rows grouped by the first reason each one shows. Stored reasons lead,
 * then the Findability outcomes in that tab's order. The counts add up to the rows given.
 */
export function reasonGroups(reasons: Iterable<NotFoundReason>): ReasonGroup[] {
  const counts = new Map<string, { count: number; rank: number }>();
  for (const reason of reasons) {
    const entry = counts.get(reason.group) ?? { count: 0, rank: groupRank(reason) };
    entry.count += 1;
    counts.set(reason.group, entry);
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => x.rank - y.rank || a.localeCompare(b))
    .map(([key, { count }]) => ({ key, count }));
}
