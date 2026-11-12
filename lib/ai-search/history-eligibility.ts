import { activeClient, type ClientProfile } from "@/lib/client/active-client";

/**
 * Which AI Search runs may enter the client-safe history.
 * The same rules are repeated in each client's history view: Fender's in
 * supabase/migrations/20261014190000_ai_search_history_views.sql, Ledlenser's in
 * supabase/migrations/20261104170000_ledlenser_schema.sql.
 * A run summary is not enough for a win rate: missing calls stay missing.
 */

export const TRUSTED_COLLECTOR_VERSION = "v11";

/**
 * The collector a client's history view pins. Fender's view admits only v11. Ledlenser's view
 * has no collector pin (its collector is named ledlenser_ai_v1), so its runs pass on the other
 * rules alone.
 */
export function trustedCollectorVersion(schema: ClientProfile["schema"] = activeClient().schema): string | null {
  return schema === "public" ? TRUSTED_COLLECTOR_VERSION : null;
}

export type HistoryRunSummary = {
  audit_run_id: string;
  run_kind?: string | null;
  run_state: string | null;
  collector_version: string | null;
  prompt_set_hash: string | null;
  expected_calls: number | null;
  attempted_calls: number | null;
  answered_calls: number | null;
  error_calls: number | null;
  is_published: boolean | null;
  published_at: string | null;
  started_at?: string | null;
  completed_at: string | null;
};

/** Published completed or partial runs from the client's trusted collector that attempted the full recorded battery. */
export function isTrustworthyRun(run: HistoryRunSummary): boolean {
  if (run.run_kind != null && run.run_kind !== "ai_simulation") return false;
  if (run.is_published !== true) return false;
  if (run.run_state !== "completed" && run.run_state !== "partial") return false;
  if (!run.prompt_set_hash) return false;
  const collector = trustedCollectorVersion();
  if (collector != null && run.collector_version !== collector) return false;
  if (run.expected_calls == null || run.attempted_calls == null) return false;
  if (run.expected_calls < 1 || run.attempted_calls !== run.expected_calls) return false;
  if (!run.published_at) return false;
  return true;
}

export function utcDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function compareRuns(a: HistoryRunSummary, b: HistoryRunSummary): number {
  const at = a.published_at ?? a.completed_at ?? "";
  const bt = b.published_at ?? b.completed_at ?? "";
  return at.localeCompare(bt) || a.audit_run_id.localeCompare(b.audit_run_id);
}

/** The trustworthy run immediately before `anchorId`, when that run is in the list. */
export function previousTrustworthyRun(
  runs: readonly HistoryRunSummary[],
  anchorId: string | null,
): HistoryRunSummary | null {
  const trusted = runs.filter(isTrustworthyRun).sort(compareRuns);
  if (!anchorId) return trusted.length >= 2 ? trusted[trusted.length - 2] : null;
  const index = trusted.findIndex((run) => run.audit_run_id === anchorId);
  if (index > 0) return trusted[index - 1];
  if (index === 0) return null;
  return trusted.length >= 2 ? trusted[trusted.length - 2] : null;
}

export function runsOnDay(runs: readonly HistoryRunSummary[], day: string): HistoryRunSummary[] {
  return runs.filter((run) => utcDay(run.published_at ?? run.completed_at) === day).sort(compareRuns);
}
