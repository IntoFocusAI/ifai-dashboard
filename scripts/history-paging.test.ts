// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/history-paging.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HISTORY_CITATION_VIEW,
  loadHistorySnapshot,
  readRunPages,
  type HistoryReadClient,
} from "../lib/ai-search/history-queries.ts";
import { createReadLimit, HISTORY_READ_CONCURRENCY } from "../lib/ai-search/read-limit.ts";

const RUN = "e7ebb838-2852-4847-98d7-017ac47923bf";
const OTHER = "8455c1c8-0000-4000-8000-000000000000";
const SERVER_MAX_ROWS = 1000;

type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Request = {
  view: string;
  filters: Array<[string, unknown]>;
  /** Key filters after the first page: [column, op, value] or an OR of them. */
  after: Array<[string, "gt" | "gte", unknown] | { or: string }>;
  order: string[];
  range: [number, number] | null;
  limit: number | null;
};

function parseValue(raw: string): unknown {
  if (raw.startsWith('"')) return JSON.parse(raw);
  return Number(raw);
}

/** The REST API's `or=(a.gt.1,b.gt.2)` filter, for the two forms the reads send. */
function matchesOr(row: Row, filter: string): boolean {
  return filter.split(",").some((part) => {
    const [column, op, ...rest] = part.split(".");
    const value = parseValue(rest.join("."));
    const cell = row[column] as number | string;
    return op === "gt" ? cell > (value as typeof cell) : cell === value;
  });
}

function matchesAfter(row: Row, after: Request["after"]): boolean {
  return after.every((filter) => {
    if ("or" in filter) return matchesOr(row, filter.or);
    const [column, op, value] = filter;
    const cell = row[column] as number | string;
    return op === "gt" ? cell > (value as typeof cell) : cell >= (value as typeof cell);
  });
}

function compare(a: Row, b: Row, columns: string[]): number {
  for (const column of columns) {
    const x = a[column] as number | string;
    const y = b[column] as number | string;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * Behaves like the REST API: 1,000 rows at most per response, and ties come back in no fixed order.
 * Each response waits a tick, so reads overlap the way they do in the browser.
 */
function fakeClient(tables: Record<string, Row[]>, failOn?: (request: Request) => DbError | null) {
  const requests: Request[] = [];
  let inflight = 0;
  const peak = { inflight: 0 };
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const run = async (request: Request) => {
    requests.push(request);
    inflight += 1;
    peak.inflight = Math.max(peak.inflight, inflight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inflight -= 1;
    const error = failOn?.(request) ?? null;
    if (error) return { data: null, error };
    const rows = (tables[request.view] ?? [])
      .filter((row) => request.filters.every(([column, value]) => row[column] === value))
      .filter((row) => matchesAfter(row, request.after))
      .map((row) => ({ row, tie: random() }))
      .sort((a, b) => compare(a.row, b.row, request.order) || a.tie - b.tie)
      .map((entry) => entry.row);
    const [from, to] = request.range ?? [0, (request.limit ?? rows.length) - 1];
    return { data: rows.slice(from, Math.min(to + 1, from + SERVER_MAX_ROWS)), error: null };
  };
  const builder = (request: Request): unknown => ({
    eq: (column: string, value: unknown) => builder({ ...request, filters: [...request.filters, [column, value]] }),
    gt: (column: string, value: unknown) => builder({ ...request, after: [...request.after, [column, "gt", value]] }),
    gte: (column: string, value: unknown) => builder({ ...request, after: [...request.after, [column, "gte", value]] }),
    or: (filter: string) => builder({ ...request, after: [...request.after, { or: filter }] }),
    order: (column: string) => builder({ ...request, order: [...request.order, column] }),
    limit: (count: number) => run({ ...request, limit: count }),
    range: (from: number, to: number) => run({ ...request, range: [from, to] }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      run(request).then(resolve, reject),
  });
  const client = {
    from: (view: string) => ({
      select: () => builder({ view, filters: [], after: [], order: [], range: null, limit: null }),
    }),
  } as unknown as HistoryReadClient;
  return { client, requests, peak };
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
    [HISTORY_CITATION_VIEW]: citations,
  };
}

test("a run past the 1,000-row response cap loads every call, fact check, and citation once", async () => {
  const { client, requests } = fakeClient(fullRun());
  const result = await loadHistorySnapshot(client, RUN, { limit: createReadLimit(4) });
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
  assert.equal(pages(HISTORY_CITATION_VIEW).length, 8);
  assert.equal(pages("canvas_ai_history_citations").length, 0, "the per-run view replaces the old one");
  for (const request of requests.filter((r) => r.view !== "canvas_ai_history_runs")) {
    assert.deepEqual(request.filters, [["audit_run_id", RUN]], `${request.view} reads one run`);
    assert.equal(request.range, null, `${request.view} never skips ahead by offset`);
    assert.equal(request.limit, 1000, `${request.view} asks for one page`);
  }
  assert.deepEqual(pages("canvas_ai_history_calls")[0].order, ["sim_id", "id"]);
  assert.deepEqual(pages("canvas_ai_history_probes")[0].order, ["sim_id"]);
  assert.deepEqual(pages(HISTORY_CITATION_VIEW)[0].order, ["sim_id", "position"]);
});

test("each page asks for the rows after the last one seen", async () => {
  const { client, requests } = fakeClient(fullRun());
  await loadHistorySnapshot(client, RUN, { limit: createReadLimit(4) });
  const citations = requests.filter((request) => request.view === HISTORY_CITATION_VIEW);
  assert.deepEqual(citations[0].after, [], "the first page has no key filter");
  // Calls 1 to 1,718 have four citations each, so the 1,000th citation in key order is call 250, position 4.
  assert.deepEqual(citations[1].after, [["sim_id", "gte", 250], { or: "sim_id.gt.250,position.gt.4" }]);
  const probes = requests.filter((request) => request.view === "canvas_ai_history_probes");
  assert.equal(probes.length, 1);
  const calls = requests.filter((request) => request.view === "canvas_ai_history_calls");
  assert.deepEqual(calls[1].after, [["sim_id", "gte", 1000], { or: 'sim_id.gt.1000,id.gt."call-1000"' }]);
});

test("a failed page is an error, not a partial run", async () => {
  const { client } = fakeClient(fullRun(), (request) =>
    request.view === HISTORY_CITATION_VIEW && request.after.length > 0 && citationsPage(request) === 3
      ? { message: "canceling statement due to statement timeout", code: "57014" }
      : null,
  );
  const result = await loadHistorySnapshot(client, RUN, { limit: createReadLimit(4) });
  assert.deepEqual(result, { phase: "error", message: "canceling statement due to statement timeout" });
});

/** Which citations page a request is, from the sim_id its key filter starts after. */
function citationsPage(request: Request): number {
  const first = request.after[0];
  if (!first || "or" in first) return 0;
  return Math.round((first[2] as number) / 250);
}

test("a missing history view reads as unavailable", async () => {
  const { client } = fakeClient(fullRun(), (request) =>
    request.view === "canvas_ai_history_calls" ? { message: "relation does not exist", code: "42P01" } : null,
  );
  const result = await loadHistorySnapshot(client, RUN, { limit: createReadLimit(4) });
  assert.equal(result.phase, "unavailable");
});

test("a view that never ends stops with an error instead of truncating", async () => {
  const endless = Array.from({ length: 1000 }, (_, sim) => ({ audit_run_id: RUN, sim_id: sim }));
  const client = {
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          gt: () => query,
          order: () => query,
          limit: () => Promise.resolve({ data: endless, error: null }),
        };
        return query;
      },
    }),
  } as unknown as HistoryReadClient;
  const { rows, error } = await readRunPages(client, "canvas_ai_history_calls", "*", RUN, ["sim_id"], {
    limit: createReadLimit(4),
  });
  assert.equal(rows.length, 50000);
  assert.match(error?.message ?? "", /more than 50000 rows/);
});

test("many runs at once never have more than four reads open", async () => {
  const tables = fullRun();
  const runs = Array.from({ length: 9 }, (_, index) => `run-${index}`);
  for (const id of runs) {
    tables.canvas_ai_history_runs.push({ ...runRow, audit_run_id: id });
    for (const view of ["canvas_ai_history_calls", "canvas_ai_history_probes", HISTORY_CITATION_VIEW]) {
      tables[view].push(...tables[view].filter((row) => row.audit_run_id === RUN).map((row) => ({ ...row, audit_run_id: id })));
    }
  }
  const { client, peak } = fakeClient(tables);
  const limit = createReadLimit(HISTORY_READ_CONCURRENCY);
  const results = await Promise.all(runs.map((id) => loadHistorySnapshot(client, id, { limit })));
  assert.equal(HISTORY_READ_CONCURRENCY, 4);
  assert.equal(peak.inflight, 4);
  assert.ok(results.every((result) => result.phase === "ready" && result.snapshot.citations.length === 7838));
});

test("a stopped read queues no more pages", async () => {
  const stop = new AbortController();
  const { client, requests } = fakeClient(fullRun(), (request) => {
    if (request.view === "canvas_ai_history_calls") stop.abort();
    return null;
  });
  const result = await loadHistorySnapshot(client, RUN, { limit: createReadLimit(1), signal: stop.signal });
  assert.equal(result.phase, "error");
  assert.deepEqual(
    requests.map((request) => request.view),
    ["canvas_ai_history_runs", "canvas_ai_history_calls"],
    "pages still queued when the read stopped were never sent",
  );
});
