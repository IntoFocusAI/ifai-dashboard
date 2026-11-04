import { citationMonthBounds } from "@/lib/ai-search/citation-aggregate";
import { compareRuns, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import type { HistoryMode } from "@/lib/ai-search/history-mode";
import {
  historyViewMissing,
  readRunPages,
  type HistoryReadClient,
  type HistoryReadOptions,
} from "@/lib/ai-search/history-queries";
import { PROBE_CATALOG_COLUMNS } from "@/lib/ai-search/probe-catalog";
import { historyReadLimit } from "@/lib/ai-search/read-limit";
import type { AiCallRow, AiCitationRow, AiProbeRow, AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * Brian Watson's API-engine runs, read from the add-only views in
 * supabase/migrations/20261104160000_ai_search_api_engine_views.sql.
 * Until those views are applied the reads come back missing, and the API engines stay absent.
 */

export const API_RUN_VIEW = "canvas_ai_api_runs";
export const API_CALL_VIEW = "canvas_ai_api_calls";
export const API_PROBE_VIEW = "canvas_ai_api_probes";
export const API_CITATION_VIEW = "canvas_ai_api_citations";

const API_RUN_COLUMNS =
  "audit_run_id,run_kind,run_state,collector_version,prompt_set_hash,expected_calls,attempted_calls,answered_calls,error_calls,is_published,published_at,started_at,completed_at,missing_calls,engines,repeats,questions_asked,questions_matched,question_set_match,counted";

const API_CALL_COLUMNS =
  "id,audit_run_id,sim_id,engine,model,category,prompt,prompt_key,prompt_kind,call_status,outcome,primary_brand,material_hallucination,hallucination_evidence,root_cause,remediation_patch,error_message,attempt_no,repeat_no,created_at,answer_text";

const API_PROBE_COLUMNS = `audit_run_id,sim_id,prompt_key,prompt,engine,model,call_status,material_hallucination,hallucination_evidence,verified_claim,verified_source_url,verified_at,created_at,answer_text,${PROBE_CATALOG_COLUMNS}`;

const API_CITATION_COLUMNS =
  "audit_run_id,sim_id,simulation_id,prompt_key,prompt_kind,category,engine,position,url,domain,title";

export type ApiRunSummary = HistoryRunSummary & {
  missing_calls?: number | null;
  engines?: string[] | null;
  repeats?: number | null;
  questions_asked?: number | null;
  questions_matched?: number | null;
  question_set_match?: boolean | null;
  counted?: boolean | null;
};

/**
 * The battery's run rule, as Brian Watson set it for the API job: finished as completed or
 * partial, the same question set, and answered calls. Not completed only, and no answer-rate floor.
 */
export function isCountedApiRun(run: ApiRunSummary): boolean {
  if (run.run_state !== "completed" && run.run_state !== "partial") return false;
  if (run.question_set_match !== true) return false;
  if ((run.answered_calls ?? 0) <= 0) return false;
  return run.counted !== false;
}

/** API runs are not published, so the run's day is when it finished. */
export function apiRunDay(run: Pick<HistoryRunSummary, "published_at" | "completed_at" | "started_at">): string | null {
  return utcDay(run.published_at ?? run.completed_at ?? run.started_at ?? null);
}

/**
 * Counted API runs dated inside the selection the shared date pill names. One chosen run is a
 * single battery run, so it has no API run beside it.
 */
export function apiRunsInScope(
  runs: readonly ApiRunSummary[],
  mode: HistoryMode,
  publishedDay: string | null,
): ApiRunSummary[] {
  if (mode.kind === "run" || mode.kind === "legacy") return [];
  let from: string | null = null;
  let to: string | null = null;
  if (mode.kind === "month") {
    const bounds = publishedDay ? citationMonthBounds(publishedDay) : null;
    if (!bounds) return [];
    ({ from, to } = bounds);
  } else if (mode.kind === "range") {
    from = mode.from;
    to = mode.to;
  }
  return runs
    .filter(isCountedApiRun)
    .filter((run) => {
      const day = apiRunDay(run);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    })
    .sort(compareRuns);
}

export type ApiCatalogResult =
  | { phase: "ready"; runs: ApiRunSummary[] }
  | { phase: "missing" }
  | { phase: "error"; message: string };

function messageOf(error: unknown): string {
  return error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
}

export async function loadApiRunCatalog(client: HistoryReadClient): Promise<ApiCatalogResult> {
  try {
    const result = await historyReadLimit(() =>
      client.from(API_RUN_VIEW).select(API_RUN_COLUMNS).order("completed_at", { ascending: true }).limit(1000),
    );
    if (result.error) {
      return historyViewMissing(result.error) ? { phase: "missing" } : { phase: "error", message: result.error.message };
    }
    return { phase: "ready", runs: (result.data ?? []) as ApiRunSummary[] };
  } catch (error) {
    return { phase: "error", message: messageOf(error) };
  }
}

export type ApiSnapshotResult =
  | { phase: "ready"; snapshot: AiSearchSnapshot }
  | { phase: "missing" }
  | { phase: "error"; message: string };

/** One counted API run's calls, fact checks, and citations, paged the same way as a history run. */
export async function loadApiRunSnapshot(
  client: HistoryReadClient,
  run: ApiRunSummary,
  options: HistoryReadOptions = {},
): Promise<ApiSnapshotResult> {
  const runId = run.audit_run_id;
  try {
    const [calls, probes, citations] = await Promise.all([
      readRunPages<AiCallRow>(client, API_CALL_VIEW, API_CALL_COLUMNS, runId, ["sim_id", "id"], options),
      readRunPages<AiProbeRow>(client, API_PROBE_VIEW, API_PROBE_COLUMNS, runId, ["sim_id"], options),
      readRunPages<AiCitationRow>(client, API_CITATION_VIEW, API_CITATION_COLUMNS, runId, ["sim_id", "position"], options),
    ]);
    for (const result of [calls, probes, citations]) {
      if (!result.error) continue;
      return historyViewMissing(result.error) ? { phase: "missing" } : { phase: "error", message: result.error.message };
    }
    const mine = <T extends { audit_run_id: string }>(rows: T[]) => rows.filter((row) => row.audit_run_id === runId);
    return {
      phase: "ready",
      snapshot: {
        run: {
          audit_run_id: runId,
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
          run_kind: run.run_kind ?? null,
        },
        calls: mine(calls.rows),
        probes: mine(probes.rows),
        citations: mine(citations.rows),
      },
    };
  } catch (error) {
    return { phase: "error", message: messageOf(error) };
  }
}
