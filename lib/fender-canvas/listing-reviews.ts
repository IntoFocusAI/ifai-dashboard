import { formatInt, pendingLabel } from "@/lib/fender-canvas/format";

/**
 * reviews_count is NOT NULL and defaults to 0. No job writes a confirmed count,
 * so 0 is unread, not a count of zero reviews. A positive stored count is shown.
 * The label does not assume how many listing rows exist.
 */
/**
 * True when at least one listing stores a review count. Until a job writes counts, the
 * Reviews column would read Pending data on every row, so it is not shown.
 */
export function anyListingReviewCount(rows: readonly { reviews_count?: unknown }[]): boolean {
  return rows.some((row) => listingReviewLabel(row.reviews_count) !== pendingLabel());
}

export function listingReviewLabel(count: unknown): string {
  const value =
    typeof count === "number"
      ? count
      : typeof count === "string" && count.trim() !== ""
        ? Number(count)
        : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return pendingLabel();
  return formatInt(value);
}
