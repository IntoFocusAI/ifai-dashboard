// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/history-paging.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadHistorySnapshot, readRunPages, type HistoryReadClient } from "../lib/ai-search/history-queries.ts";

const RUN = "e7ebb838-2852-4847-98d7-017ac47923bf";
const OTHER = "8455c1c8-0000-4000-8000-000000000000";
const SERVER_MAX_ROWS = 1000;

type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Request = {
  view: string;
  filters: Array<[string, unknown]>;
  order: string[];
  range: [number, number] | null;
};

function compare(a: Row, b: Row, columns: string[]): number {
  for (const column of columns) {
    const x = a[column] as number | string;
    const y = b[column] as number | string;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Behaves like the REST API: 1,000 rows at most per response, and ties come back in no fixed order. */
function fakeClient(tables: Record<string, Row[]>, failOn?: (request: Request) => DbError | null) {
  const requests: Request[] = [];
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const run = (request: Request) => {
    requests.push(request);
    const error = failOn?.(request) ?? null;
    if (error) return { data: null, error };
    const rows = (tables[request.view] ?? [])
      .filter((row) => request.filters.every(([column, value]) => row[column] === value))
      .map((row) => ({ row, tie: random() }))
      .sort((a, b) => compare(a.row, b.row, request.order) || a.tie - b.tie)
      .map((entry) => entry.row);
    const [from, to] = request.range ?? [0, rows.length - 1];
    return { data: rows.slice(from, Math.min(to + 1, from + SERVER_MAX_ROWS)), error: null };
  };
  const builder = (request: Request): unknown => ({
    eq: (column: string, value: unknown) => builder({ ...request, filters: [...request.filters, [column, value]] }),
    order: (column: string) => builder({ ...request, order: [...request.order, column] }),
    range: (from: number, to: number) => Promise.resolve(run({ ...request, range: [from, to] })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(run(request)).then(resolve, reject),
  });
  const client = {
    from: (view: string) => ({ select: () => builder({ view, filters: [], order: [], range: null }) }),
  } as unknown as HistoryReadClient;
  return { client, requests };
}

const runRow = {
  audit_run_id: RUN,
  run_kind: "ai_simulation",
  run_state: "completed",
  collector_version: "v11",
  prompt_set_hash: "hash",
  expected_calls: 2040,
  attempted_calls: 2040,
  answered_calls: 1700,
  error_calls: 340,
  missing_calls: 340,
  is_published: true,
  published_at: "2026-11-01T12:00:00Z",
  started_at: "2026-11-01T10:00:00Z",
  completed_at: "2026-11-01T11:00:00Z",
};

/** One full v11 run: 2,040 calls, 300 of them fact checks, and 7,838 citations, beside another run's rows. */
function fullRun(): Record<string, Row[]> {
  const calls: Row[] = [];
  const probes: Row[] = [];
  const citations: Row[] = [];
  for (let sim = 1; sim <= 2040; sim += 1) {
    const probe = sim > 1740;
    calls.push({ id: `call-${sim}`, audit_run_id: RUN, sim_id: sim, prompt_kind: probe ? "probe" : "commercial" });
    if (probe) probes.push({ audit_run_id: RUN, sim_id: sim, prompt_key: `p${sim % 20}`, answer_text: `answer ${sim}` });
  }
  for (let index = 0; index < 7838; index += 1) {
    const sim = 1 + (index % 2040);
    citations.push({ audit_run_id: RUN, sim_id: sim, simulation_id: `call-${sim}`, position: Math.floor(index / 2040) + 1 });
  }
  for (let sim = 1; sim <= 1200; sim += 1) {
    calls.push({ id: `other-${sim}`, audit_run_id: OTHER, sim_id: sim, prompt_kind: "commercial" });
    citations.push({ audit_run_id: OTHER, sim_id: sim, simulation_id: `other-${sim}`, position: 1 });
  }
  return {
    canvas_ai_history_runs: [runRow],
    canvas_ai_history_calls: calls,
    canvas_ai_history_probes: probes,
    canvas_ai_history_citations: citations,
  };
}

test("a run past the 1,000-row response cap loads every call, fact check, and citation once", async () => {
  const { client, requests } = fakeClient(fullRun());
  const result = await loadHistorySnapshot(client, RUN);
  assert.equal(result.phase, "ready");
  if (result.phase !== "ready") return;
  const { calls, probes, citations } = result.snapshot;
  assert.equal(calls.length, 2040);
  assert.equal(new Set(calls.map((row) => row.id)).size, 2040);
  assert.equal(probes.length, 300);
  assert.equal(citations.length, 7838);
  assert.equal(new Set(citations.map((row) => `${row.sim_id}:${row.position}`)).size, 7838);
  assert.ok([...calls, ...citations].every((row) => row.audit_run_id === RUN));
  assert.equal(calls.find((row) => row.sim_id === 2040)?.answer_text, "answer 2040");

  const pages = (view: string) => requests.filter((request) => request.view === view);
  assert.equal(pages("canvas_ai_history_calls").length, 3);
  assert.equal(pages("canvas_ai_history_citations").length, 8);
  for (const request of requests.filter((r) => r.view !== "canvas_ai_history_runs")) {
    assert.deepEqual(request.filters, [["audit_run_id", RUN]], `${request.view} reads one run`);
    assert.ok(request.range, `${request.view} is paged`);
  }
  assert.deepEqual(pages("canvas_ai_history_calls")[0].order, ["sim_id", "id"]);
  assert.deepEqual(pages("canvas_ai_history_probes")[0].order, ["sim_id"]);
  assert.deepEqual(pages("canvas_ai_history_citations")[0].order, ["sim_id", "position"]);
});

test("a failed page is an error, not a partial run", async () => {
  const { client } = fakeClient(fullRun(), (request) =>
    request.view === "canvas_ai_history_citations" && request.range?.[0] === 3000
      ? { message: "canceling statement due to statement timeout", code: "57014" }
      : null,
  );
  const result = await loadHistorySnapshot(client, RUN);
  assert.deepEqual(result, { phase: "error", message: "canceling statement due to statement timeout" });
});

test("a missing history view reads as unavailable", async () => {
  const { client } = fakeClient(fullRun(), (request) =>
    request.view === "canvas_ai_history_calls" ? { message: "relation does not exist", code: "42P01" } : null,
  );
  const result = await loadHistorySnapshot(client, RUN);
  assert.equal(result.phase, "unavailable");
});

test("a view that never ends stops with an error instead of truncating", async () => {
  const endless = Array.from({ length: 1000 }, (_, sim) => ({ audit_run_id: RUN, sim_id: sim }));
  const client = {
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          order: () => query,
          range: () => Promise.resolve({ data: endless, error: null }),
        };
        return query;
      },
    }),
  } as unknown as HistoryReadClient;
  const { rows, error } = await readRunPages(client, "canvas_ai_history_calls", "*", RUN, ["sim_id"]);
  assert.equal(rows.length, 50000);
  assert.match(error?.message ?? "", /more than 50000 rows/);
});
