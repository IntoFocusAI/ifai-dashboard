// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-window-fast-read.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canonicalUrl, citationEvidence, isValidCitationUrl } from "../lib/ai-search/citations.ts";
import { TRUSTED_COLLECTOR_VERSION, type HistoryRunSummary } from "../lib/ai-search/history-eligibility.ts";
import {
  HISTORY_CITATION_VIEW,
  loadHistorySnapshot,
  RUN_ROWS_FUNCTION,
  type HistoryReadClient,
} from "../lib/ai-search/history-queries.ts";
import { buildHistoryTrend, windowQuestionSetChange } from "../lib/ai-search/history-trends.ts";
import { createReadLimit } from "../lib/ai-search/read-limit.ts";
import { setSiteTypes, siteTypeIndex } from "../lib/ai-search/site-types.ts";
import { STORED_RUN_COPY_DATA } from "../lib/ai-search/stored-run-copy-data.ts";
import { summarizeRun } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

/* Worker 26.13: the date-pill window reads each history run in one request through
   public.canvas_ai_history_run_rows (supabase/migrations/20261112230000_ai_history_run_rows.sql)
   when the database has it, and by pages when it does not. Both paths must give every figure
   the same rows. */

type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Filter = { column: string; op: "eq" | "gt" | "gte"; value: unknown } | { or: string };

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function cell(row: Row, column: string): number | string {
  return row[column] as number | string;
}

function matches(row: Row, filter: Filter): boolean {
  if ("or" in filter) {
    return filter.or.split(",").some((part) => {
      const [column, op, ...rest] = part.split(".");
      const raw = rest.join(".");
      const value = raw.startsWith('"') ? JSON.parse(raw) : Number(raw);
      return op === "gt" ? cell(row, column) > value : cell(row, column) === value;
    });
  }
  const value = filter.value as number | string;
  if (filter.op === "eq") return row[filter.column] === filter.value;
  return filter.op === "gt" ? cell(row, filter.column) > value : cell(row, filter.column) >= value;
}

function byColumns(columns: readonly string[]) {
  return (a: Row, b: Row) => {
    for (const column of columns) {
      if (cell(a, column) < cell(b, column)) return -1;
      if (cell(a, column) > cell(b, column)) return 1;
    }
    return 0;
  };
}

function project(row: Row, columns: string): Row {
  if (columns === "*") return { ...row };
  return Object.fromEntries(columns.split(",").filter((column) => column in row).map((column) => [column, row[column]]));
}

/** The view columns the migration's function selects for each key (no answer_text). */
const FUNCTION_SOURCES = {
  runs: { view: "canvas_ai_history_runs", order: [] as string[] },
  calls: { view: "canvas_ai_history_calls", order: ["sim_id", "id"] },
  probes: { view: "canvas_ai_history_probes", order: ["sim_id"] },
  citations: { view: HISTORY_CITATION_VIEW, order: ["sim_id", "position"] },
};

/**
 * The REST API over the given views, 1,000 rows a page. With `fn`, it also answers the run-rows
 * function the way the migration defines it: each view's rows for the run, ordered, without answers.
 */
function fakeClient(tables: Record<string, Row[]>, fn: "present" | "missing" | "timeout" | "foreign" | "absent") {
  const calls: string[] = [];
  const page = (view: string, columns: string, filters: Filter[], order: string[], limit: number | null) => {
    calls.push(view);
    const rows = (tables[view] ?? []).filter((row) => filters.every((filter) => matches(row, filter))).sort(byColumns(order));
    return Promise.resolve({ data: rows.slice(0, Math.min(limit ?? 1000, 1000)).map((row) => project(row, columns)), error: null });
  };
  const builder = (view: string, columns: string, filters: Filter[], order: string[]): unknown => ({
    eq: (column: string, value: unknown) => builder(view, columns, [...filters, { column, op: "eq", value }], order),
    gt: (column: string, value: unknown) => builder(view, columns, [...filters, { column, op: "gt", value }], order),
    gte: (column: string, value: unknown) => builder(view, columns, [...filters, { column, op: "gte", value }], order),
    or: (filter: string) => builder(view, columns, [...filters, { or: filter }], order),
    order: (column: string) => builder(view, columns, filters, [...order, column]),
    limit: (count: number) => page(view, columns, filters, order, count),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      page(view, columns, filters, order, null).then(resolve, reject),
  });
  const client: Record<string, unknown> = {
    from: (view: string) => ({ select: (columns: string) => builder(view, columns, [], []) }),
  };
  if (fn !== "absent") {
    client.rpc = (name: string, args: Record<string, unknown>) => {
      calls.push(`rpc:${name}`);
      if (fn === "missing") {
        const error: DbError = { code: "PGRST202", message: `Could not find the function public.${name}(p_run_id) in the schema cache` };
        return Promise.resolve({ data: null, error });
      }
      if (fn === "foreign") return Promise.resolve({ data: null, error: null });
      if (fn === "timeout") return Promise.resolve({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
      const id = args.p_run_id;
      const data = Object.fromEntries(
        Object.entries(FUNCTION_SOURCES).map(([key, source]) => [
          key,
          (tables[source.view] ?? [])
            .filter((row) => row.audit_run_id === id)
            .sort(byColumns(source.order))
            .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== "answer_text"))),
        ]),
      );
      return Promise.resolve({ data, error: null });
    };
  }
  return { client: client as unknown as HistoryReadClient, calls };
}

/** The stored copy of three October runs, as the history views would list them, with answers stored. */
function storedTables(): { tables: Record<string, Row[]>; ids: string[] } {
  const tables: Record<string, Row[]> = {
    canvas_ai_history_runs: [],
    canvas_ai_history_calls: [],
    canvas_ai_history_probes: [],
    [HISTORY_CITATION_VIEW]: [],
  };
  const ids: string[] = [];
  for (const entry of STORED_RUN_COPY_DATA.runs) {
    const run = { ...entry.run, collector_version: TRUSTED_COLLECTOR_VERSION, is_published: true, published_at: entry.run.completed_at };
    ids.push(run.audit_run_id);
    tables.canvas_ai_history_runs.push(run as Row);
    tables.canvas_ai_history_calls.push(...entry.calls.map((row) => ({ ...row, answer_text: `answer ${row.sim_id}` })));
    tables.canvas_ai_history_probes.push(...entry.probes.map((row) => ({ ...row, answer_text: `probe answer ${row.sim_id}` })));
    tables[HISTORY_CITATION_VIEW].push(...(entry.citations as Row[]));
  }
  return { tables, ids };
}

const WINDOW_READ = { withAnswers: false } as const;

async function snapshotOf(client: HistoryReadClient, id: string, options: object = WINDOW_READ): Promise<AiSearchSnapshot> {
  const result = await loadHistorySnapshot(client, id, { limit: createReadLimit(4), ...options });
  assert.equal(result.phase, "ready", `run ${id} loads`);
  return (result as { snapshot: AiSearchSnapshot }).snapshot;
}

test("one request per run gives the same snapshot and the same figures as the page reads", async () => {
  const { tables, ids } = storedTables();
  for (const id of ids) {
    const pages = fakeClient(tables, "absent");
    const once = fakeClient(tables, "present");
    const byPages = await snapshotOf(pages.client, id);
    const atOnce = await snapshotOf(once.client, id);
    assert.deepEqual(atOnce, byPages, `run ${id}: same rows, same order`);
    assert.ok(byPages.calls.length > 0 && byPages.calls.every((call) => call.answer_text === undefined), "no answers in the window");
    assert.deepEqual(summarizeRun(atOnce), summarizeRun(byPages), `run ${id}: same figures`);
    assert.deepEqual(once.calls, [`rpc:${RUN_ROWS_FUNCTION}`], "the run is one request");
    assert.ok(pages.calls.length >= 4, "the page reads take a request per view at least");
  }
});

for (const fn of ["missing", "foreign"] as const) {
  test(`without the function (${fn}) the window reads pages, and asks for it once per client`, async () => {
    const { tables, ids } = storedTables();
    const { client, calls } = fakeClient(tables, fn);
    const pages = fakeClient(tables, "absent").client;
    const expected = await Promise.all(ids.map((id) => snapshotOf(pages, id)));
    // The window's runs load side by side; the ones beside the first wait for its answer.
    assert.deepEqual(await Promise.all(ids.map((id) => snapshotOf(client, id))), expected);
    await snapshotOf(client, ids[1]);
    assert.equal(calls.filter((call) => call.startsWith("rpc:")).length, 1, "asked once, not once per run");
  });
}

test("a failed call reads that run by pages and still tries the function for the next run", async () => {
  const { tables, ids } = storedTables();
  const { client, calls } = fakeClient(tables, "timeout");
  const expected = await snapshotOf(fakeClient(tables, "absent").client, ids[2]);
  assert.deepEqual(await snapshotOf(client, ids[2]), expected);
  await snapshotOf(client, ids[1]);
  assert.equal(calls.filter((call) => call.startsWith("rpc:")).length, 2);
});

test("a reader that shows answers, or no citations, keeps the page reads", async () => {
  const { tables, ids } = storedTables();
  const withAnswers = fakeClient(tables, "present");
  const full = await snapshotOf(withAnswers.client, ids[2], {});
  assert.equal(full.calls[0].answer_text, `answer ${full.calls[0].sim_id}`);
  const noCitations = fakeClient(tables, "present");
  await snapshotOf(noCitations.client, ids[2], { withAnswers: false, withCitations: false });
  assert.equal([...withAnswers.calls, ...noCitations.calls].filter((call) => call.startsWith("rpc:")).length, 0);
});

test("a run outside the review history reads as unavailable on both paths", async () => {
  const { tables, ids } = storedTables();
  const outside = "0c21cd05-0000-4000-8000-000000000008";
  const source = tables.canvas_ai_history_runs.find((row) => row.audit_run_id === ids[2]);
  tables.canvas_ai_history_runs.push({ ...source, audit_run_id: outside, collector_version: "v8", is_published: false });
  const once = await loadHistorySnapshot(fakeClient(tables, "present").client, outside, WINDOW_READ);
  const pages = await loadHistorySnapshot(fakeClient(tables, "absent").client, outside, WINDOW_READ);
  assert.equal(once.phase, "unavailable");
  assert.deepEqual(once, pages);
});

test("the migration is add-only, reads only the four history views as the caller, and says how to undo it", () => {
  const sql = read("supabase/migrations/20261112230000_ai_history_run_rows.sql");
  assert.match(sql, /CREATE FUNCTION public\.canvas_ai_history_run_rows\(p_run_id uuid\)/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /STABLE/);
  assert.match(sql, /-- Undo[^\n]*\n--\s+DROP FUNCTION IF EXISTS public\.canvas_ai_history_run_rows\(uuid\);/);
  assert.doesNotMatch(sql, /^\s*(DROP|ALTER TABLE|ALTER VIEW|CREATE OR REPLACE VIEW|INSERT|UPDATE|DELETE)\b/im);
  const statements = sql.replace(/^--.*$/gm, "");
  assert.doesNotMatch(statements, /answer_text/, "answers stay on the server");
  const sources = [...sql.matchAll(/FROM (public\.[a-z_]+)/g)].map((match) => match[1]);
  assert.deepEqual(sources, [
    "public.canvas_ai_history_runs",
    "public.canvas_ai_history_calls",
    "public.canvas_ai_history_probes",
    `public.${HISTORY_CITATION_VIEW}`,
  ]);
  assert.match(sql, /json_agg\(c ORDER BY c\.sim_id, c\.id\)/);
  assert.match(sql, /json_agg\(p ORDER BY p\.sim_id\)/);
  assert.match(sql, /json_agg\(ci ORDER BY ci\.sim_id, ci\."position"\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canvas_ai_history_run_rows\(uuid\) TO anon, authenticated;/);
});

test("the window and the API runs are read without answers; a drawer reads its one answer when it opens", () => {
  const context = read("components/v3/live/ai-search/AiHistoryContext.tsx");
  assert.match(context, /loadHistorySnapshot\(getCanvasSupabase\(\) as never, run\.audit_run_id, \{ signal: stop\.signal, withAnswers: false \}\)/);
  assert.match(read("components/v3/live/ai-search/useApiEngineLoad.ts"), /loadApiRunSnapshot\(getCanvasSupabase\(\) as never, run, \{ withAnswers: false \}\)/);
  const answers = read("lib/ai-search/answer-text.ts");
  assert.match(answers, /\["canvas_ai_simulations", "canvas_ai_history_calls", "canvas_ai_api_calls"\]/);
  assert.match(read("components/v3/live/ai-search/useAnswerText.ts"), /from "@\/lib\/ai-search\/answer-text"/);
});

test("a run summary and its citation evidence are computed once per snapshot, and again when the site types change", async () => {
  const { tables, ids } = storedTables();
  const snapshot = await snapshotOf(fakeClient(tables, "present").client, ids[2]);
  const first = summarizeRun(snapshot);
  assert.equal(summarizeRun(snapshot), first);
  const evidence = citationEvidence(snapshot.calls, snapshot.citations, "commercial");
  assert.equal(citationEvidence(snapshot.calls, snapshot.citations, "commercial"), evidence);
  assert.notEqual(citationEvidence(snapshot.calls, snapshot.citations, "all"), evidence);
  const owned = evidence.rows[0].domain;
  setSiteTypes(siteTypeIndex([{ client_key: "fmic", domain: owned, site_type: "retailer", source: "staff", confidence: 1, needs_review: false }]));
  try {
    const after = summarizeRun(snapshot);
    assert.notEqual(after, first, "new site types recompute the summary");
    assert.notEqual(citationEvidence(snapshot.calls, snapshot.citations, "commercial"), evidence);
  } finally {
    setSiteTypes(null);
  }
  assert.deepEqual(summarizeRun({ ...snapshot }), first, "a copy of the rows gives the same figures");
});

test("parsed URLs are cached without changing what they parse to", () => {
  const url = "https://WWW.Fender.com/en-US/guitars/?utm_source=x#top";
  assert.equal(canonicalUrl(url), "https://fender.com/en-US/guitars");
  assert.equal(canonicalUrl(url), "https://fender.com/en-US/guitars");
  assert.equal(isValidCitationUrl("null"), false);
  assert.equal(isValidCitationUrl("null"), false);
  assert.equal(isValidCitationUrl(url), true);
  assert.throws(() => canonicalUrl("not a url"));
  assert.throws(() => canonicalUrl("not a url"), "a URL that does not parse is not cached");
});

/* The Fender boundary near 3 to 5 Nov (checked 12 Nov 2026 against the live history views): every
   commercial question is the same on both sides. The 5 Nov run retired three fixed fact checks
   (p18, p19, p34) and added three rotating catalog fact checks (p35, p36, p37), and the prompt-set
   hash changed with them. That is a real change to the question set. Rotation itself (a rotating
   key asking about a different product in each repeat or run) never marks a boundary. */

function run(id: string, day: string): HistoryRunSummary {
  return {
    audit_run_id: id,
    run_kind: "ai_simulation",
    run_state: "completed",
    collector_version: TRUSTED_COLLECTOR_VERSION,
    prompt_set_hash: "hash",
    expected_calls: 4,
    attempted_calls: 4,
    answered_calls: 4,
    error_calls: 0,
    is_published: true,
    published_at: `${day}T12:00:00Z`,
    completed_at: `${day}T11:00:00Z`,
  };
}

function snapshot(id: string, day: string, factChecks: Array<[string, string]>): AiSearchSnapshot {
  const call = (sim: number, key: string, kind: string, prompt: string): AiCallRow =>
    ({ id: `${id}-${sim}`, audit_run_id: id, sim_id: sim, prompt_key: key, prompt_kind: kind, prompt, call_status: "answered" }) as AiCallRow;
  return {
    run: run(id, day) as AiSearchSnapshot["run"],
    calls: [
      call(1, "q1", "commercial", "Best electric guitar for beginners"),
      call(2, "q2", "commercial", "Fender or Gibson for blues"),
      ...factChecks.map(([key, prompt], index) => call(3 + index, key, "probe", prompt)),
    ],
    probes: [],
    citations: [],
  };
}

test("rotating fact-check wording is not a question-set change; new fact-check keys are", () => {
  const rotating = (product: string): Array<[string, string]> => [
    ["p17", "Fender Player II Stratocaster neck radius and fret size"],
    ["p35", `How many frets does the ${product} have?`],
  ];
  const rotation = [
    snapshot("a", "2026-11-05", rotating("Fender American Ultra II Stratocaster")),
    snapshot("b", "2026-11-08", rotating("Fender Jimmy Page Telecaster")),
    snapshot("c", "2026-11-10", rotating("Fender Buddy Guy Standard Stratocaster")),
  ];
  assert.equal(windowQuestionSetChange(rotation), null, "rotation never marks a boundary");

  const fixed = snapshot("z", "2026-11-03", [
    ["p17", "Fender Player II Stratocaster neck radius and fret size"],
    ["p18", "What body wood does the Fender American Professional II Telecaster use?"],
  ]);
  assert.equal(
    windowQuestionSetChange([fixed, ...rotation], "probe"),
    "2026-11-05",
    "retiring and adding fact-check keys is a change for a fact-check figure",
  );
  assert.equal(windowQuestionSetChange([fixed, ...rotation], "all"), "2026-11-05", "and for a figure over every answer");
  // Agreed 12 Nov 2026: a shopping rate (the default) counts only shopping-question changes.
  assert.equal(windowQuestionSetChange([fixed, ...rotation]), null, "a fact-check swap does not mark a shopping rate");
  assert.equal(windowQuestionSetChange([fixed, ...rotation], "commercial"), null);
});

test("a shopping-question change marks shopping rates and leaves fact-check figures alone", () => {
  const checks: Array<[string, string]> = [["p17", "Fender Player II Stratocaster neck radius and fret size"]];
  const before = snapshot("a", "2026-11-05", checks);
  const after = snapshot("b", "2026-11-08", checks);
  const reworded: AiSearchSnapshot = {
    ...after,
    calls: after.calls.map((call) => (call.prompt_key === "q1" ? { ...call, prompt: "Best electric guitar under $500" } : call)),
  };
  assert.equal(windowQuestionSetChange([before, after]), null);
  assert.equal(windowQuestionSetChange([before, reworded]), "2026-11-08");
  assert.equal(windowQuestionSetChange([before, reworded], "probe"), null);
  assert.equal(windowQuestionSetChange([before, reworded], "all"), "2026-11-08");
});

test("the trend breaks only where the shopping questions changed, for both clients (Brian Magazu, 13 Nov 2026)", () => {
  const trendOf = (snapshots: AiSearchSnapshot[]) =>
    buildHistoryTrend({ snapshots, metric: "unbranded_discovery", breakdown: "overall", fromDay: null, toDay: null, query: { kind: "all" } });
  // Fender: fixed fact check p18 retired on Nov 5 and the rotating p35 added, as on the live runs.
  const fender = [
    snapshot("f1", "2026-11-03", [["p17", "Fender Player II Stratocaster neck radius and fret size"], ["p18", "What body wood?"]]),
    snapshot("f2", "2026-11-05", [["p17", "Fender Player II Stratocaster neck radius and fret size"], ["p35", "How many frets?"]]),
    snapshot("f3", "2026-11-08", [["p17", "Fender Player II Stratocaster neck radius and fret size"], ["p35", "How many frets?"]]),
  ];
  // Ledlenser: fixed fact check l32 swapped for l33.
  const ledlenser = [
    snapshot("l1", "2026-11-04", [["l30", "Ledlenser MH10 lumens"], ["l32", "Ledlenser P7R runtime"]]),
    snapshot("l2", "2026-11-07", [["l30", "Ledlenser MH10 lumens"], ["l33", "Ledlenser H7R battery"]]),
  ];
  for (const runs of [fender, ledlenser]) {
    const model = trendOf(runs);
    assert.equal(model.status, "ready");
    assert.deepEqual(model.boundaries, [], "a fact-check swap draws no boundary and no break");
  }
  // A shopping-question change still breaks the line, and its lists show the shopping questions only.
  const base = snapshot("f4", "2026-11-10", [["p17", "Fender Player II Stratocaster neck radius and fret size"]]);
  const changed: AiSearchSnapshot = {
    ...base,
    calls: base.calls.map((call) => (call.prompt_key === "q2" ? { ...call, prompt_key: "q3", prompt: "Best amp for metal" } : call)),
  };
  const model = trendOf([...fender, changed]);
  assert.equal(model.boundaries.length, 1);
  const [boundary] = model.boundaries;
  assert.equal(boundary.promptSetChanged, true);
  assert.equal(boundary.afterRunId, "f3");
  assert.ok([...boundary.beforeQuestions, ...boundary.afterQuestions].every((question) => question.promptKind === "commercial"));
});
