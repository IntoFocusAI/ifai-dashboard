// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/published-read-order.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { AI_READ_ORDER, loadAiSearchRead, type AiReadClient } from "../lib/ai-search/queries.ts";

const RUN = "e7ebb838-2852-4847-98d7-017ac47923bf";
const SERVER_MAX_ROWS = 1000;

type Row = Record<string, unknown>;
type Request = { view: string; order: string[]; range: [number, number] | null };

/** Behaves like the REST API: 1,000 rows at most per response, and ties come back in a different order each time. */
function fakeClient(tables: Record<string, Row[]>) {
  const requests: Request[] = [];
  let seed = 11;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const compare = (a: Row, b: Row, columns: string[]) => {
    for (const column of columns) {
      const x = a[column] as number | string;
      const y = b[column] as number | string;
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  };
  const run = (request: Request) => {
    requests.push(request);
    const rows = (tables[request.view] ?? [])
      .map((row) => ({ row, tie: random() }))
      .sort((a, b) => compare(a.row, b.row, request.order) || a.tie - b.tie)
      .map((entry) => entry.row);
    const [from, to] = request.range ?? [0, rows.length - 1];
    return { data: rows.slice(from, Math.min(to + 1, from + SERVER_MAX_ROWS)), error: null };
  };
  const builder = (request: Request): unknown => ({
    order: (column: string) => builder({ ...request, order: [...request.order, column] }),
    range: (from: number, to: number) => Promise.resolve(run({ ...request, range: [from, to] })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(run(request)).then(resolve, reject),
  });
  const client = {
    from: (view: string) => ({ select: () => builder({ view, order: [], range: null }) }),
  } as unknown as AiReadClient;
  return { client, requests };
}

/** The published run's shape: 2,040 calls, 300 fact checks, and 7,838 citations, 2 to 7 per call. */
function publishedRun(): Record<string, Row[]> {
  const calls: Row[] = [];
  const probes: Row[] = [];
  const citations: Row[] = [];
  for (let sim = 1; sim <= 2040; sim += 1) {
    calls.push({ id: `call-${sim}`, audit_run_id: RUN, sim_id: sim, prompt_kind: sim > 1740 ? "probe" : "commercial" });
    if (sim > 1740) probes.push({ audit_run_id: RUN, sim_id: sim });
    // Uneven counts, so 1,000-row page boundaries fall inside one call's citations.
    const count = 2 + ((sim * 7) % 6);
    for (let position = 1; position <= count && citations.length < 7838; position += 1) {
      citations.push({ audit_run_id: RUN, sim_id: sim, simulation_id: `call-${sim}`, position });
    }
  }
  return {
    canvas_ai_current_run: [{ audit_run_id: RUN, run_state: "completed" }],
    canvas_ai_simulations: calls,
    canvas_ai_probes: probes,
    canvas_ai_citations: citations,
  };
}

test("the published read pages citations by sim_id then position, so each row is read once", async () => {
  const { client, requests } = fakeClient(publishedRun());
  const read = await loadAiSearchRead(client);
  assert.equal(read.phase, "ready");
  if (read.phase !== "ready") return;
  const { calls, probes, citations } = read.snapshot;
  assert.equal(calls.length, 2040);
  assert.equal(new Set(calls.map((row) => row.id)).size, 2040);
  assert.equal(probes.length, 300);
  assert.equal(citations.length, 7838);
  assert.equal(new Set(citations.map((row) => `${row.simulation_id}:${row.position}`)).size, 7838);

  const orderFor = (view: string) => requests.find((request) => request.view === view)?.order;
  assert.deepEqual(orderFor("canvas_ai_simulations"), ["sim_id", "id"]);
  assert.deepEqual(orderFor("canvas_ai_probes"), ["sim_id"]);
  assert.deepEqual(orderFor("canvas_ai_citations"), ["sim_id", "position"]);
  assert.deepEqual(AI_READ_ORDER.citations, ["sim_id", "position"]);
  assert.equal(requests.filter((request) => request.view === "canvas_ai_citations").length, 8);
});

test("a sim_id-only citation order reads some rows twice and skips others", async () => {
  // The old read, for contrast: ties across a page boundary come back in a new order on each page.
  const { client } = fakeClient(publishedRun());
  const rows: Row[] = [];
  for (let page = 0; page < 8; page += 1) {
    const ordered = client.from("canvas_ai_citations").select("*").order("sim_id");
    const { data } = (await ordered.range(page * 1000, page * 1000 + 999)) as { data: Row[] };
    rows.push(...data);
  }
  assert.equal(rows.length, 7838);
  assert.ok(new Set(rows.map((row) => `${row.simulation_id}:${row.position}`)).size < 7838);
});
