import type { HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import { isReviewHistoryRun } from "@/lib/ai-search/review-runs";
import type { AiCallRow, AiCitationRow, AiCurrentRun, AiProbeRow, AiSearchSnapshot } from "@/lib/ai-search/types";

/** Columns on the live `canvas_ai_run_history` view. It has no missing_calls column. */
const CATALOG_COLUMNS =
  "audit_run_id,run_kind,run_state,collector_version,prompt_set_hash,expected_calls,attempted_calls,answered_calls,error_calls,is_published,published_at,started_at,completed_at";

const HISTORY_RUN_COLUMNS = `${CATALOG_COLUMNS},missing_calls`;

const HISTORY_CALL_COLUMNS =
  "id,audit_run_id,sim_id,engine,model,category,prompt,prompt_key,prompt_kind,call_status,outcome,primary_brand,material_hallucination,hallucination_evidence,root_cause,remediation_patch,error_message,attempt_no,repeat_no,created_at,answer_text";

const HISTORY_PROBE_COLUMNS =
  "audit_run_id,sim_id,prompt_key,prompt,engine,model,call_status,material_hallucination,hallucination_evidence,verified_claim,verified_source_url,verified_at,created_at,answer_text";

const HISTORY_CITATION_COLUMNS =
  "audit_run_id,sim_id,simulation_id,prompt_key,prompt_kind,category,engine,position,url,domain,title";

const PAGE = 1000;
/** A full run is about 2,000 calls and 8,000 citations. Past this cap the read fails instead of truncating. */
const RUN_MAX_PAGES = 50;

type DbError = { message: string; code?: string } | null;

type ReadResult = { data: unknown; error: DbError };

type ListQuery = PromiseLike<ReadResult> & {
  eq: (column: string, value: string) => ListQuery;
  order: (column: string, options?: { ascending?: boolean }) => ListQuery;
  range: (from: number, to: number) => PromiseLike<ReadResult>;
};

/** The slice of the browser client the history reads use. */
export type HistoryReadClient = {
  from: (view: string) => {
    select: (columns: string) => ListQuery;
  };
};

export type HistorySnapshotResult =
  | { phase: "ready"; snapshot: AiSearchSnapshot }
  | { phase: "unavailable"; message: string }
  | { phase: "error"; message: string };

const UNAVAILABLE =
  "Call-level history for this run is not available from the current published views. The history views are in the repository and have not been applied. No rate is shown as zero.";

export function historyViewMissing(error: DbError): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

async function readPages<T>(client: HistoryReadClient, view: string, columns: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 20; page += 1) {
    const from = page * PAGE;
    const { data, error } = await client.from(view).select(columns).order(orderBy, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

export async function loadHistoryCatalog(
  client: HistoryReadClient,
): Promise<{ phase: "ready"; runs: HistoryRunSummary[] } | { phase: "error"; message: string }> {
  try {
    const rows = await readPages<HistoryRunSummary>(client, "canvas_ai_run_history", CATALOG_COLUMNS, "completed_at");
    return { phase: "ready", runs: rows };
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    return { phase: "error", message };
  }
}

/**
 * Every row one run has in a history view. The server returns at most 1,000 rows
 * per request, so the read pages. The order columns must be unique within a run,
 * or offset pages can repeat some rows and skip others.
 */
export async function readRunPages<T>(
  client: HistoryReadClient,
  view: string,
  columns: string,
  runId: string,
  order: readonly string[],
): Promise<{ rows: T[]; error: DbError }> {
  const rows: T[] = [];
  for (let page = 0; page < RUN_MAX_PAGES; page += 1) {
    const from = page * PAGE;
    let query = client.from(view).select(columns).eq("audit_run_id", runId);
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) return { rows, error };
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, error: null };
  }
  return {
    rows,
    error: { message: `${view} has more than ${RUN_MAX_PAGES * PAGE} rows for this run, so the read stopped.` },
  };
}

function keepRun<T extends { audit_run_id: string }>(rows: T[], runId: string): T[] {
  return rows.filter((row) => row.audit_run_id === runId);
}

export async function loadHistorySnapshot(client: HistoryReadClient, runId: string): Promise<HistorySnapshotResult> {
  const runResult = await client.from("canvas_ai_history_runs").select(HISTORY_RUN_COLUMNS).eq("audit_run_id", runId);
  if (runResult.error) {
    return historyViewMissing(runResult.error)
      ? { phase: "unavailable", message: UNAVAILABLE }
      : { phase: "error", message: runResult.error.message };
  }
  const runs = (runResult.data ?? []) as Array<HistoryRunSummary & { missing_calls?: number | null }>;
  const run = runs.find((row) => row.audit_run_id === runId) ?? null;
  if (!run || !isReviewHistoryRun(run)) {
    return {
      phase: "unavailable",
      message: "This run is outside the review history. It is not mixed into the current figures.",
    };
  }

  try {
    // sim_id is unique within a run, and position is unique within a call's citations.
    const [calls, probes, citations] = await Promise.all([
      readRunPages<AiCallRow>(client, "canvas_ai_history_calls", HISTORY_CALL_COLUMNS, runId, ["sim_id", "id"]),
      readRunPages<AiProbeRow & { answer_text?: string | null }>(
        client,
        "canvas_ai_history_probes",
        HISTORY_PROBE_COLUMNS,
        runId,
        ["sim_id"],
      ),
      readRunPages<AiCitationRow>(client, "canvas_ai_history_citations", HISTORY_CITATION_COLUMNS, runId, [
        "sim_id",
        "position",
      ]),
    ]);
    for (const result of [calls, probes, citations]) {
      if (result.error) {
        return historyViewMissing(result.error)
          ? { phase: "unavailable", message: UNAVAILABLE }
          : { phase: "error", message: result.error.message };
      }
    }
    const callRows = keepRun(calls.rows, runId);
    const probeRows = keepRun(probes.rows, runId).map(
      (probe) => {
        const call = callRows.find((row) => row.sim_id === probe.sim_id);
        if (call && probe.answer_text !== undefined && call.answer_text === undefined) call.answer_text = probe.answer_text;
        return probe;
      },
    );
    const current: AiCurrentRun = {
      audit_run_id: run.audit_run_id,
      run_state: run.run_state ?? "partial",
      collector_version: run.collector_version,
      prompt_set_hash: run.prompt_set_hash,
      expected_calls: run.expected_calls,
      attempted_calls: run.attempted_calls,
      answered_calls: run.answered_calls,
      error_calls: run.error_calls,
      started_at: run.started_at ?? null,
      completed_at: run.completed_at,
      published_at: run.published_at,
      missing_calls: run.missing_calls ?? null,
      is_published: run.is_published === true,
      run_kind: run.run_kind ?? "ai_simulation",
    };
    return {
      phase: "ready",
      snapshot: {
        run: current,
        calls: callRows,
        probes: probeRows,
        citations: keepRun(citations.rows, runId),
      },
    };
  } catch (error) {
    return { phase: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
