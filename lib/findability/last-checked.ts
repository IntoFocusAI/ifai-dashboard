/**
 * Freshness for one official-page findability read (FDD X-12).
 * Newest stored check among rows that are not unchecked. Unchecked is not a check time.
 */

import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { findabilityOutcome, type FindabilityRow } from "@/lib/findability/outcomes";

export const LAST_CHECKED_UNAVAILABLE_LABEL = "Not available*";

export const LAST_CHECKED_UNAVAILABLE_TITLE = "Last checked";

export const LAST_CHECKED_UNAVAILABLE_DESC =
  "This official-page read has no stored check time.";

/**
 * Newest parseable latest_attempt_at among rows whose outcome is not unchecked.
 * Blank latest_state is unchecked. Null, blank, and unparseable times are ignored.
 */
export function newestCheckedAttemptAt(rows: readonly FindabilityRow[]): string | null {
  let newestMs: number | null = null;
  let newestIso: string | null = null;
  for (const row of rows) {
    if (findabilityOutcome(row) === "not_checked") continue;
    const raw = row.latest_attempt_at?.trim();
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) continue;
    if (newestMs == null || ms > newestMs) {
      newestMs = ms;
      newestIso = new Date(ms).toISOString();
    }
  }
  return newestIso;
}

/** Client lead sentence when a usable check time exists. Null when it does not. */
export function findabilityLastCheckedSentence(iso: string | null): string | null {
  const formatted = formatCheckedAt(iso);
  if (!formatted) return null;
  return `Last checked ${formatted}.`;
}
