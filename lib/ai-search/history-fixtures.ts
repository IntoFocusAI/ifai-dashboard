import { utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { storedRunSnapshot, storedRunSnapshots } from "@/lib/ai-search/stored-run-copy";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * `?ai-history=fixture` opens this copy of the stored runs.
 * The live AI Search tabs start on the last 30 days. The map stays on the published run.
 */

export function historyFixtureSnapshots(): AiSearchSnapshot[] {
  return storedRunSnapshots();
}

export function historyFixtureSnapshot(runId: string): AiSearchSnapshot | null {
  return storedRunSnapshot(runId);
}

export function historyFixtureSummaries(): HistoryRunSummary[] {
  return historyFixtureSnapshots().map((snapshot) => ({
    audit_run_id: snapshot.run.audit_run_id,
    run_kind: snapshot.run.run_kind ?? "ai_simulation",
    run_state: snapshot.run.run_state,
    collector_version: snapshot.run.collector_version,
    prompt_set_hash: snapshot.run.prompt_set_hash,
    expected_calls: snapshot.run.expected_calls,
    attempted_calls: snapshot.run.attempted_calls,
    answered_calls: snapshot.run.answered_calls,
    error_calls: snapshot.run.error_calls,
    is_published: snapshot.run.is_published ?? false,
    published_at: snapshot.run.published_at,
    started_at: snapshot.run.started_at,
    completed_at: snapshot.run.completed_at,
  }));
}

export function fixtureDay(runId: string): string | null {
  const snapshot = historyFixtureSnapshot(runId);
  return snapshot ? utcDay(snapshot.run.published_at ?? snapshot.run.completed_at) : null;
}
