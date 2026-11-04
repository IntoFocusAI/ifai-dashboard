// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-history.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isTrustworthyRun, utcDay, type HistoryRunSummary } from "../lib/ai-search/history-eligibility.ts";
import { historyFixtureSnapshot, historyFixtureSnapshots, historyFixtureSummaries } from "../lib/ai-search/history-fixtures.ts";
import { citationMonthBounds, poolWindowSnapshots } from "../lib/ai-search/citation-aggregate.ts";
import { historyControlLabel, historySpokeDescription } from "../lib/ai-search/history-mode.ts";
import { historyViewMissing } from "../lib/ai-search/history-queries.ts";
import { batteryGaps, batteryPrompt } from "../lib/ai-search/prompt-battery.ts";
import { queryVersionKey } from "../lib/ai-search/query-version.ts";
import {
  CITATION_STORAGE_CAUTION,
  EARLIER_OCTOBER_12_RUN_ID,
  OCTOBER_11_RUN_ID,
  PUBLISHED_OCTOBER_12_RUN_ID,
  REVIEW_RUN_IDS,
  STORED_RUN_COPY_LABEL,
  citationStorageCaution,
  previousReviewRun,
  reviewCatalog,
  scoringLabel,
} from "../lib/ai-search/review-runs.ts";
import { questionRole, roleTally } from "../lib/ai-search/question-role.ts";
import { callOutcome } from "../lib/ai-search/run-metrics.ts";
import {
  boundaryBreaks,
  boundaryLabel,
  buildHistoryTrend,
  callsBehindPoint,
  callsForRun,
  coverageLabel,
  ONE_RUN_TREND_MESSAGE,
  queryChoices,
  rateLabel,
  trendSegments,
} from "../lib/ai-search/history-trends.ts";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(`${root}${path}`, "utf8");
const snapshots = historyFixtureSnapshots();
const byId = (id: string) => {
  const snapshot = historyFixtureSnapshot(id);
  assert.ok(snapshot);
  return snapshot;
};

const october11 = byId(OCTOBER_11_RUN_ID);
const earlier = byId(EARLIER_OCTOBER_12_RUN_ID);
const published = byId(PUBLISHED_OCTOBER_12_RUN_ID);

test("default history label names the last 30 days", () => {
  assert.deepEqual(citationMonthBounds("2026-10-12"), { from: "2026-09-13", to: "2026-10-12" });
  assert.equal(
    historyControlLabel({ kind: "month" }, "2026-10-12", null),
    "Last 30 days · Sep 13 to Oct 12, 2026",
  );
  assert.equal(historyControlLabel({ kind: "month" }, null, null), "Last 30 days");
  assert.equal(historyControlLabel({ kind: "all" }, "2026-10-12", null), "All time");
});

test("poolWindowSnapshots keeps unusable-run calls and drops their citations", () => {
  const usableCallId = "call-usable";
  const cautionCallId = "call-caution";
  const usable: AiSearchSnapshot = {
    run: {
      ...published.run,
      audit_run_id: PUBLISHED_OCTOBER_12_RUN_ID,
      completed_at: "2026-10-12T18:00:00.000Z",
      published_at: "2026-10-12T18:00:00.000Z",
    },
    calls: [
      {
        ...published.calls[0],
        id: usableCallId,
        audit_run_id: PUBLISHED_OCTOBER_12_RUN_ID,
      },
    ],
    probes: [],
    citations: [
      {
        audit_run_id: PUBLISHED_OCTOBER_12_RUN_ID,
        sim_id: 1,
        simulation_id: usableCallId,
        prompt_key: "p01",
        prompt_kind: "commercial",
        category: "electrics",
        engine: "chatgpt",
        position: 1,
        url: "https://www.fender.com/guitars",
        domain: "fender.com",
        title: "Fender",
      },
    ],
    storedCitationCount: 1,
  };
  const caution: AiSearchSnapshot = {
    run: {
      ...earlier.run,
      audit_run_id: EARLIER_OCTOBER_12_RUN_ID,
      completed_at: "2026-10-12T12:00:00.000Z",
      published_at: null,
    },
    calls: [
      {
        ...earlier.calls[0],
        id: cautionCallId,
        audit_run_id: EARLIER_OCTOBER_12_RUN_ID,
      },
    ],
    probes: [],
    citations: [
      {
        audit_run_id: EARLIER_OCTOBER_12_RUN_ID,
        sim_id: 1,
        simulation_id: cautionCallId,
        prompt_key: "p01",
        prompt_kind: "commercial",
        category: "electrics",
        engine: "chatgpt",
        position: 1,
        url: "https://example.com/caution",
        domain: "example.com",
        title: "Caution",
      },
    ],
    storedCitationCount: 2,
  };
  assert.equal(citationStorageCaution(EARLIER_OCTOBER_12_RUN_ID) != null, true);
  const pooled = poolWindowSnapshots([usable, caution]);
  assert.ok(pooled);
  assert.equal(pooled.calls.length, 2);
  assert.deepEqual(
    pooled.calls.map((call) => call.id).sort(),
    [`${EARLIER_OCTOBER_12_RUN_ID}:${cautionCallId}`, `${PUBLISHED_OCTOBER_12_RUN_ID}:${usableCallId}`].sort(),
  );
  assert.equal(pooled.citations.length, 1);
  assert.equal(pooled.citations[0].simulation_id, `${PUBLISHED_OCTOBER_12_RUN_ID}:${usableCallId}`);
  assert.equal(pooled.storedCitationCount, 1);
  assert.equal(pooled.run.audit_run_id, PUBLISHED_OCTOBER_12_RUN_ID);
});

test("the current-run loader does not read history views", () => {
  assert.doesNotMatch(read("lib/ai-search/queries.ts"), /canvas_ai_history/);
  assert.match(read("supabase/migrations/20261012150400_ai_search_truth_4_current_views.sql"), /LIMIT 1/);
  assert.doesNotMatch(read("supabase/migrations/20261014190000_ai_search_history_views.sql"), /CREATE[^;]*canvas_ai_current_run/);
});

test("the review copy is the three stored runs, in date order, and nothing else", () => {
  assert.match(read("lib/ai-search/stored-run-copy-data.ts"), /Copy of the stored AI Search runs/);
  assert.match(read("lib/ai-search/history-fixtures.ts"), /STORED_RUN_COPY_LABEL|stored runs/);
  assert.equal(STORED_RUN_COPY_LABEL.includes("Copy of the stored runs"), true);
  assert.doesNotMatch(read("lib/ai-search/history-fixtures.ts"), /fx-2026|September/);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.run.audit_run_id),
    [...REVIEW_RUN_IDS],
  );
  assert.deepEqual(
    snapshots.map((snapshot) => utcDay(snapshot.run.published_at ?? snapshot.run.completed_at)),
    ["2026-10-11", "2026-10-12", "2026-10-12"],
  );
  assert.equal(october11.run.is_published, false);
  assert.equal(earlier.run.is_published, false);
  assert.equal(published.run.is_published, true);
  assert.equal(published.run.collector_version, "v11");
  assert.equal(isTrustworthyRun(published.run), true);
  assert.equal(isTrustworthyRun(october11.run), false);
  assert.equal(isTrustworthyRun(earlier.run), false);
});

test("other historical fragments stay out of the review catalog", () => {
  const fragment: HistoryRunSummary = {
    audit_run_id: "396aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    run_kind: "ai_simulation",
    run_state: "historical",
    collector_version: "v8",
    prompt_set_hash: null,
    expected_calls: null,
    attempted_calls: 12,
    answered_calls: 12,
    error_calls: 0,
    is_published: false,
    published_at: null,
    completed_at: "2026-10-03T12:00:00.000Z",
  };
  const staleEarlier: HistoryRunSummary = {
    ...historyFixtureSummaries().find((run) => run.audit_run_id === EARLIER_OCTOBER_12_RUN_ID)!,
    answered_calls: 72,
    error_calls: 30,
  };
  const catalog = reviewCatalog([fragment, ...historyFixtureSummaries().filter((run) => run.audit_run_id !== EARLIER_OCTOBER_12_RUN_ID), staleEarlier]);
  assert.deepEqual(
    catalog.map((run) => run.audit_run_id),
    [...REVIEW_RUN_IDS],
  );
  const earlierSummary = catalog.find((run) => run.audit_run_id === EARLIER_OCTOBER_12_RUN_ID);
  assert.equal(earlierSummary?.answered_calls, 73);
  assert.equal(earlierSummary?.error_calls, 29);
  assert.equal(previousReviewRun(catalog, PUBLISHED_OCTOBER_12_RUN_ID)?.audit_run_id, EARLIER_OCTOBER_12_RUN_ID);
  assert.equal(scoringLabel(october11.run), "Original winner labels");
  assert.equal(scoringLabel(earlier.run), "Mention-based scoring");
  assert.equal(scoringLabel(published.run), "Mention-based scoring");
});

test("October 11 keeps the two named calls as gaps", () => {
  assert.equal(october11.calls.length, 100);
  assert.equal(october11.calls.filter((call) => call.call_status === "error").length, 0);
  assert.equal(october11.calls.filter((call) => call.material_hallucination === "historical_unverified").length, 6);
  const gaps = batteryGaps(october11.calls);
  assert.deepEqual(
    gaps.map((gap) => `${gap.promptKey}:${gap.engine}:${gap.promptText}`),
    [
      "p15:perplexity:What is the best first electric guitar for a total beginner?",
      "p24:chatgpt:Best 5-string bass guitar for gigging musicians",
    ],
  );
  assert.ok(gaps.every((gap) => questionRole({ prompt_kind: gap.promptKind, prompt: gap.promptText }) === "unbranded_discovery"));
  const model = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  const point = model.series[0].points.find((item) => item.runId === OCTOBER_11_RUN_ID);
  assert.ok(point);
  assert.equal(point.notStored, 2);
  assert.notEqual(point.winPct, 0);
  assert.notEqual(point.winPct, null);
  assert.match(coverageLabel(point), /2 not stored/);
  assert.doesNotMatch(rateLabel(point), /0 of 0/);
  const beginner = batteryPrompt("p15");
  const bass = batteryPrompt("p24");
  assert.ok(beginner);
  assert.ok(bass);
  const byEngine = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "engine",
    fromDay: null,
    toDay: null,
    query: { kind: "version", versionKey: queryVersionKey("p15", beginner.text), promptKey: "p15", promptText: beginner.text },
  });
  const missingPerplexity = byEngine.series.find((series) => series.key === "perplexity")?.points.find((item) => item.runId === OCTOBER_11_RUN_ID);
  assert.ok(missingPerplexity);
  assert.equal(missingPerplexity.notStored, 1);
  assert.equal(missingPerplexity.wins, 0);
  assert.equal(missingPerplexity.resolved, 0);
  assert.equal(missingPerplexity.winPct, null);
  assert.equal(rateLabel(missingPerplexity), "Not stored");
  const bassTrend = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "engine",
    fromDay: null,
    toDay: null,
    query: { kind: "version", versionKey: queryVersionKey("p24", bass.text), promptKey: "p24", promptText: bass.text },
  });
  const missingChatgpt = bassTrend.series.find((series) => series.key === "chatgpt")?.points.find((item) => item.runId === OCTOBER_11_RUN_ID);
  assert.ok(missingChatgpt);
  assert.equal(missingChatgpt.winPct, null);
  assert.equal(rateLabel(missingChatgpt), "Not stored");
});

test("stored prompt text matches across the review set, so no question boundary is drawn", () => {
  const keys = new Set<string>();
  for (const snapshot of snapshots) {
    for (const call of snapshot.calls) {
      const prompt = batteryPrompt(call.prompt_key);
      assert.ok(prompt, call.prompt_key ?? "");
      assert.equal(call.prompt, prompt.text);
      keys.add(`${call.prompt_key}|${(call.engine ?? "").toLowerCase()}`);
    }
  }
  const earlierPairs = new Set(earlier.calls.map((call) => `${call.prompt_key}|${(call.engine ?? "").toLowerCase()}`));
  const publishedPairs = new Set(published.calls.map((call) => `${call.prompt_key}|${(call.engine ?? "").toLowerCase()}`));
  assert.equal(earlierPairs.size, 102);
  assert.deepEqual([...earlierPairs].sort(), [...publishedPairs].sort());
  assert.equal(keys.size, 102);
  const model = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  assert.equal(model.status, "ready");
  assert.equal(model.boundaries.length, 1);
  assert.equal(model.boundaries[0].scoringMethodChanged, true);
  assert.equal(model.boundaries[0].promptSetChanged, false);
  assert.equal(model.boundaries[0].queryVersionChanged, false);
  assert.equal(boundaryLabel(model.boundaries[0]), "Scoring method changed");
  assert.equal(model.boundaries[0].afterRunId, OCTOBER_11_RUN_ID);
  assert.equal(model.boundaries[0].beforeRunId, EARLIER_OCTOBER_12_RUN_ID);
  assert.deepEqual(boundaryBreaks(model.boundaries), new Set());
  assert.deepEqual(
    trendSegments(model.series[0].points, boundaryBreaks(model.boundaries)).map((segment) => segment.map((point) => point.runId)),
    [[OCTOBER_11_RUN_ID, EARLIER_OCTOBER_12_RUN_ID, PUBLISHED_OCTOBER_12_RUN_ID]],
  );
  assert.equal(queryChoices(snapshots, "unbranded_discovery").some((choice) => choice.kind === "lineage"), false);
});

test("a future wording change still breaks the line and is not listed as a gap", () => {
  const changedText = "What is the best first electric guitar for a classroom?";
  const changed: AiSearchSnapshot = {
    ...earlier,
    run: { ...earlier.run, prompt_set_hash: "future-wording" },
    calls: earlier.calls.map((call) => (call.prompt_key === "p15" ? { ...call, prompt: changedText } : call)),
  };
  assert.deepEqual(batteryGaps(changed.calls), []);
  const model = buildHistoryTrend({
    snapshots: [october11, changed],
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  assert.equal(model.boundaries.some((boundary) => boundary.promptSetChanged), true);
  assert.match(boundaryLabel(model.boundaries[0]), /Question set changed|wording changed/);
  const segments = trendSegments(model.series[0].points, boundaryBreaks(model.boundaries));
  assert.ok(segments.length >= 2);
  const lineage = buildHistoryTrend({
    snapshots: [october11, changed],
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "lineage", promptKey: "p15" },
  });
  assert.equal(lineage.boundaries.some((boundary) => boundary.queryVersionChanged), true);
});

test("the earlier October 12 run joins both rates and cautions its two citations", () => {
  assert.equal(earlier.calls.length, 102);
  assert.equal(earlier.calls.filter((call) => call.call_status === "answered").length, 73);
  assert.equal(earlier.calls.filter((call) => call.call_status === "error").length, 29);
  assert.equal(earlier.citations.length, 2);
  assert.equal(earlier.storedCitationCount, 2);
  assert.equal(citationStorageCaution(EARLIER_OCTOBER_12_RUN_ID), CITATION_STORAGE_CAUTION);
  assert.match(CITATION_STORAGE_CAUTION, /mostly not stored/);
  assert.match(CITATION_STORAGE_CAUTION, /not evidence that the citation ecosystem changed/);
  assert.equal(citationStorageCaution(PUBLISHED_OCTOBER_12_RUN_ID), null);
  assert.equal(citationStorageCaution(OCTOBER_11_RUN_ID), null);
  assert.equal(october11.citations.length, 0);
  assert.equal(october11.storedCitationCount, 468);
  assert.equal(published.citations.length, 243);
  assert.equal(published.storedCitationCount, 243);
  for (const metric of ["unbranded_discovery", "branded_consideration"] as const) {
    const model = buildHistoryTrend({
      snapshots,
      metric,
      breakdown: "overall",
      fromDay: null,
      toDay: null,
      query: { kind: "all" },
    });
    assert.deepEqual(model.runIds, [...REVIEW_RUN_IDS]);
  }
  assert.match(read("components/v3/live/ai-search/CitationEcosystemPanel.tsx"), /data-ai-citation-caution/);
  assert.match(read("components/v3/live/ai-search/CitationEcosystemPanel.tsx"), /data-ai-citation-count/);
});

test("the published October 12 rates stay the current-run rates", () => {
  const unbranded = roleTally(published.calls, "unbranded_discovery");
  const branded = roleTally(published.calls, "branded_consideration");
  assert.deepEqual([unbranded.fenderWins, unbranded.resolved], [13, 23]);
  assert.deepEqual([branded.fenderWins, branded.resolved], [22, 23]);
  assert.equal(unbranded.winPct != null && unbranded.winPct.toFixed(1), "56.5");
  assert.equal(branded.winPct != null && branded.winPct.toFixed(1), "95.7");
  const model = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  const point = model.series[0].points.find((item) => item.runId === PUBLISHED_OCTOBER_12_RUN_ID);
  assert.ok(point);
  assert.equal(rateLabel(point), "56.5% (13 of 23 resolved)");
  assert.equal(point.notStored, 0);
  const behind = callsBehindPoint(published, point, "unbranded_discovery", { kind: "all" });
  assert.equal(behind.inRate.filter((call) => callOutcome(call) === "fender_win").length, point.wins);
  assert.equal(behind.inRate.length, point.resolved);
  assert.ok(behind.inRate.every((call) => call.audit_run_id === PUBLISHED_OCTOBER_12_RUN_ID));
  assert.ok(behind.outside.every((call) => call.audit_run_id === PUBLISHED_OCTOBER_12_RUN_ID));
  const keptOut = published.calls.filter((call) => {
    const role = questionRole(call);
    return role !== "unbranded_discovery" && role !== "branded_consideration";
  });
  assert.ok(keptOut.length > 0);
});

test("engine series reconcile, and a small engine sample stays labeled", () => {
  const overall = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  const engines = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "engine",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  for (const runId of overall.runIds) {
    const overallPoint = overall.series[0].points.find((point) => point.runId === runId);
    const enginePoints = engines.series.flatMap((series) => series.points.filter((point) => point.runId === runId));
    assert.ok(overallPoint);
    assert.equal(enginePoints.reduce((sum, point) => sum + point.wins, 0), overallPoint.wins);
    assert.equal(enginePoints.reduce((sum, point) => sum + point.resolved, 0), overallPoint.resolved);
    assert.equal(enginePoints.reduce((sum, point) => sum + point.notStored, 0), overallPoint.notStored);
  }
  const small = engines.series
    .flatMap((series) => series.points)
    .find((point) => point.runId === EARLIER_OCTOBER_12_RUN_ID && point.engine === "chatgpt");
  assert.ok(small);
  assert.equal(small.smallSample, true);
  assert.match(rateLabel(small), /Small sample/);
});

test("a historical snapshot never keeps another run's calls, and an empty list is not zero", () => {
  const mixed: AiSearchSnapshot = {
    ...october11,
    calls: [...october11.calls, { ...published.calls[0], audit_run_id: published.run.audit_run_id }],
  };
  const kept = callsForRun(mixed);
  assert.equal(kept.length, october11.calls.length);
  assert.ok(kept.every((call) => call.audit_run_id === OCTOBER_11_RUN_ID));
  const empty: AiSearchSnapshot = { ...published, calls: [], probes: [], citations: [] };
  const model = buildHistoryTrend({
    snapshots: [october11, empty],
    metric: "branded_consideration",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  const point = model.series[0].points.find((item) => item.runId === PUBLISHED_OCTOBER_12_RUN_ID);
  assert.ok(point);
  assert.equal(point.callsLoaded, false);
  assert.equal(point.winPct, null);
  assert.equal(rateLabel(point), "Calls not available");
  const one = buildHistoryTrend({
    snapshots: [published],
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  assert.equal(one.status, "one-run");
  assert.equal(one.message, ONE_RUN_TREND_MESSAGE);
});

test("the migration names only the two additional runs and does not write rows", () => {
  const sql = read("supabase/migrations/20261014190000_ai_search_history_views.sql");
  const named = [...sql.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(named)].sort(), [OCTOBER_11_RUN_ID, EARLIER_OCTOBER_12_RUN_ID].sort());
  assert.equal(named.includes(PUBLISHED_OCTOBER_12_RUN_ID), false);
  assert.match(sql, /JOIN canvas_private\.ai_history_runs r ON r\.id = s\.audit_run_id/);
  assert.match(sql, /record_origin = 'historical_backfill'/);
  assert.match(sql, /historical_unverified/);
  assert.match(sql, /collector_version = 'v11'/);
  assert.match(sql, /r\.is_published/);
  assert.match(sql, /count\(\*\) FILTER \(WHERE s\.call_status = 'answered'\)/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.%I TO anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /^\s*(UPDATE|INSERT|DELETE|ALTER TABLE)\b/m);
  assert.doesNotMatch(sql, /GRANT INSERT|GRANT UPDATE|GRANT DELETE|GRANT ALL/);
  assert.match(sql, /Question role is not stored/);
  assert.equal(historyViewMissing({ message: "Could not find the table public.canvas_ai_history_runs in the schema cache", code: "PGRST205" }), true);
  assert.equal(utcDay("2026-10-12T17:02:36.755Z"), "2026-10-12");
});

test("month, range, and all keep the normal area description", () => {
  assert.equal(
    historySpokeDescription({
      mode: "month",
      source: "live",
      selectedPhase: "idle",
      selectedMessage: null,
      runDescription: "Current figures",
    }),
    null,
  );
  assert.equal(
    historySpokeDescription({
      mode: "range",
      source: "live",
      selectedPhase: "idle",
      selectedMessage: null,
      runDescription: "Current figures",
    }),
    null,
  );
  assert.equal(
    historySpokeDescription({
      mode: "all",
      source: "fixture",
      selectedPhase: "idle",
      selectedMessage: null,
      runDescription: "56.5%",
    }),
    null,
  );
  assert.equal(
    historySpokeDescription({
      mode: "all",
      source: "live",
      selectedPhase: "idle",
      selectedMessage: null,
      runDescription: "56.5%",
    }),
    null,
  );
  assert.match(
    historySpokeDescription({
      mode: "legacy",
      source: "fixture",
      selectedPhase: "idle",
      selectedMessage: null,
      runDescription: null,
    }) ?? "",
    /out of the trend/,
  );
  assert.equal(
    historySpokeDescription({
      mode: "run",
      source: "live",
      selectedPhase: "ready",
      selectedMessage: null,
      runDescription: "How AI shopping answers cite the web.",
    }),
    null,
  );
});

test("errors stay outside the plotted denominator", () => {
  const point = buildHistoryTrend({
    snapshots,
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  }).series[0].points.find((item) => item.runId === EARLIER_OCTOBER_12_RUN_ID);
  assert.ok(point);
  assert.equal(point.errors, 9);
  const behind = callsBehindPoint(earlier, point, "unbranded_discovery", { kind: "all" });
  assert.equal(behind.inRate.some((call) => call.outcome === "error" || call.outcome === "unresolved"), false);
  assert.ok(behind.outside.some((call) => call.outcome === "error"));
  const stray = { ...earlier.calls[0], audit_run_id: "other-run" } as AiCallRow;
  const polluted: AiSearchSnapshot = { ...earlier, calls: [...earlier.calls, stray] };
  const kept = callsBehindPoint(polluted, point, "unbranded_discovery", { kind: "all" });
  assert.ok(kept.inRate.every((call) => call.audit_run_id === EARLIER_OCTOBER_12_RUN_ID));
  assert.ok(kept.outside.every((call) => call.audit_run_id === EARLIER_OCTOBER_12_RUN_ID));
});
