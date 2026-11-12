import { defaultWindowRuns, runDay } from "@/lib/ai-search/default-window";
import { API_REPEAT_CAP, capApiRepeats, fixedQuestionCount } from "@/lib/ai-search/engine-group";
import { compareRuns, utcDay, type HistoryRunSummary } from "@/lib/ai-search/history-eligibility";
import type { HistoryMode } from "@/lib/ai-search/history-mode";
import {
  historyViewMissing,
  readRunPages,
  type HistoryReadClient,
  type HistoryReadOptions,
} from "@/lib/ai-search/history-queries";
import { PROBE_CATALOG_COLUMNS } from "@/lib/ai-search/probe-catalog";
import { apiReadLimit } from "@/lib/ai-search/read-limit";
import type { AiCallRow, AiCitationRow, AiProbeRow, AiSearchSnapshot } from "@/lib/ai-search/types";

/**
 * Brian Watson's API-engine runs, read from the add-only views in
 * supabase/migrations/20261104160000_ai_search_api_engine_views.sql.
 */

/**
 * The dashboard reads the API views by default. NEXT_PUBLIC_AI_API_ENGINE_VIEWS "0" turns the reads
 * off without a code change. Browser tests set `__IFAI_AI_API_VIEWS__` to force either way.
 * The anon key cannot list the schema, so a missing view is only found by reading it, and that
 * 404 is logged by the browser.
 */
export function apiEngineViewsEnabled(
  flag: string | undefined = process.env.NEXT_PUBLIC_AI_API_ENGINE_VIEWS,
  scope: unknown = typeof window === "undefined" ? undefined : window,
): boolean {
  const forced = (scope as { __IFAI_AI_API_VIEWS__?: unknown } | undefined)?.__IFAI_AI_API_VIEWS__;
  if (typeof forced === "boolean") return forced;
  // Every client has the API-engine views in its own schema (Ledlenser: 20261111222737), and the
  // canvas client reads that schema, so the switch works the same for every brand.
  return flag !== "0";
}

export const API_RUN_VIEW = "canvas_ai_api_runs";
export const API_CALL_VIEW = "canvas_ai_api_calls";
export const API_PROBE_VIEW = "canvas_ai_api_probes";
export const API_CITATION_VIEW = "canvas_ai_api_citations";

const API_RUN_COLUMNS =
  "audit_run_id,run_kind,run_state,collector_version,prompt_set_hash,expected_calls,attempted_calls,answered_calls,error_calls,is_published,published_at,started_at,completed_at,missing_calls,engines,repeats,questions_asked,questions_matched,question_set_match,counted";

const API_CALL_COLUMNS =
  "id,audit_run_id,sim_id,engine,model,category,prompt,prompt_key,prompt_kind,call_status,outcome,primary_brand,material_hallucination,hallucination_evidence,root_cause,remediation_patch,error_message,attempt_no,repeat_no,created_at,answer_text";

const API_PROBE_COLUMNS = `audit_run_id,sim_id,prompt_key,prompt,engine,model,call_status,material_hallucination,hallucination_evidence,verified_claim,verified_source_url,verified_at,created_at,answer_text,${PROBE_CATALOG_COLUMNS}`;

/** Repeats past the cap are left on the server; capApiRepeats still applies the same rule to what arrives. */
const API_REPEAT_FILTER = `repeat_no.is.null,repeat_no.lte.${API_REPEAT_CAP}`;

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
 * Counted API runs dated inside the selection the shared date pill names. Last 30 days is the
 * battery's window: defaultWindowRuns keeps the runs dated in the 30 days ending on `windowEnd`, the
 * published run's day. API runs are never published, so the API run rule, not the published-review
 * rule, decides which of those count. One chosen run gets the counted API run nearest its day.
 */
export function apiRunsInScope(
  runs: readonly ApiRunSummary[],
  mode: HistoryMode,
  windowEnd: string | null,
  selectedDay: string | null = null,
): ApiRunSummary[] {
  if (mode.kind === "legacy") return [];
  if (mode.kind === "run") {
    const nearest = nearestApiRun(runs, selectedDay);
    return nearest ? [nearest] : [];
  }
  if (mode.kind === "month") {
    const { included, excluded } = defaultWindowRuns(runs, windowEnd);
    const dated = [...included, ...excluded.map((item) => item.run)] as ApiRunSummary[];
    return dated.filter(isCountedApiRun).sort(compareRuns);
  }
  const from = mode.kind === "range" ? mode.from : null;
  const to = mode.kind === "range" ? mode.to : null;
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

function dayNumber(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / 86_400_000;
}

/** Whole UTC days between two YYYY-MM-DD days, either order. */
export function daysApart(a: string, b: string): number {
  return Math.abs(dayNumber(a) - dayNumber(b));
}

/**
 * The counted API run beside one battery run: the same day, else the nearest day. The API job
 * runs on its own schedule. A tie between a day before and a day after goes to the later run.
 */
export function nearestApiRun(runs: readonly ApiRunSummary[], day: string | null): ApiRunSummary | null {
  if (!day) return null;
  let best: { run: ApiRunSummary; apart: number } | null = null;
  for (const run of [...runs].filter(isCountedApiRun).sort(compareRuns)) {
    const runDay = apiRunDay(run);
    if (!runDay) continue;
    const apart = daysApart(runDay, day);
    if (!best || apart <= best.apart) best = { run, apart };
  }
  return best?.run ?? null;
}

/** A battery run's day and its fixed-question count, the floor an API run beside it must meet. */
export type BatteryQuestions = { day: string; fixedQuestions: number };

export function batteryQuestions(battery: readonly Pick<AiSearchSnapshot, "run" | "calls" | "probes">[]): BatteryQuestions[] {
  return battery.flatMap((snapshot) => {
    const day = runDay(snapshot.run);
    return day ? [{ day, fixedQuestions: fixedQuestionCount(snapshot) }] : [];
  });
}

/** The battery run nearest a day. A tie between a day before and a day after goes to the later run. */
export function nearestBatteryDay<T extends { day: string }>(battery: readonly T[], day: string): T | null {
  let best: T | null = null;
  for (const item of [...battery].sort((a, b) => a.day.localeCompare(b.day))) {
    if (!best || daysApart(item.day, day) <= daysApart(best.day, day)) best = item;
  }
  return best;
}

/**
 * The API runs that asked the battery's fixed questions: each run's questions_matched covers the
 * fixed questions of the battery run nearest its day. A one-question smoke test is left out.
 */
export function apiRunsCoveringBattery(runs: readonly ApiRunSummary[], battery: readonly BatteryQuestions[]): ApiRunSummary[] {
  return runs.filter((run) => {
    const day = apiRunDay(run);
    const paired = day ? nearestBatteryDay(battery, day) : null;
    return paired != null && (run.questions_matched ?? 0) >= Math.max(1, paired.fixedQuestions);
  });
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
    const result = await apiReadLimit(() =>
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

/**
 * One counted API run's calls, fact checks, and citations, paged the same way as a history run,
 * capped at repeats 1 to 3 of each question per engine so every reader counts the same calls.
 */
export async function loadApiRunSnapshot(
  client: HistoryReadClient,
  run: ApiRunSummary,
  options: HistoryReadOptions = {},
): Promise<ApiSnapshotResult> {
  const runId = run.audit_run_id;
  const read = { ...options, limit: options.limit ?? apiReadLimit };
  try {
    const [calls, probes, citations] = await Promise.all([
      readRunPages<AiCallRow>(client, API_CALL_VIEW, API_CALL_COLUMNS, runId, ["sim_id", "id"], read, API_REPEAT_FILTER),
      readRunPages<AiProbeRow>(client, API_PROBE_VIEW, API_PROBE_COLUMNS, runId, ["sim_id"], read),
      readRunPages<AiCitationRow>(client, API_CITATION_VIEW, API_CITATION_COLUMNS, runId, ["sim_id", "position"], read),
    ]);
    for (const result of [calls, probes, citations]) {
      if (!result.error) continue;
      return historyViewMissing(result.error) ? { phase: "missing" } : { phase: "error", message: result.error.message };
    }
    const mine = <T extends { audit_run_id: string }>(rows: T[]) => rows.filter((row) => row.audit_run_id === runId);
    const snapshot: AiSearchSnapshot = {
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
    };
    return { phase: "ready", snapshot: capApiRepeats(snapshot, API_REPEAT_CAP, run.repeats) };
  } catch (error) {
    return { phase: "error", message: messageOf(error) };
  }
}
