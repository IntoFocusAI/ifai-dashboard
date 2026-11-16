// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-default-window.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  clientWindowSnapshots,
  daySpan,
  defaultWindowBounds,
  defaultWindowLabel,
  defaultWindowRuns,
  LAST_30_DAYS_LABEL,
  latestPublishedDay,
  NO_WINDOW_RUN_HEADING,
  noWindowRunLine,
  snapshotHasAnswers,
  windowRunExclusion,
} from "../lib/ai-search/default-window.ts";
import { displayedAiRead, EMPTY_SELECTION_MESSAGE } from "../lib/ai-search/displayed-read.ts";
import type { HistoryRunSummary } from "../lib/ai-search/history-eligibility.ts";
import { historyFixtureSnapshot, historyFixtureSummaries } from "../lib/ai-search/history-fixtures.ts";
import { DEFAULT_HISTORY_MODE, historyControlLabel, windowBounds } from "../lib/ai-search/history-mode.ts";
import { EARLIER_OCTOBER_12_RUN_ID, OCTOBER_11_RUN_ID, PUBLISHED_OCTOBER_12_RUN_ID } from "../lib/ai-search/review-runs.ts";
import type { AiSearchSnapshot } from "../lib/ai-search/types.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const HASH = "7336a48b5f1b2e7be7136319aee3d454";

function run(id: string, publishedAt: string | null, patch: Partial<HistoryRunSummary> = {}): HistoryRunSummary {
  return {
    audit_run_id: id,
    run_kind: "ai_simulation",
    run_state: "partial",
    collector_version: "v11",
    prompt_set_hash: HASH,
    expected_calls: 2040,
    attempted_calls: 2040,
    answered_calls: 1400,
    error_calls: 640,
    is_published: publishedAt != null,
    published_at: publishedAt,
    completed_at: publishedAt ?? "2026-11-02T10:00:00.000Z",
    ...patch,
  };
}

/** Shaped like the live catalog on 4 Nov 2026, plus one run of each kind the window must leave out. */
const catalog: HistoryRunSummary[] = [
  run("oct-04", "2026-10-04T23:59:00.000Z"),
  run("oct-05", "2026-10-05T00:01:00.000Z"),
  run(OCTOBER_11_RUN_ID, null, { run_state: "historical", collector_version: "v10", prompt_set_hash: null, expected_calls: null, attempted_calls: 100, answered_calls: 100, error_calls: 0, completed_at: "2026-10-11T06:02:56.839Z" }),
  run(EARLIER_OCTOBER_12_RUN_ID, null, { expected_calls: 102, attempted_calls: 102, answered_calls: 73, error_calls: 29, completed_at: "2026-10-12T16:22:53.453Z" }),
  run(PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:02:36.755Z", { expected_calls: 102, attempted_calls: 102 }),
  run("oct-29", "2026-10-29T22:30:58.749Z"),
  run("nov-01", "2026-11-01T22:30:45.411Z"),
  run("nov-02-unpublished", null, { completed_at: "2026-11-02T09:00:00.000Z" }),
  run("nov-02-failed", "2026-11-02T12:00:00.000Z", { run_state: "failed" }),
  run("nov-02-fragment", "2026-11-02T13:00:00.000Z", { attempted_calls: 5 }),
  run("nov-02-empty", "2026-11-02T20:00:00.000Z", { answered_calls: 0, error_calls: 2040 }),
  run("nov-03", "2026-11-03T21:31:28.043Z"),
  run("dec-01", "2026-12-01T08:00:00.000Z"),
];

test("AI Search opens on the last 30 days ending on the published run, named on the shared pill", () => {
  assert.deepEqual(DEFAULT_HISTORY_MODE, { kind: "month" });
  assert.equal(historyControlLabel(DEFAULT_HISTORY_MODE, "2026-11-03", null), "Last 30 days · Oct 5 to Nov 3, 2026");
  assert.equal(historyControlLabel(DEFAULT_HISTORY_MODE, null, null), "Last 30 days");
  assert.equal(LAST_30_DAYS_LABEL, "Last 30 days");
  assert.deepEqual(windowBounds(DEFAULT_HISTORY_MODE, "2026-11-03"), { from: "2026-10-05", to: "2026-11-03" });
  assert.deepEqual(windowBounds({ kind: "all" }, "2026-11-03"), { from: null, to: null });
  assert.deepEqual(windowBounds({ kind: "range", from: "2026-10-01", to: "2026-10-15" }, "2026-11-03"), {
    from: "2026-10-01",
    to: "2026-10-15",
  });
  assert.equal(
    historyControlLabel({ kind: "run", runId: "nov-03" }, "2026-11-03", null, "nov-03"),
    "Published run · Nov 3, 2026",
  );
});

test("the window is 30 UTC days with both ends included, and the pill keeps the year when it crosses one", () => {
  assert.deepEqual(defaultWindowBounds("2026-11-03"), { from: "2026-10-05", to: "2026-11-03" });
  assert.deepEqual(defaultWindowBounds("2027-01-10"), { from: "2026-12-12", to: "2027-01-10" });
  assert.deepEqual(defaultWindowBounds("2028-03-01"), { from: "2028-02-01", to: "2028-03-01" });
  assert.equal(defaultWindowBounds(null), null);
  assert.equal(defaultWindowBounds("Nov 3"), null);
  assert.equal(daySpan({ from: "2026-10-05", to: "2026-11-03" }), "Oct 5 to Nov 3, 2026");
  assert.equal(defaultWindowLabel("2027-01-10"), "Last 30 days · Dec 12, 2026 to Jan 10, 2027");
});

test("the window counts published runs with answers and leaves out failed, empty, and unpublished runs", () => {
  const window = defaultWindowRuns(catalog, "2026-11-03");
  assert.deepEqual(window.bounds, { from: "2026-10-05", to: "2026-11-03" });
  assert.deepEqual(
    window.included.map((item) => item.audit_run_id),
    ["oct-05", PUBLISHED_OCTOBER_12_RUN_ID, "oct-29", "nov-01", "nov-03"],
  );
  assert.deepEqual(
    window.excluded.map((item) => [item.run.audit_run_id, item.reason]),
    [
      [OCTOBER_11_RUN_ID, "unpublished"],
      [EARLIER_OCTOBER_12_RUN_ID, "unpublished"],
      ["nov-02-unpublished", "unpublished"],
      ["nov-02-failed", "outside-review"],
      ["nov-02-fragment", "outside-review"],
      ["nov-02-empty", "no-answers"],
    ],
  );
  const ids = [...window.included, ...window.excluded.map((item) => item.run)].map((item) => item.audit_run_id);
  assert.ok(!ids.includes("oct-04"), "the day before the window stays out");
  assert.ok(!ids.includes("dec-01"), "a run after the published run stays out");
});

test("a window with no published run has no client runs, and the copy says so plainly", () => {
  assert.deepEqual(defaultWindowRuns(catalog, "2027-03-04").included, []);
  assert.deepEqual(defaultWindowRuns(catalog, null), { bounds: null, included: [], excluded: [] });
  assert.equal(NO_WINDOW_RUN_HEADING, "No published run in the last 30 days");
  assert.equal(noWindowRunLine("2026-11-03"), "No run published between Oct 5 and Nov 3, 2026 has answered calls.");
  assert.equal(noWindowRunLine(null), "No run published in the last 30 days has answered calls.");
  assert.equal(windowRunExclusion(run("x", "2026-11-03T00:00:00.000Z", { answered_calls: null })), null);
});

test("the stored-run copy ends its window on its own latest published run", () => {
  assert.equal(latestPublishedDay(historyFixtureSummaries()), "2026-10-12");
  assert.deepEqual(
    defaultWindowRuns(historyFixtureSummaries(), "2026-10-12").included.map((item) => item.audit_run_id),
    [PUBLISHED_OCTOBER_12_RUN_ID],
  );
  assert.equal(latestPublishedDay([]), null);
});

function withCalls(snapshot: AiSearchSnapshot, status: "ok" | "error", published = true): AiSearchSnapshot {
  return {
    ...snapshot,
    run: { ...snapshot.run, is_published: published },
    calls: snapshot.calls.map((call) =>
      status === "error" ? { ...call, call_status: "error", outcome: "error" } : call,
    ),
  };
}

test("loaded runs whose calls are all provider errors, or that are unpublished, never enter the window's figures", () => {
  const published = historyFixtureSnapshot(PUBLISHED_OCTOBER_12_RUN_ID);
  const earlier = historyFixtureSnapshot(EARLIER_OCTOBER_12_RUN_ID);
  assert.ok(published && earlier);
  const failed = withCalls({ ...earlier, run: { ...earlier.run, audit_run_id: "all-errors" } }, "error");
  assert.equal(snapshotHasAnswers(published), true);
  assert.equal(snapshotHasAnswers(failed), false);
  assert.equal(snapshotHasAnswers({ ...published, calls: [] }), false);

  const kept = clientWindowSnapshots([published, failed, earlier]);
  assert.deepEqual(
    kept.map((snapshot) => snapshot.run.audit_run_id),
    [PUBLISHED_OCTOBER_12_RUN_ID],
  );

  const current = { phase: "ready" as const, snapshot: published };
  const pooled = displayedAiRead(DEFAULT_HISTORY_MODE, { phase: "idle" }, { phase: "ready", snapshots: kept }, current);
  assert.equal(pooled.phase, "ready");
  if (pooled.phase !== "ready") return;
  assert.equal(pooled.snapshot.calls.length, published.calls.length);
  assert.ok(pooled.snapshot.calls.every((call) => call.audit_run_id === PUBLISHED_OCTOBER_12_RUN_ID));

  const none = clientWindowSnapshots([failed, earlier]);
  assert.deepEqual(
    displayedAiRead(DEFAULT_HISTORY_MODE, { phase: "idle" }, { phase: "ready", snapshots: none }, current),
    { phase: "error", message: EMPTY_SELECTION_MESSAGE, selection: "empty" },
  );
});

test("the provider opens on the default, filters the window's loaded runs, and never resets a picked window", () => {
  const context = read("components/v3/live/ai-search/AiHistoryContext.tsx");
  assert.match(context, /useState<HistoryMode>\(DEFAULT_HISTORY_MODE\)/);
  assert.match(context, /runsInSelection\(catalog\.runs, mode, windowEnd\)/);
  // The window rule is shared with the server download, so both read the same runs.
  assert.match(
    read("lib/ai-search/selection.ts"),
    /if \(mode\.kind === "month"\) return defaultWindowRuns\(runs, windowEnd\)\.included;/,
  );
  assert.match(context, /snapshots: clientWindowSnapshots\(loaded\.snapshots\)/);
  assert.match(context, /const windowEnd = source === "fixture" \? latestPublishedDay\(fixtureRuns\) : liveEnd;/);
  // The published run's row gives the window its end before the run's calls load; the full read wins once ready.
  assert.match(context, /const liveEnd = publishedDay \?\? \(current\.phase === "loading" \? earlyDay : null\);/);
  assert.equal((context.match(/setMode\(/g) ?? []).length, 6, "only the six view callbacks change the window");
  assert.equal((context.match(/setMode\(\{ kind: "month" \}\)/g) ?? []).length, 1);
});

test("the pill offers the last 30 days and the latest run, and an empty window offers the latest run", () => {
  const control = read("components/v3/live/ai-search/RunHistoryControl.tsx");
  assert.match(control, /data-ai-history-last-30-days/);
  assert.match(control, /\{LAST_30_DAYS_LABEL\}/);
  assert.match(control, /data-ai-history-latest-run\s+onClick=\{\(\) => \{ history\.viewPublished\(\); setOpen\(false\); \}\}/);
  const gate = read("components/v3/live/ai-search/AiReadGate.tsx");
  assert.match(gate, /read\.selection === "empty" && history\?\.mode\.kind === "month"\) return <NoWindowRunNotice \/>/);
  const notice = read("components/v3/live/ai-search/NoWindowRunNotice.tsx");
  assert.match(notice, /onClick=\{history\?\.viewPublished\}/);
  assert.match(notice, /noWindowRunLine\(history\?\.windowEnd\)/);
  assert.doesNotMatch(notice, /\btitle=/);
  for (const path of [
    "components/v3/live/ai-search/AiReadGate.tsx",
    "components/v3/live/ai-search/RunHistoryControl.tsx",
    "components/v3/live/ai-search/NoWindowRunNotice.tsx",
    "lib/ai-search/history-mode.ts",
    "lib/ai-search/default-window.ts",
    "lib/ai-search/definitions.ts",
  ]) {
    assert.doesNotMatch(read(path), /[Ll]atest month|calendar month/, path);
  }
});
