import { utcDay } from "@/lib/ai-search/history-eligibility";
import { scoringMethodFor, type ScoringMethod } from "@/lib/ai-search/review-runs";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

/** History modes that add every stored review run in a window. */
export function isWindowHistoryKind(kind: string | null | undefined): boolean {
  return kind === "month" || kind === "range" || kind === "all";
}

export const MIXED_SCORING_TITLE = "Mixed scoring";

/** Tooltip on the lead figure it qualifies, never a line of its own. */
export const MIXED_SCORING_NOTE =
  "Lead rates and gaps add runs that named the leader in different ways.";

/** Distinct audit runs that contributed calls to the displayed snapshot. */
export function distinctCallRunIds(snapshot: AiSearchSnapshot): string[] {
  return [...new Set(snapshot.calls.map((call) => call.audit_run_id).filter(Boolean))].sort();
}

/** Scoring methods present among the calls, via scoringMethodFor. */
export function scoringMethodsInSnapshot(snapshot: AiSearchSnapshot): ScoringMethod[] {
  const methods = new Set<ScoringMethod>();
  for (const call of snapshot.calls) {
    const method = scoringMethodFor({ audit_run_id: call.audit_run_id });
    if (method) methods.add(method);
  }
  return [...methods].sort();
}

export function hasMixedScoringMethods(snapshot: AiSearchSnapshot): boolean {
  return scoringMethodsInSnapshot(snapshot).length > 1;
}

/** Inclusive day span from call timestamps when run metadata is not on the pool. */
export function callDaySpan(snapshot: AiSearchSnapshot): { from: string; to: string } | null {
  const days = snapshot.calls
    .map((call) => utcDay(call.created_at))
    .filter((day): day is string => day != null)
    .sort();
  if (days.length === 0) return null;
  return { from: days[0], to: days[days.length - 1] };
}
