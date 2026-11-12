// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/action-items-export.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { engineGroupRead } from "../lib/ai-search/engine-group-read.ts";
import { aiSearchStale } from "../lib/ai-search/stale.ts";
import { TRUSTED_COLLECTOR_VERSION, type HistoryRunSummary } from "../lib/ai-search/history-eligibility.ts";
import type { AiCallRow, AiCitationRow, AiSearchRead, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import { actionItemsExportSource, loadActionItemsPlan, type ActionItemsReads } from "../lib/export/action-items-export.ts";
import { promptRows, PROMPTS_HEADER } from "../lib/export/prompts-export.ts";
import { shownCsv } from "../lib/export/shown.ts";
import { EXPORT_TABLE_IDS, isExportTable } from "../lib/export/tables.ts";
import { BRAND_FOCUS } from "../lib/fender-canvas/roadmap-focus.ts";
import {
  assembleRoadmapPlan,
  FIX_LIST_HEADER,
  fixListCells,
  focusWindowsReady,
  priorRunIds,
  sourceRunsRead,
} from "../lib/fender-canvas/roadmap-plan-read.ts";
import { focusWindowRuns } from "../lib/fender-canvas/roadmap-window.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");

const DAYS: Record<string, string> = { r1: "2026-10-20", r2: "2026-10-27", r3: "2026-11-03" };

function summary(id: string): HistoryRunSummary {
  return {
    audit_run_id: id,
    run_kind: "ai_simulation",
    run_state: "completed",
    collector_version: TRUSTED_COLLECTOR_VERSION,
    prompt_set_hash: "hash",
    expected_calls: 10,
    attempted_calls: 10,
    answered_calls: 10,
    error_calls: 0,
    is_published: true,
    published_at: `${DAYS[id]}T12:00:00Z`,
    completed_at: `${DAYS[id]}T11:00:00Z`,
  };
}

function call(runId: string, i: number): AiCallRow {
  return {
    id: `${runId}-c${i}`,
    audit_run_id: runId,
    sim_id: i,
    engine: "chatgpt",
    model: null,
    category: i % 2 ? "acoustics" : "electric",
    prompt: `Which guitar should I buy ${i}?`,
    prompt_key: `q${i}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: i < 4 ? "fender_win" : "competitor_win",
    primary_brand: i < 4 ? "Fender" : "Gibson",
    material_hallucination: null,
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: null,
  };
}

/** Ten shopping answers; `cited` of them cite guitarworld.com, the rest a shop. */
function snapshot(id: string, cited: number): AiSearchSnapshot {
  const calls = Array.from({ length: 10 }, (_, i) => call(id, i + 1));
  const citations: AiCitationRow[] = calls.map((c, i) => {
    const url = i < cited ? `https://www.guitarworld.com/guide-${i % 3}` : `https://example-shop.test/p${i}`;
    return {
      audit_run_id: id,
      sim_id: c.sim_id,
      simulation_id: c.id,
      prompt_key: c.prompt_key,
      prompt_kind: "commercial",
      category: c.category,
      engine: "chatgpt",
      position: 1,
      url,
      domain: new URL(url).hostname,
      title: null,
    };
  });
  return { run: summary(id) as unknown as AiSearchSnapshot["run"], calls, probes: [], citations };
}

const SNAPSHOTS: Record<string, AiSearchSnapshot> = { r1: snapshot("r1", 2), r2: snapshot("r2", 0), r3: snapshot("r3", 3) };
const PUBLISHED: AiSearchRead = { phase: "ready", snapshot: SNAPSHOTS.r3! };
const STOCK = { phase: "ready" as const, rows: [{} as never, {} as never], populationCount: 8 };
const FINDABILITY = { phase: "error" as const, message: "fixture" };

const READS: ActionItemsReads = {
  retail: async () => ({ phase: "error" }),
  bundle: async () => null,
  findability: async () => FINDABILITY,
  stock: async () => STOCK,
  published: async () => PUBLISHED,
  historyCatalog: async () => ({ phase: "ready", runs: Object.keys(DAYS).map(summary) }),
  apiCatalog: async () => ({ phase: "off" }),
  run: async (id) => ({ phase: "ready", snapshot: SNAPSHOTS[id]! }),
  apiRun: async () => ({ phase: "missing" }),
};

/**
 * The browser's steps with the same fixtures: useSummaryAiRead and useMapPopulation (no API
 * views, so the switch reads missing), useSourceRuns, useFocusWindows, then useRoadmapPlan.
 */
function browserRows(today: Date): string[][] {
  const missing = { phase: "missing" as const };
  const ai = engineGroupRead(PUBLISHED, missing, "all");
  const runs = Object.keys(DAYS).map(summary);
  const ids = priorRunIds(runs, "r3");
  const prior = ids.map((id) => engineGroupRead({ phase: "ready", snapshot: SNAPSHOTS[id]! }, missing, "all"));
  const sources = sourceRunsRead({ current: ai, ids, live: true, catalogFailed: false, prior });
  const window = focusWindowRuns(runs, "2026-11-03");
  const pick = (list: HistoryRunSummary[]) => list.map((run) => SNAPSHOTS[run.audit_run_id]!);
  const split = { current: pick(window.current), previous: pick(window.previous) };
  const none = { phase: "ready" as const, snapshots: [] };
  const windows = focusWindowsReady(split, missing, none, none);
  const plan = assembleRoadmapPlan({
    retail: { phase: "error" },
    bundle: null,
    findability: FINDABILITY,
    ai,
    aiStale: ai.phase === "ready" ? aiSearchStale(ai.snapshot.run) : null,
    stock: STOCK,
    sources,
    windows,
    focus: BRAND_FOCUS,
  }).plan;
  return plan.map((item) => [item.id, ...fixListCells(item, today)]);
}

test("the fix-list download holds the rows the Action Items table shows, in its order", async () => {
  const today = new Date("2026-11-11T12:00:00Z");
  const plan = await loadActionItemsPlan(READS, BRAND_FOCUS);
  const server = actionItemsExportSource(plan, today, "Nov 11, 2026", BRAND_FOCUS);
  const browser = browserRows(today);
  assert.ok(browser.length >= 7, "five findings, the stock signal, and the source action");
  assert.deepEqual(
    server.rows.map((row) => [row.key, ...row.cells]),
    browser,
  );
  assert.deepEqual(server.header, [...FIX_LIST_HEADER]);
  assert.ok(server.rows.some((row) => row.key.startsWith("source:") || row.cells[6]!.includes("guitarworld.com")));
  assert.equal(server.population, `5 current findings, then ${server.rows.length - 5} actions`);
});

test("the Action Items hooks build the plan with the shared functions", () => {
  const data = read("components/v3/live/RoadmapPlanData.ts");
  assert.match(data, /assembleRoadmapPlan\(\{ retail, bundle, findability, ai, aiStale, stock, sources, windows, focus \}\)/);
  assert.match(data, /sourceRunsRead\(/);
  assert.match(data, /pairedApiRuns\(/);
  assert.match(read("components/v3/live/useFocusWindows.ts"), /focusWindowsReady\(split, pending, currentApi, previousApi\)/);
  assert.match(read("components/v3/live/useFocusWindows.ts"), /focusWindowApiRuns\(/);
  assert.match(read("components/v3/live/ai-search/useApiEngineLoad.ts"), /pairedApiRuns\(catalog\.runs, snapshot\)/);
  assert.match(read("components/v3/live/ActionItemsFixTable.tsx"), /FIX_TABLE_ID = "action-items-fixes"/);
});

test("Action Items, prompts, and Findability listings have a server CSV", () => {
  for (const id of ["action-items-fixes", "prompts", "findability-listings"]) {
    assert.ok((EXPORT_TABLE_IDS as readonly string[]).includes(id), id);
    assert.ok(isExportTable(id), id);
  }
  const loaders = read("lib/export/load-table.ts");
  assert.match(loaders, /"findability-listings": loadFindabilitySource/);
  assert.match(loaders, /"action-items-fixes": loadActionItemsSource/);
  assert.match(loaders, /"prompts": loadPromptsSource/);
});

test("the prompt download lists asked prompts, then removed ones, with the screen's search", () => {
  const prompt = (key: string, active: boolean, kind = "commercial") => ({
    prompt_key: key,
    prompt_text: `Best ${key} guitar?`,
    category: "electric",
    prompt_kind: kind,
    active,
    created_at: null,
    updated_at: null,
  });
  const rows = promptRows([prompt("a1", true), prompt("old", false), prompt("p2", true, "probe")]);
  assert.deepEqual(rows.map((row) => row.key), ["a1", "p2", "old"]);
  assert.deepEqual(rows[1]!.cells, ["p2", "electric", "Fact check", "Best p2 guitar?", "Asked"]);
  assert.equal(rows[2]!.cells[4], "Removed");
  const csv = shownCsv(
    {
      table: "prompts",
      header: [...PROMPTS_HEADER],
      rows,
      filter: null,
      sort: "List order.",
      population: "2 prompts asked each run, 1 removed",
      asOf: "Nov 11, 2026",
    },
    { keys: ["p2"], search: "p2", sort: null, filter: null, scope: null },
    null,
  );
  const lines = csv.trim().split(/\r?\n/);
  assert.match(lines[0]!, /^Filter,/);
  assert.match(lines[3]!, /1 of 3 rows/);
  assert.match(lines[5]!, /^p2,electric,Fact check,/);
});

test("N of M rows shows on every table, searching or not (decided 11 Nov 2026)", () => {
  const toolbar = read("components/v3/live/TableToolbar.tsx");
  assert.doesNotMatch(toolbar, /query\.trim\(\) \? \(\s*<span className="table-toolbar-count"/);
  assert.match(toolbar, /<span className="table-toolbar-count" data-table-search-count=\{controls\.matched\}>/);
});
