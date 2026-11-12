import type { HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import {
  isCatalogProbe,
  PROBE_CATALOG_COLUMNS,
  PROBE_COVERAGE_COLUMNS,
  PROBE_COVERAGE_VIEW,
} from "@/lib/ai-search/probe-catalog";
import { historyReadLimit, type ReadLimit } from "@/lib/ai-search/read-limit";
import { isReviewHistoryRun } from "@/lib/ai-search/review-runs";
import type {
  AiCallRow,
  AiCitationRow,
  AiCurrentRun,
  AiProbeCoverageRow,
  AiProbeRow,
  AiSearchSnapshot,
} from "@/lib/ai-search/types";

/** Columns on the live `canvas_ai_run_history` view. It has no missing_calls column. */
const CATALOG_COLUMNS =
  "audit_run_id,run_kind,run_state,collector_version,prompt_set_hash,expected_calls,attempted_calls,answered_calls,error_calls,is_published,published_at,started_at,completed_at";

const HISTORY_RUN_COLUMNS = `${CATALOG_COLUMNS},missing_calls`;

const HISTORY_CALL_COLUMNS =
  "id,audit_run_id,sim_id,engine,model,category,prompt,prompt_key,prompt_kind,call_status,outcome,primary_brand,material_hallucination,hallucination_evidence,root_cause,remediation_patch,error_message,attempt_no,repeat_no,created_at,answer_text";

const HISTORY_PROBE_COLUMNS = `audit_run_id,sim_id,prompt_key,prompt,engine,model,call_status,material_hallucination,hallucination_evidence,verified_claim,verified_source_url,verified_at,created_at,answer_text,${PROBE_CATALOG_COLUMNS}`;

const HISTORY_CITATION_COLUMNS =
  "audit_run_id,sim_id,simulation_id,prompt_key,prompt_kind,category,engine,position,url,domain,title";

/**
 * Same columns and rows as canvas_ai_history_citations. Its join also matches on audit_run_id,
 * so the run filter narrows both sides instead of reading every history run's calls.
 */
export const HISTORY_CITATION_VIEW = "canvas_ai_history_citations_by_run";

const PAGE = 1000;
/** A full run is about 2,000 calls and 8,000 citations. Past this cap the read fails instead of truncating. */
const RUN_MAX_PAGES = 50;

type DbError = { message: string; code?: string } | null;

type ReadResult = { data: unknown; error: DbError };

type ListQuery = PromiseLike<ReadResult> & {
  eq: (column: string, value: string) => ListQuery;
  gte: (column: string, value: unknown) => ListQuery;
  gt: (column: string, value: unknown) => ListQuery;
  or: (filters: string) => ListQuery;
  order: (column: string, options?: { ascending?: boolean }) => ListQuery;
  limit: (count: number) => PromiseLike<ReadResult>;
  range: (from: number, to: number) => PromiseLike<ReadResult>;
};

/** A key that is unique within one run: one column, or a column and its tiebreaker. */
export type RunKey = readonly [string] | readonly [string, string];

export type HistoryReadOptions = {
  /** Defaults to the shared browser limit of four reads at once. */
  limit?: ReadLimit;
  /** Stops queuing pages once the caller no longer needs the run. */
  signal?: AbortSignal;
  /** False leaves each call's answer text on the server, for a reader that shows none. */
  withAnswers?: boolean;
  /** False skips the run's cited-URL rows, for a reader that shows none. */
  withCitations?: boolean;
};

export function withoutAnswerText(columns: string): string {
  return columns
    .split(",")
    .filter((column) => column !== "answer_text")
    .join(",");
}

const STOPPED: DbError = { message: "The read was stopped." };

function filterValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Rows after `last` in key order. Pages never skip ahead by offset, so each page reads only what it returns. */
function afterKey(query: ListQuery, key: RunKey, last: Record<string, unknown>): ListQuery {
  const [first, second] = key;
  if (second === undefined) return query.gt(first, last[first]);
  return query
    .gte(first, last[first])
    .or(`${first}.gt.${filterValue(last[first])},${second}.gt.${filterValue(last[second])}`);
}

/** The slice of the browser client the history reads use. */
export type HistoryReadClient = {
  from: (view: string) => {
    select: (columns: string) => ListQuery;
  };
  /** The browser and server clients have it; a test double without it reads by pages. */
  rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<ReadResult>;
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
  limit: ReadLimit = historyReadLimit,
): Promise<{ phase: "ready"; runs: HistoryRunSummary[] } | { phase: "error"; message: string }> {
  try {
    const rows = await limit(() =>
      readPages<HistoryRunSummary>(client, "canvas_ai_run_history", CATALOG_COLUMNS, "completed_at"),
    );
    return { phase: "ready", runs: rows };
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    return { phase: "error", message };
  }
}

/**
 * Every row one run has in a history view. The server returns at most 1,000 rows
 * per request, so the read pages by key: each page asks for the rows after the last
 * one seen. The key must be unique within a run, or a page boundary inside a tie
 * would skip rows. `orFilter` (PostgREST `or` syntax) narrows every page on the server.
 */
export async function readRunPages<T>(
  client: HistoryReadClient,
  view: string,
  columns: string,
  runId: string,
  key: RunKey,
  options: HistoryReadOptions = {},
  orFilter?: string,
): Promise<{ rows: T[]; error: DbError }> {
  const limit = options.limit ?? historyReadLimit;
  const rows: T[] = [];
  let last: Record<string, unknown> | null = null;
  for (let page = 0; page < RUN_MAX_PAGES; page += 1) {
    const after = last;
    const result = await limit<ReadResult>(() => {
      if (options.signal?.aborted) return Promise.resolve({ data: null, error: STOPPED });
      let query = client.from(view).select(columns).eq("audit_run_id", runId);
      if (orFilter) query = query.or(orFilter);
      if (after) query = afterKey(query, key, after);
      for (const column of key) query = query.order(column, { ascending: true });
      return query.limit(PAGE);
    });
    if (result.error) return { rows, error: result.error };
    const batch = (result.data ?? []) as Array<T & Record<string, unknown>>;
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, error: null };
    last = batch[batch.length - 1];
  }
  return {
    rows,
    error: { message: `${view} has more than ${RUN_MAX_PAGES * PAGE} rows for this run, so the read stopped.` },
  };
}

function keepRun<T extends { audit_run_id: string }>(rows: T[], runId: string): T[] {
  return rows.filter((row) => row.audit_run_id === runId);
}

type RunRow = HistoryRunSummary & { missing_calls?: number | null };

/** One run's rows as read, before they are joined into a snapshot. */
type RunRows = {
  runs: RunRow[];
  calls: AiCallRow[];
  probes: Array<AiProbeRow & { answer_text?: string | null }>;
  citations: AiCitationRow[];
};

type RunRead = { rows: RunRows } | { failed: Exclude<HistorySnapshotResult, { phase: "ready" }> };

const OUTSIDE_REVIEW: RunRead = {
  failed: { phase: "unavailable", message: "This run is outside the review history. It is not mixed into the current figures." },
};

function failedRead(error: NonNullable<DbError>): RunRead {
  return {
    failed: historyViewMissing(error) ? { phase: "unavailable", message: UNAVAILABLE } : { phase: "error", message: error.message },
  };
}

function reviewRun(runs: readonly RunRow[], runId: string): RunRow | null {
  const run = runs.find((row) => row.audit_run_id === runId) ?? null;
  return run && isReviewHistoryRun(run) ? run : null;
}

/**
 * The database function that returns one run's rows from the history views in one request (supabase/migrations/
 * 20261112230000_ai_history_run_rows.sql): the same columns and order as the page reads, without
 * answer text. Only a reader that asks for no answers and every citation uses it.
 */
export const RUN_ROWS_FUNCTION = "canvas_ai_history_run_rows";

/** Clients whose schema has no run-rows function (Ledlenser, or before it is applied). */
const withoutRunRowsFunction = new WeakSet<object>();

function functionMissing(error: NonNullable<DbError>): boolean {
  return error.code === "PGRST202" || error.code === "42883" || error.message.toLowerCase().includes("could not find the function");
}

/** The run in one request, or null to read it by pages: no function, a failed call, or rows not in its shape. */
async function readRunAtOnce(client: HistoryReadClient, runId: string, options: HistoryReadOptions): Promise<RunRead | null> {
  const rpc = client.rpc;
  if (!rpc || options.withAnswers !== false || options.withCitations === false) return null;
  if (withoutRunRowsFunction.has(client)) return null;
  const limit = options.limit ?? historyReadLimit;
  const result = await limit<ReadResult>(() =>
    options.signal?.aborted ? Promise.resolve({ data: null, error: STOPPED }) : rpc.call(client, RUN_ROWS_FUNCTION, { p_run_id: runId }),
  );
  if (result.error) {
    if (functionMissing(result.error)) withoutRunRowsFunction.add(client);
    return null;
  }
  const data = result.data as Partial<RunRows> | null;
  if (!data || ![data.runs, data.calls, data.probes, data.citations].every(Array.isArray)) return null;
  const rows = data as RunRows;
  return reviewRun(rows.runs, runId) ? { rows } : OUTSIDE_REVIEW;
}

/** The run's row, then its calls, probes, and citations, each by pages of at most 1,000 rows. */
async function readRunByPages(client: HistoryReadClient, runId: string, options: HistoryReadOptions): Promise<RunRead> {
  const limit = options.limit ?? historyReadLimit;
  const runResult = await limit<ReadResult>(() =>
    options.signal?.aborted
      ? Promise.resolve({ data: null, error: STOPPED })
      : client.from("canvas_ai_history_runs").select(HISTORY_RUN_COLUMNS).eq("audit_run_id", runId),
  );
  if (runResult.error) return failedRead(runResult.error);
  const runs = (runResult.data ?? []) as RunRow[];
  if (!reviewRun(runs, runId)) return OUTSIDE_REVIEW;

  // sim_id is unique within a run, and position is unique within a call's citations.
  const answers = options.withAnswers !== false;
  const callColumns = answers ? HISTORY_CALL_COLUMNS : withoutAnswerText(HISTORY_CALL_COLUMNS);
  const probeColumns = answers ? HISTORY_PROBE_COLUMNS : withoutAnswerText(HISTORY_PROBE_COLUMNS);
  const [calls, probes, citations] = await Promise.all([
    readRunPages<AiCallRow>(client, "canvas_ai_history_calls", callColumns, runId, ["sim_id", "id"], options),
    readRunPages<AiProbeRow & { answer_text?: string | null }>(
      client,
      "canvas_ai_history_probes",
      probeColumns,
      runId,
      ["sim_id"],
      options,
    ),
    options.withCitations === false
      ? Promise.resolve({ rows: [] as AiCitationRow[], error: null })
      : readRunPages<AiCitationRow>(
          client,
          HISTORY_CITATION_VIEW,
          HISTORY_CITATION_COLUMNS,
          runId,
          ["sim_id", "position"],
          options,
        ),
  ]);
  for (const result of [calls, probes, citations]) {
    if (result.error) return failedRead(result.error);
  }
  return { rows: { runs, calls: calls.rows, probes: probes.rows, citations: citations.rows } };
}

export async function loadHistorySnapshot(
  client: HistoryReadClient,
  runId: string,
  options: HistoryReadOptions = {},
): Promise<HistorySnapshotResult> {
  try {
    const read = (await readRunAtOnce(client, runId, options)) ?? (await readRunByPages(client, runId, options));
    if ("failed" in read) return read.failed;
    return { phase: "ready", snapshot: await snapshotFromRows(client, runId, read.rows, options) };
  } catch (error) {
    return { phase: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/** One run's rows joined into the snapshot every AI figure reads. Rows from another run are dropped. */
async function snapshotFromRows(
  client: HistoryReadClient,
  runId: string,
  rows: RunRows,
  options: HistoryReadOptions,
): Promise<AiSearchSnapshot> {
  const run = reviewRun(rows.runs, runId) as RunRow;
  const callRows = keepRun(rows.calls, runId);
  const probeRows = keepRun(rows.probes, runId).map((probe) => {
    const call = callRows.find((row) => row.sim_id === probe.sim_id);
    if (call && probe.answer_text !== undefined && call.answer_text === undefined) call.answer_text = probe.answer_text;
    return probe;
  });
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
  const snapshot: AiSearchSnapshot = {
    run: current,
    calls: callRows,
    probes: probeRows,
    citations: keepRun(rows.citations, runId),
  };
  if (probeRows.some(isCatalogProbe)) snapshot.probeCoverage = await readProbeCoverage(client, runId, options);
  return snapshot;
}

/** One run's catalog coverage rows. A failed read is null, never an empty catalog. */
async function readProbeCoverage(
  client: HistoryReadClient,
  runId: string,
  options: HistoryReadOptions,
): Promise<AiProbeCoverageRow[] | null> {
  const limit = options.limit ?? historyReadLimit;
  const result = await limit<ReadResult>(() =>
    client.from(PROBE_COVERAGE_VIEW).select(PROBE_COVERAGE_COLUMNS).eq("audit_run_id", runId),
  );
  if (result.error) return null;
  return keepRun((result.data ?? []) as AiProbeCoverageRow[], runId);
}
