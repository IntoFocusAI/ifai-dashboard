// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-api-engines-wiring.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  apiRunsCoveringBattery,
  apiRunsInScope,
  batteryQuestions,
  daysApart,
  nearestApiRun,
  type ApiRunSummary,
} from "../lib/ai-search/api-runs.ts";
import {
  API_REPEAT_CAP,
  API_REPEAT_RULE,
  capApiRepeats,
  citationPopulation,
  fixedQuestionCount,
  withApiSnapshots,
} from "../lib/ai-search/engine-group.ts";
import { engineGroupTrend, engineGroupWindow, pairApiRuns } from "../lib/ai-search/engine-group-window.ts";
import { aiNodeFaces } from "../lib/ai-search/canvas-surfaces.ts";
import { engineGroupRead, type ApiEngineLoad } from "../lib/ai-search/engine-group-read.ts";
import { buildHistoryTrend } from "../lib/ai-search/history-trends.ts";
import { batteryGaps, BATTERY_ENGINES, PROMPT_BATTERY } from "../lib/ai-search/prompt-battery.ts";
import type { AiCallRow, AiCurrentRun, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const P01 = PROMPT_BATTERY.find((prompt) => prompt.key === "p01")!;

function runOn(id: string, day: string, patch: Partial<AiCurrentRun> = {}): AiCurrentRun {
  return {
    audit_run_id: id,
    run_state: "completed",
    collector_version: "v11",
    prompt_set_hash: "hash",
    expected_calls: 4,
    attempted_calls: 4,
    answered_calls: 4,
    error_calls: 0,
    started_at: `${day}T06:00:00Z`,
    completed_at: `${day}T20:00:00Z`,
    published_at: `${day}T21:00:00Z`,
    is_published: true,
    ...patch,
  };
}

let next = 1;
function call(runId: string, engine: string, patch: Partial<AiCallRow> = {}): AiCallRow {
  const sim = next++;
  return {
    id: `${runId}:${sim}`,
    audit_run_id: runId,
    sim_id: sim,
    engine,
    model: null,
    category: P01.category,
    prompt: P01.text,
    prompt_key: P01.key,
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

/** A battery run: ChatGPT leads with Fender, Gemini with a competitor, plus one rotating fact check. */
function battery(id: string, day: string): AiSearchSnapshot {
  return {
    run: runOn(id, day),
    calls: [
      call(id, "chatgpt"),
      call(id, "gemini", { outcome: "competitor_win", primary_brand: "Gibson" }),
      call(id, "gemini", { prompt_kind: "probe", prompt_key: "p35", prompt: null, outcome: "not_scored" }),
    ],
    probes: [],
    citations: [],
  };
}

/** An API run: never published, two Fender leads from the ChatGPT API. */
function apiRunSnapshot(id: string, day: string): AiSearchSnapshot {
  return {
    run: runOn(id, day, { published_at: null, is_published: null, expected_calls: null }),
    calls: [call(id, "openai_api"), call(id, "openai_api")],
    probes: [],
    citations: [],
  };
}

function apiSummary(id: string, completedAt: string, patch: Partial<ApiRunSummary> = {}): ApiRunSummary {
  return {
    audit_run_id: id,
    run_state: "completed",
    collector_version: "api-v1",
    prompt_set_hash: "hash",
    expected_calls: 10,
    attempted_calls: 10,
    answered_calls: 10,
    error_calls: 0,
    started_at: completedAt,
    completed_at: completedAt,
    published_at: null,
    is_published: null,
    question_set_match: true,
    engines: ["openai_api"],
    ...patch,
  } as ApiRunSummary;
}

const OCT20 = battery("b-oct20", "2026-10-20");
const NOV3 = battery("b-nov3", "2026-11-03");
const API_NOV2 = apiRunSnapshot("a-nov2", "2026-11-02");

test("a single run gets the counted API run nearest its day; a tie goes to the later run", () => {
  const runs = [
    apiSummary("a-oct30", "2026-10-30T10:00:00Z"),
    apiSummary("a-nov5", "2026-11-05T10:00:00Z"),
    apiSummary("a-nov3-failed", "2026-11-03T10:00:00Z", { run_state: "failed" }),
    apiSummary("a-nov1", "2026-11-01T10:00:00Z"),
  ];
  assert.equal(daysApart("2026-11-03", "2026-10-30"), 4);
  assert.equal(nearestApiRun(runs, "2026-11-03")?.audit_run_id, "a-nov5");
  assert.equal(nearestApiRun(runs, "2026-11-02")?.audit_run_id, "a-nov1");
  assert.equal(nearestApiRun(runs, "2026-10-01")?.audit_run_id, "a-oct30");
  assert.equal(nearestApiRun(runs, null), null);
  assert.equal(nearestApiRun([apiSummary("a-none", "2026-11-03T10:00:00Z", { answered_calls: 0 })], "2026-11-03"), null);
});

test("each API run joins the battery run nearest its day; a tie goes to the later battery run", () => {
  const pairs = pairApiRuns(
    [NOV3, OCT20],
    [apiRunSnapshot("a-oct21", "2026-10-21"), apiRunSnapshot("a-oct27", "2026-10-27"), API_NOV2],
  );
  assert.deepEqual(pairs.get("b-oct20")?.map((row) => row.run.audit_run_id), ["a-oct21"]);
  assert.deepEqual(pairs.get("b-nov3")?.map((row) => row.run.audit_run_id), ["a-oct27", "a-nov2"]);
});

test("All keeps every battery point, puts the API calls on the nearest one, and keeps that run's date", () => {
  const window = engineGroupWindow([OCT20, NOV3], [API_NOV2], "all");
  assert.deepEqual(window.snapshots.map((row) => row.run.audit_run_id), ["b-oct20", "b-nov3"]);
  const nov3 = window.snapshots[1];
  assert.equal(nov3.run.published_at, NOV3.run.published_at);
  assert.deepEqual(nov3.calls.filter((row) => row.prompt_key !== "p35").map((row) => row.engine).sort(), ["chatgpt", "gemini", "openai_api", "openai_api"]);
  assert.ok(nov3.calls.every((row) => row.audit_run_id === "b-nov3"));
  assert.deepEqual([...window.apiDays], [["b-nov3", ["2026-11-02"]]]);
  // Every engine choice keeps the rotating fact checks the search engines asked (decision 13).
  assert.ok(window.snapshots.every((row) => row.calls.some((item) => item.prompt_key === "p35")));
  assert.ok(window.snapshots.every((row) => row.calls.filter((item) => item.prompt_key === "p35").every((item) => item.engine !== "openai_api")));
});

test("Citation Ecosystem keeps main's population: with API engines in the window, rotating fact checks sit out", () => {
  // Decision 13 is about Product Fact Checks. Citation totals count the fixed questions on every point.
  const all = engineGroupWindow([OCT20, NOV3], [API_NOV2], "all", "citations");
  assert.deepEqual(all.snapshots.map((row) => row.run.audit_run_id), ["b-oct20", "b-nov3"]);
  assert.deepEqual(all.snapshots[1].calls.map((row) => row.engine).sort(), ["chatgpt", "gemini", "openai_api", "openai_api"]);
  assert.ok(all.snapshots.every((row) => !row.calls.some((item) => item.prompt_key === "p35")));
  assert.ok(all.snapshots.every((row) => !row.citations.some((item) => item.prompt_key === "p35")));
  // Without API is the battery runs as they are, rotating checks included.
  assert.deepEqual(engineGroupWindow([OCT20, NOV3], [API_NOV2], "search", "citations").snapshots, [OCT20, NOV3]);
  // No API run in the window: nothing is dropped.
  assert.deepEqual(engineGroupWindow([OCT20, NOV3], [], "all", "citations").snapshots, [OCT20, NOV3]);
  // A single run: the rule follows whether its figures hold an API engine.
  assert.equal(citationPopulation(NOV3), NOV3);
  const withApi = withApiSnapshots(NOV3, [API_NOV2]);
  assert.equal(citationPopulation(withApi).calls.some((item) => item.prompt_key === "p35"), false);
  assert.equal(citationPopulation(withApi).calls.length, withApi.calls.filter((item) => item.prompt_key !== "p35").length);
});

test("Without API leaves the battery runs as they are; API only keeps the points with an API run", () => {
  const search = engineGroupWindow([OCT20, NOV3], [API_NOV2], "search");
  assert.deepEqual(search.snapshots, [OCT20, NOV3]);
  assert.equal(search.apiDays.size, 0);
  const api = engineGroupWindow([OCT20, NOV3], [API_NOV2], "api");
  assert.deepEqual(api.snapshots.map((row) => row.run.audit_run_id), ["b-nov3"]);
  assert.deepEqual(api.snapshots[0].calls.map((row) => row.engine), ["openai_api", "openai_api"]);
});

test("the trend counts the API calls on their point and draws no false gap for them", () => {
  const trend = (snapshots: AiSearchSnapshot[]) =>
    buildHistoryTrend({ snapshots, metric: "unbranded_discovery", breakdown: "overall", fromDay: null, toDay: null, query: { kind: "all" } });
  const search = trend(engineGroupWindow([OCT20, NOV3], [API_NOV2], "search").snapshots);
  const all = trend(engineGroupWindow([OCT20, NOV3], [API_NOV2], "all").snapshots);
  assert.equal(search.status, "ready");
  assert.equal(all.status, "ready");
  const lastPoint = (model: typeof all) => model.series[0].points.at(-1)!;
  assert.equal(lastPoint(all).resolved, lastPoint(search).resolved + 2);
  assert.equal(lastPoint(all).wins, lastPoint(search).wins + 2);
  assert.equal(lastPoint(all).notStored, lastPoint(search).notStored);
  // The trend keeps the rotating fact check, so its Partial coverage does not move with the switch.
  const kept = engineGroupWindow([OCT20, NOV3], [API_NOV2], "all").snapshots;
  assert.ok(kept.every((row) => row.calls.some((item) => item.prompt_key === "p35")));
  // One API point is one run: the trend reads it as one point, not a line.
  assert.equal(trend(engineGroupWindow([OCT20, NOV3], [API_NOV2], "api").snapshots).status, "one-run");
});

test("battery gaps skip API engines: API calls neither fill nor open a battery pair", () => {
  const searchCalls = PROMPT_BATTERY.flatMap((prompt) =>
    BATTERY_ENGINES.map((engine) =>
      call("b", engine, { prompt_key: prompt.key, prompt: prompt.text, prompt_kind: prompt.kind, category: prompt.category }),
    ),
  );
  assert.deepEqual(batteryGaps(searchCalls), []);
  assert.deepEqual(batteryGaps([...searchCalls, call("b", "openai_api"), call("b", "claude_api")]), []);
  assert.deepEqual(batteryGaps([call("a", "openai_api"), call("a", "gemini_api")]), []);
  const missingOne = searchCalls.slice(1);
  assert.equal(batteryGaps([...missingOne, call("b", "openai_api")]).length, 1);
});

test("the window waits for the API runs on All and API only; Without API and Not available* keep the battery runs", () => {
  const ready = { phase: "ready" as const, snapshots: [OCT20, NOV3] };
  const loading: ApiEngineLoad = { phase: "loading" };
  assert.equal(engineGroupTrend(ready, loading, "all").trend.phase, "loading");
  assert.equal(engineGroupTrend(ready, loading, "api").trend.phase, "loading");
  assert.equal(engineGroupTrend(ready, loading, "search").trend, ready);
  assert.equal(engineGroupTrend(ready, { phase: "missing" }, "all").trend, ready);
  assert.equal(engineGroupTrend(ready, { phase: "error", message: "timeout" }, "api").trend, ready);
  assert.equal(engineGroupTrend({ phase: "loading" }, loading, "all").trend.phase, "loading");

  const withApi: ApiEngineLoad = { phase: "ready", snapshots: [API_NOV2] };
  const all = engineGroupTrend(ready, withApi, "all");
  assert.equal(all.trend.phase === "ready" ? all.trend.snapshots.length : -1, 2);
  assert.deepEqual([...all.apiDays.keys()], ["b-nov3"]);
});

/** A battery run that asked all 34 wave 1 questions on ChatGPT and Gemini, as the live runs before wave 2 did. */
function fullBattery(id: string, day: string): AiSearchSnapshot {
  const calls = PROMPT_BATTERY.filter((prompt) => prompt.wave === undefined).flatMap((prompt) =>
    ["chatgpt", "gemini"].map((engine) =>
      call(id, engine, { prompt_key: prompt.key, prompt: prompt.text, prompt_kind: prompt.kind, category: prompt.category }),
    ),
  );
  return { run: runOn(id, day), calls, probes: [], citations: [] };
}

test("a battery run's fixed questions leave out rotating fact checks and API engines", () => {
  assert.equal(fixedQuestionCount(fullBattery("b", "2026-11-03")), 34);
  // OCT20: p01 and the rotating p35 on two engines. Only p01 is fixed.
  assert.equal(fixedQuestionCount(OCT20), 1);
  const withApi = { ...OCT20, calls: [...OCT20.calls, call("b-oct20", "openai_api", { prompt_key: "p02" })] };
  assert.equal(fixedQuestionCount(withApi), 1);
});

test("an API run counts only when it asked the fixed questions of the battery run nearest its day", () => {
  // The live API runs on 4 Nov 2026: two one-question smoke tests and two full runs.
  const runs = [
    apiSummary("28028054", "2026-10-27T20:13:01Z", { run_state: "partial", questions_asked: 1, questions_matched: 1, answered_calls: 2 }),
    apiSummary("1107bf8b", "2026-10-27T20:14:56Z", { questions_asked: 1, questions_matched: 1, answered_calls: 5 }),
    apiSummary("fe3ada9e", "2026-10-28T18:42:03Z", { run_state: "partial", questions_asked: 34, questions_matched: 34, repeats: 20 }),
    apiSummary("8aa2eb28", "2026-11-03T14:26:18Z", { run_state: "partial", questions_asked: 34, questions_matched: 34, repeats: 20 }),
  ];
  const window = batteryQuestions([fullBattery("b-oct26", "2026-10-26"), fullBattery("b-oct28", "2026-10-28"), fullBattery("b-nov3", "2026-11-03")]);
  assert.deepEqual(window.map((item) => item.fixedQuestions), [34, 34, 34]);
  const counted = apiRunsCoveringBattery(runs, window);
  assert.deepEqual(counted.map((run) => run.audit_run_id), ["fe3ada9e", "8aa2eb28"]);
  assert.deepEqual(
    apiRunsInScope(counted, { kind: "month" }, "2026-11-03").map((run) => run.audit_run_id),
    ["fe3ada9e", "8aa2eb28"],
  );

  // One run on Oct 26: the smoke tests a day later sit out, and the Oct 28 run is offered.
  const single = apiRunsCoveringBattery(runs, batteryQuestions([fullBattery("b-oct26", "2026-10-26")]));
  assert.equal(nearestApiRun(single, "2026-10-26")?.audit_run_id, "fe3ada9e");
  assert.equal(nearestApiRun(runs, "2026-10-26")?.audit_run_id, "1107bf8b");

  // A battery with one fixed question would take a one-question run; with no battery run, none counts.
  assert.equal(apiRunsCoveringBattery(runs, [{ day: "2026-10-27", fixedQuestions: 1 }]).length, 4);
  assert.deepEqual(apiRunsCoveringBattery(runs, []), []);
  assert.deepEqual(apiRunsCoveringBattery([apiSummary("no-count", "2026-11-03T10:00:00Z")], window), []);
});

test("the API repeat cap keeps repeats 1 to 3 and the fact checks and citations of those calls", () => {
  const id = "a-capped";
  const calls = [
    call(id, "openai_api", { repeat_no: 1 }),
    call(id, "openai_api", { repeat_no: 3 }),
    call(id, "openai_api", { repeat_no: null }),
    call(id, "openai_api", { repeat_no: 4, outcome: "competitor_win" }),
    call(id, "gemini_api", { repeat_no: 20, call_status: "error", outcome: "error" }),
    call(id, "gemini_api", { repeat_no: 2, prompt_kind: "probe", prompt_key: "p17", outcome: "not_scored" }),
    call(id, "gemini_api", { repeat_no: 5, prompt_kind: "probe", prompt_key: "p17", outcome: "not_scored" }),
  ];
  const probe = (row: AiCallRow) =>
    ({ audit_run_id: row.audit_run_id, sim_id: row.sim_id, prompt_key: "p17", engine: row.engine }) as AiSearchSnapshot["probes"][number];
  const cite = (row: AiCallRow) =>
    ({ audit_run_id: row.audit_run_id, sim_id: row.sim_id, simulation_id: row.id, url: "https://www.fender.com/" }) as AiSearchSnapshot["citations"][number];
  const snapshot: AiSearchSnapshot = {
    run: runOn(id, "2026-11-03", { published_at: null, expected_calls: 7, attempted_calls: 7, answered_calls: 6, error_calls: 1 }),
    calls,
    probes: [probe(calls[5]), probe(calls[6])],
    citations: calls.map(cite),
    storedCitationCount: calls.length,
  };
  const capped = capApiRepeats(snapshot);
  assert.equal(API_REPEAT_CAP, 3);
  assert.deepEqual(capped.calls.map((row) => row.repeat_no), [1, 3, null, 2]);
  assert.deepEqual(capped.probes.map((row) => row.sim_id), [calls[5].sim_id]);
  assert.deepEqual(capped.citations.map((row) => row.simulation_id), [calls[0], calls[1], calls[2], calls[5]].map((row) => row.id));
  assert.equal(capped.storedCitationCount, 4);
  assert.equal(capped.run.attempted_calls, 4);
  assert.equal(capped.run.answered_calls, 4);
  assert.equal(capped.run.error_calls, 0);
  assert.equal(capped.run.expected_calls, null);

  // The read leaves repeats past the cap on the server; their fact checks still arrive.
  const serverCapped = { ...snapshot, calls: [calls[0], calls[1], calls[2], calls[5]] };
  const afterRead = capApiRepeats(serverCapped);
  assert.deepEqual(afterRead.probes.map((row) => row.sim_id), [calls[5].sim_id]);
  assert.equal(afterRead.citations.length, 4);
  assert.equal(afterRead.run.attempted_calls, 4);

  const underCap = { ...snapshot, calls: calls.slice(0, 3), probes: [], citations: [] };
  assert.equal(capApiRepeats(underCap), underCap);
  // A 20-repeat run read already capped still recounts its run from the calls that count.
  assert.equal(capApiRepeats(underCap, API_REPEAT_CAP, 20).run.attempted_calls, 3);
  assert.equal(capApiRepeats(underCap, API_REPEAT_CAP, 20).run.expected_calls, null);
  assert.match(API_REPEAT_RULE, /repeats 1 to 3/);
});

test("the map's AI bubbles carry no hover tooltip, with or without API engines", () => {
  const all = engineGroupRead({ phase: "ready", snapshot: NOV3 }, { phase: "ready", snapshots: [API_NOV2] }, "all");
  assert.equal(all.phase, "ready");
  const faces = aiNodeFaces(all);
  assert.deepEqual(faces.spokeAeo.tooltip, { title: "", desc: "" });
  assert.deepEqual(faces.spokeCompetitors.tooltip, { title: "", desc: "" });

  const alone = aiNodeFaces({ phase: "ready", snapshot: NOV3 });
  assert.deepEqual(alone.spokeAeo.tooltip, { title: "", desc: "" });
  assert.deepEqual(alone.spokeCompetitors.tooltip, { title: "", desc: "" });

  const canvas = readFileSync(new URL("../components/v3/FenderBrandCanvas.tsx", import.meta.url), "utf8");
  assert.match(canvas, /const mapAiSearch = useMapAiSearch\(aiSearch\);/);
  assert.match(canvas, /aiSearch: mapAiSearch,/);
  assert.match(canvas, /<AiHistoryProvider current=\{aiSearch\}>/);
});

test("Run Summary, Citation Ecosystem, the trend, and the run detail read the switch", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("components/v3/live/ai-search/RunSummaryPanel.tsx"), /<EngineGroupScope>\s*<AiReadGate>/);
  assert.match(read("components/v3/live/ai-search/CitationEcosystemPanel.tsx"), /<EngineGroupScope>\s*<CitationEcosystemBody \/>/);
  assert.match(read("components/v3/live/ai-search/HistoryTrendsPanel.tsx"), /useEngineGroupWindow\(\)/);
  assert.match(read("components/v3/live/ai-search/useCitationAggregate.ts"), /useEngineGroupWindow\("citations"\)/);
  assert.match(read("components/v3/live/ai-search/RunHistoryControl.tsx"), /<PairedApiRun runId=\{run.audit_run_id\} day=\{day\} \/>/);
});

test("the Competitive Radar bubble names the rival the Battlecards tab names, from the window rows when given", () => {
  const rivalCalls = (brand: string, n: number) =>
    Array.from({ length: n }, () => call("w", "chatgpt", { outcome: "competitor_win", primary_brand: brand }));
  // The published run alone: Yamaha ahead. The window it sits in: Taylor ahead.
  const published = { ...NOV3, calls: [...rivalCalls("Yamaha", 3), ...rivalCalls("Taylor", 2)] };
  const window = { ...NOV3, calls: [...rivalCalls("Yamaha", 3), ...rivalCalls("Taylor", 6)] };
  const hero = (read: Parameters<typeof aiNodeFaces>[0]) => aiNodeFaces(read).spokeCompetitors.heroValue;
  assert.match(String(hero({ phase: "ready", snapshot: published })?.label), /^Yamaha leads/);
  const both = hero({ phase: "ready", snapshot: published, radarSnapshot: window });
  assert.match(String(both?.label), /^Taylor leads/);
  const wiring = readFileSync(new URL("../components/v3/live/ai-search/useApiEngineLoad.ts", import.meta.url), "utf8");
  assert.match(wiring, /radarSnapshot: radar\.snapshot/);
});
