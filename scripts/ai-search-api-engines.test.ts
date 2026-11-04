// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-api-engines.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  apiEngineViewsEnabled,
  apiRunDay,
  apiRunsInScope,
  isCountedApiRun,
  loadApiRunCatalog,
  loadApiRunSnapshot,
  type ApiRunSummary,
} from "../lib/ai-search/api-runs.ts";
import {
  API_ENGINES,
  choiceLabel,
  ENGINE_GROUP_CHOICES,
  engineGroup,
  filterSnapshotByEngineGroup,
  fixedFactChecksTip,
  isApiEngine,
  isRotatingFactCheck,
  withApiSnapshots,
} from "../lib/ai-search/engine-group.ts";
import { defaultWindowBounds, defaultWindowRuns } from "../lib/ai-search/default-window.ts";
import { engineGroupRead, engineSwitchState, type ApiEngineLoad } from "../lib/ai-search/engine-group-read.ts";
import { sortExplorerRows } from "../lib/ai-search/explorer-filter.ts";
import type { HistoryReadClient } from "../lib/ai-search/history-queries.ts";
import { engineLabel, engineResultTallies, tallyCommercial } from "../lib/ai-search/run-metrics.ts";
import type { AiCallRow, AiCitationRow, AiCurrentRun, AiProbeRow, AiSearchRead, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const BATTERY = "8d6746f6-687a-4ea6-8bda-a92a49971d18";
const API_RUN = "8aa2eb28-4a66-4af2-b770-4a5f8349a74b";

const run = (id: string): AiCurrentRun => ({
  audit_run_id: id,
  run_state: "partial",
  collector_version: "v11",
  prompt_set_hash: "hash",
  expected_calls: 10,
  attempted_calls: 10,
  answered_calls: 8,
  error_calls: 2,
  started_at: "2026-11-03T06:00:00Z",
  completed_at: "2026-11-03T21:00:00Z",
  published_at: "2026-11-03T21:30:00Z",
  missing_calls: 2,
});

let next = 1;
function call(runId: string, engine: string, patch: Partial<AiCallRow> = {}): AiCallRow {
  const sim = next++;
  return {
    id: `c${sim}`,
    audit_run_id: runId,
    sim_id: sim,
    engine,
    model: null,
    category: "electrics",
    prompt: "What is the best electric guitar under $900?",
    prompt_key: "p01",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender/Squier",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-11-03T10:00:00Z",
    ...patch,
  };
}

function probeOf(row: AiCallRow, patch: Partial<AiProbeRow> = {}): AiProbeRow {
  return {
    audit_run_id: row.audit_run_id,
    sim_id: row.sim_id,
    prompt_key: row.prompt_key,
    prompt: row.prompt,
    engine: row.engine,
    model: null,
    call_status: row.call_status,
    material_hallucination: "none",
    hallucination_evidence: null,
    verified_claim: "Radius 9.5 in",
    verified_source_url: "https://www.fender.com/products/player-ii-stratocaster",
    verified_at: null,
    created_at: row.created_at,
    ...patch,
  };
}

function citeOf(row: AiCallRow): AiCitationRow {
  return {
    audit_run_id: row.audit_run_id,
    sim_id: row.sim_id,
    simulation_id: row.id,
    prompt_key: row.prompt_key,
    prompt_kind: row.prompt_kind,
    category: row.category,
    engine: row.engine,
    position: 1,
    url: "https://www.fender.com/",
    domain: "fender.com",
    title: null,
  };
}

/** Battery: 3 ChatGPT shopping calls (2 Fender, 1 competitor), 1 fixed and 1 rotating fact check on Gemini. */
function battery(): AiSearchSnapshot {
  const calls = [
    call(BATTERY, "chatgpt"),
    call(BATTERY, "chatgpt"),
    call(BATTERY, "chatgpt", { outcome: "competitor_win", primary_brand: "Gibson" }),
    call(BATTERY, "gemini", { prompt_kind: "probe", prompt_key: "p17", outcome: "not_scored" }),
    call(BATTERY, "gemini", { prompt_kind: "probe", prompt_key: "p35", outcome: "not_scored" }),
  ];
  return {
    run: run(BATTERY),
    calls,
    probes: [probeOf(calls[3], { probe_is_anchor: true }), probeOf(calls[4], { probe_asin: "B0TEST", probe_is_anchor: false })],
    citations: calls.map(citeOf),
  };
}

/** API run: ChatGPT API 1 Fender of 2, Claude API one fixed fact check, Crescent API failed every call. */
function apiSnapshot(): AiSearchSnapshot {
  const calls = [
    call(API_RUN, "openai_api"),
    call(API_RUN, "openai_api", { outcome: "competitor_win", primary_brand: "Gibson" }),
    call(API_RUN, "claude_api", { prompt_kind: "probe", prompt_key: "p17", outcome: "not_scored" }),
    call(API_RUN, "crescent_api", { call_status: "error", outcome: "error" }),
    call(API_RUN, "crescent_api", { call_status: "error", outcome: "error" }),
  ];
  return {
    run: { ...run(API_RUN), published_at: null, expected_calls: null },
    calls,
    probes: [probeOf(calls[2])],
    citations: calls.map(citeOf),
  };
}

test("API engine slugs are their own group, labeled as API", () => {
  assert.deepEqual(API_ENGINES, ["openai_api", "gemini_api", "claude_api", "grok_api", "crescent_api"]);
  assert.equal(engineLabel("openai_api"), "ChatGPT API");
  assert.equal(engineLabel("crescent_api"), "Crescent API");
  assert.equal(engineLabel("chatgpt"), "ChatGPT");
  assert.equal(engineGroup("Gemini_API"), "api");
  assert.equal(engineGroup("gemini"), "search");
  assert.equal(engineGroup(null), "search");
  assert.equal(isApiEngine("perplexity"), false);
});

test("the switch reads All, Without API, API only, with All first", () => {
  assert.deepEqual(ENGINE_GROUP_CHOICES.map(([, label]) => label), ["All", "Without API", "API only"]);
  assert.equal(ENGINE_GROUP_CHOICES[0][0], "all");
  assert.equal(choiceLabel("search"), "Without API");
});

test("Without API keeps the search engines and every fact check, rotating ones included", () => {
  const merged = withApiSnapshots(battery(), [apiSnapshot()]);
  const search = filterSnapshotByEngineGroup(merged, "search")!;
  assert.deepEqual([...new Set(search.calls.map((row) => row.engine))].sort(), ["chatgpt", "gemini"]);
  assert.equal(search.calls.length, 5);
  assert.equal(search.probes.length, 2);
  assert.equal(search.engineScope?.fixedFactChecksOnly, false);
  assert.equal(fixedFactChecksTip(search.engineScope, 2), null);
});

test("All puts API engines beside the search engines and keeps the fixed fact checks only", () => {
  const merged = withApiSnapshots(battery(), [apiSnapshot()]);
  const all = filterSnapshotByEngineGroup(merged, "all")!;
  assert.equal(all.calls.length, 9);
  assert.equal(all.calls.some((row) => row.prompt_key === "p35"), false);
  assert.deepEqual(all.probes.map((row) => row.prompt_key).sort(), ["p17", "p17"]);
  assert.equal(all.citations.some((row) => row.prompt_key === "p35"), false);
  assert.equal(all.engineScope?.fixedFactChecksOnly, true);
  assert.equal(all.engineScope?.rotatingLeftOut, 1);
  const tip = fixedFactChecksTip(all.engineScope, all.calls.filter((row) => row.prompt_kind === "probe").length)!;
  assert.match(tip, /fixed questions only/);
  assert.match(tip, /2 of 3 fact-check calls are counted/);
  // Run counts are recounted for the narrowed selection; expected is not known for a subset.
  assert.equal(all.run.attempted_calls, 9);
  assert.equal(all.run.error_calls, 2);
  assert.equal(all.run.expected_calls, null);
});

test("API only shows the API engines; a failed-every-call engine has no result (A-09)", () => {
  const merged = withApiSnapshots(battery(), [apiSnapshot()]);
  const api = filterSnapshotByEngineGroup(merged, "api")!;
  assert.ok(api.calls.every((row) => isApiEngine(row.engine)));
  assert.equal(api.engineScope?.fixedFactChecksOnly, true);
  const engines = engineResultTallies(api.calls).map((row) => row.key);
  assert.deepEqual(engines, ["openai_api"]);
  const chatgptApi = tallyCommercial(api.calls.filter((row) => row.engine === "openai_api"));
  assert.equal(chatgptApi.winPct, 50);
  const search = filterSnapshotByEngineGroup(merged, "search")!;
  const chatgpt = tallyCommercial(search.calls.filter((row) => row.engine === "chatgpt"));
  assert.equal(Number(chatgpt.winPct!.toFixed(1)), 66.7);
});

test("API only on a selection with no API call is empty, never a zero", () => {
  assert.equal(filterSnapshotByEngineGroup(battery(), "api"), null);
});

test("merging API runs prefixes ids, keeps citations paired, and skips non-API rows", () => {
  const api = apiSnapshot();
  api.calls.push(call(API_RUN, "chatgpt"));
  const merged = withApiSnapshots(battery(), [api]);
  const added = merged.calls.filter((row) => row.audit_run_id === API_RUN);
  assert.equal(added.length, 5);
  assert.ok(added.every((row) => row.id.startsWith(`${API_RUN}:`)));
  const ids = new Set(merged.calls.map((row) => row.id));
  assert.ok(merged.citations.every((row) => ids.has(row.simulation_id)));
  assert.equal(merged.run.audit_run_id, BATTERY);
  assert.equal(merged.storedCitationCount, 10);
});

test("rotating fact checks are the rotating slots and catalog products that are not anchors", () => {
  assert.equal(isRotatingFactCheck({ prompt_key: "p36" }), true);
  assert.equal(isRotatingFactCheck({ prompt_key: "p17", probe_asin: "B0X", probe_is_anchor: true }), false);
  assert.equal(isRotatingFactCheck({ prompt_key: "p40", probe_asin: "B0X", probe_is_anchor: null }), true);
  assert.equal(isRotatingFactCheck({ prompt_key: "p18" }), false);
});

const ready = (snapshot: AiSearchSnapshot): AiSearchRead => ({ phase: "ready", snapshot });

test("the switch is Not available* until the API views exist, and the figures are unchanged", () => {
  const displayed = ready(battery());
  const missing: ApiEngineLoad = { phase: "missing" };
  assert.deepEqual(engineSwitchState(missing, "api"), { kind: "unavailable", reason: "missing" });
  assert.equal(engineGroupRead(displayed, missing, "api"), displayed);
  const failed: ApiEngineLoad = { phase: "error", message: "timeout" };
  assert.deepEqual(engineSwitchState(failed, "all"), { kind: "unavailable", reason: "failed", message: "timeout" });
  assert.deepEqual(engineSwitchState({ phase: "ready", snapshots: [] }, "all"), { kind: "unavailable", reason: "none" });
});

test("All and API only wait for the API runs; Without API does not", () => {
  const displayed = ready(battery());
  const loading: ApiEngineLoad = { phase: "loading" };
  assert.deepEqual(engineGroupRead(displayed, loading, "all"), { phase: "loading" });
  assert.deepEqual(engineGroupRead(displayed, loading, "api"), { phase: "loading" });
  const search = engineGroupRead(displayed, loading, "search");
  assert.equal(search.phase, "ready");
});

test("a ready API load merges and narrows; a failed displayed read passes through", () => {
  const load: ApiEngineLoad = { phase: "ready", snapshots: [apiSnapshot()] };
  const all = engineGroupRead(ready(battery()), load, "all");
  assert.equal(all.phase === "ready" && all.snapshot.calls.length, 9);
  const api = engineGroupRead(ready(battery()), load, "api");
  assert.equal(api.phase === "ready" && api.snapshot.calls.every((row) => isApiEngine(row.engine)), true);
  const failed: AiSearchRead = { phase: "error", message: "x", selection: "failed" };
  assert.equal(engineGroupRead(failed, load, "all"), failed);
  const displayed = ready(battery());
  assert.equal(engineGroupRead(displayed, { phase: "ready", snapshots: [battery()] }, "api"), displayed);
});

const apiRun = (patch: Partial<ApiRunSummary>): ApiRunSummary => ({
  audit_run_id: API_RUN,
  run_kind: "ai_api_simulation",
  run_state: "partial",
  collector_version: null,
  prompt_set_hash: null,
  expected_calls: null,
  attempted_calls: 3400,
  answered_calls: 2900,
  error_calls: 500,
  is_published: false,
  published_at: null,
  started_at: "2026-11-03T10:00:00Z",
  completed_at: "2026-11-03T14:13:00Z",
  question_set_match: true,
  counted: true,
  ...patch,
});

test("run rule: completed or partial, matching question set, answered calls; no answer-rate floor", () => {
  assert.equal(isCountedApiRun(apiRun({})), true);
  assert.equal(isCountedApiRun(apiRun({ run_state: "completed" })), true);
  assert.equal(isCountedApiRun(apiRun({ run_state: "running" })), false);
  assert.equal(isCountedApiRun(apiRun({ run_state: "failed" })), false);
  assert.equal(isCountedApiRun(apiRun({ question_set_match: false })), false);
  assert.equal(isCountedApiRun(apiRun({ answered_calls: 0 })), false);
  // 1 answered of 3,400 still counts: Brian rejected a 50% minimum.
  assert.equal(isCountedApiRun(apiRun({ answered_calls: 1, error_calls: 3399 })), true);
  assert.equal(isCountedApiRun(apiRun({ counted: false })), false);
});

test("API runs follow the shared date pill's selection", () => {
  const runs = [
    apiRun({ audit_run_id: "a-oct28", started_at: "2026-10-27T23:00:00Z", completed_at: "2026-10-28T18:40:00Z" }),
    apiRun({ audit_run_id: "a-nov3" }),
    apiRun({ audit_run_id: "a-sep", completed_at: "2026-09-20T10:00:00Z" }),
    apiRun({ audit_run_id: "a-running", run_state: "running" }),
  ];
  assert.equal(apiRunDay(runs[0]), "2026-10-28");
  const month = apiRunsInScope(runs, { kind: "month" }, "2026-11-03").map((row) => row.audit_run_id);
  assert.deepEqual(month, ["a-oct28", "a-nov3"]);
  const range = apiRunsInScope(runs, { kind: "range", from: "2026-11-01", to: "2026-11-04" }, "2026-11-03");
  assert.deepEqual(range.map((row) => row.audit_run_id), ["a-nov3"]);
  assert.equal(apiRunsInScope(runs, { kind: "all" }, null).length, 3);
  assert.deepEqual(apiRunsInScope(runs, { kind: "run", runId: BATTERY }, "2026-11-03"), []);
  assert.deepEqual(apiRunsInScope(runs, { kind: "month" }, null), []);
});

test("Last 30 days for API runs is the battery's window: 30 UTC days ending on the published run's day", () => {
  const bounds = defaultWindowBounds("2026-11-03");
  assert.deepEqual(bounds, { from: "2026-10-05", to: "2026-11-03" });
  const runs = [
    apiRun({ audit_run_id: "a-before", completed_at: "2026-10-04T23:59:00Z" }),
    apiRun({ audit_run_id: "a-first-day", completed_at: "2026-10-05T00:00:00Z" }),
    apiRun({ audit_run_id: "a-last-day", completed_at: "2026-11-03T23:59:00Z" }),
    apiRun({ audit_run_id: "a-after", completed_at: "2026-11-04T00:10:00Z" }),
    // Unpublished, as every API run is: the API run rule decides, not the published-review rule.
    apiRun({ audit_run_id: "a-no-answers", completed_at: "2026-10-20T10:00:00Z", answered_calls: 0 }),
  ];
  const ids = apiRunsInScope(runs, { kind: "month" }, "2026-11-03").map((row) => row.audit_run_id);
  assert.deepEqual(ids, ["a-first-day", "a-last-day"]);
  const dated = defaultWindowRuns(runs, "2026-11-03");
  assert.deepEqual(
    [...dated.included, ...dated.excluded.map((item) => item.run)].map((row) => row.audit_run_id).sort(),
    ["a-first-day", "a-last-day", "a-no-answers"],
  );
});

type Row = Record<string, unknown>;

function fakeClient(tables: Record<string, Row[] | { message: string; code?: string }>): HistoryReadClient {
  return {
    from(view: string) {
      return {
        select() {
          const filters: Array<(row: Row) => boolean> = [];
          const query = {
            eq(column: string, value: string) {
              filters.push((row) => row[column] === value);
              return query;
            },
            gt(column: string, value: unknown) {
              filters.push((row) => (row[column] as number) > (value as number));
              return query;
            },
            gte(column: string, value: unknown) {
              filters.push((row) => (row[column] as number) >= (value as number));
              return query;
            },
            or() {
              return query;
            },
            order() {
              return query;
            },
            limit(count: number) {
              return Promise.resolve(result(count));
            },
            range(from: number, to: number) {
              return Promise.resolve(result(to - from + 1));
            },
            then(resolve: (value: unknown) => unknown) {
              return Promise.resolve(result(1000)).then(resolve);
            },
          };
          const result = (count: number) => {
            const table = tables[view];
            if (!Array.isArray(table)) return { data: null, error: table ?? { message: "missing", code: "PGRST205" } };
            return { data: table.filter((row) => filters.every((keep) => keep(row))).slice(0, count), error: null };
          };
          return query;
        },
      };
    },
  } as unknown as HistoryReadClient;
}

test("the API views are read only once the flag says the migration is applied", () => {
  assert.equal(apiEngineViewsEnabled(undefined, undefined), false);
  assert.equal(apiEngineViewsEnabled("0", {}), false);
  assert.equal(apiEngineViewsEnabled("1", undefined), true);
  assert.equal(apiEngineViewsEnabled(undefined, { __IFAI_AI_API_VIEWS__: true }), true);
  assert.equal(apiEngineViewsEnabled(undefined, { __IFAI_AI_API_VIEWS__: "true" }), false);
});

test("a missing API view reads as missing, not as an error or a zero", async () => {
  const client = fakeClient({ canvas_ai_api_runs: { message: "Could not find the table in the schema cache", code: "PGRST205" } });
  assert.deepEqual(await loadApiRunCatalog(client), { phase: "missing" });
  const other = fakeClient({ canvas_ai_api_runs: { message: "permission denied", code: "42501" } });
  assert.deepEqual(await loadApiRunCatalog(other), { phase: "error", message: "permission denied" });
});

test("an API run loads its own calls, fact checks, and citations", async () => {
  const snapshot = apiSnapshot();
  const client = fakeClient({
    canvas_ai_api_runs: [apiRun({})],
    canvas_ai_api_calls: [...snapshot.calls, call("someone-else", "grok_api")],
    canvas_ai_api_probes: snapshot.probes,
    canvas_ai_api_citations: snapshot.citations,
  });
  const catalog = await loadApiRunCatalog(client);
  assert.equal(catalog.phase === "ready" && catalog.runs.length, 1);
  const loaded = await loadApiRunSnapshot(client, apiRun({}));
  assert.equal(loaded.phase, "ready");
  if (loaded.phase !== "ready") return;
  assert.equal(loaded.snapshot.calls.length, 5);
  assert.equal(loaded.snapshot.probes.length, 1);
  assert.equal(loaded.snapshot.citations.length, 5);
  assert.equal(loaded.snapshot.run.audit_run_id, API_RUN);
});

test("Run Details lists the search engines before the API engines for the same question", () => {
  const rows = sortExplorerRows([call(API_RUN, "claude_api"), call(BATTERY, "perplexity"), call(API_RUN, "openai_api"), call(BATTERY, "chatgpt")]);
  assert.deepEqual(rows.map((row) => engineGroup(row.engine)), ["search", "search", "api", "api"]);
});

test("the migration only adds views and limits the public key to SELECT", () => {
  const sql = readFileSync("supabase/migrations/20261104160000_ai_search_api_engine_views.sql", "utf8");
  const body = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.doesNotMatch(body, /CREATE OR REPLACE/i);
  assert.doesNotMatch(body, /\b(DROP|TRUNCATE|INSERT INTO|UPDATE\s+\w|DELETE FROM|ALTER TABLE)\b/i);
  assert.match(body, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  assert.match(body, /GRANT SELECT ON TABLE public\.%I TO anon, authenticated/);
  assert.doesNotMatch(body, /GRANT (ALL|INSERT|UPDATE|DELETE)/i);
  for (const view of ["canvas_ai_api_runs", "canvas_ai_api_calls", "canvas_ai_api_probes", "canvas_ai_api_citations"]) {
    assert.match(body, new RegExp(`CREATE VIEW public\\.${view} WITH \\(security_invoker = false\\)`));
    assert.match(sql, new RegExp(`DROP VIEW IF EXISTS public\\.${view};`));
  }
  assert.match(sql, /Not applied anywhere/);
});
