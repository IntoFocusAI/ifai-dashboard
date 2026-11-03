// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/one-run-window.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { displayedAiRead, EMPTY_SELECTION_MESSAGE } from "../lib/ai-search/displayed-read.ts";
import { historyFixtureSnapshot } from "../lib/ai-search/history-fixtures.ts";
import { buildHistoryTrend, ONE_RUN_TREND_MESSAGE } from "../lib/ai-search/history-trends.ts";
import { EARLIER_OCTOBER_12_RUN_ID, PUBLISHED_OCTOBER_12_RUN_ID } from "../lib/ai-search/review-runs.ts";
import { readsWindowRemotely } from "../lib/ai-search/window-read.ts";

const only = historyFixtureSnapshot(EARLIER_OCTOBER_12_RUN_ID);
const published = historyFixtureSnapshot(PUBLISHED_OCTOBER_12_RUN_ID);

test("a live window with one stored run reads it; only an empty window or the fixtures stay local", () => {
  assert.equal(readsWindowRemotely("live", 1), true);
  assert.equal(readsWindowRemotely("live", 9), true);
  assert.equal(readsWindowRemotely("live", 0), false);
  assert.equal(readsWindowRemotely("fixture", 1), false);
  assert.equal(readsWindowRemotely("fixture", 3), false);
  const context = readFileSync("components/v3/live/ai-search/AiHistoryContext.tsx", "utf8");
  assert.match(context, /if \(!readsWindowRemotely\(source, trusted\.length\)\) \{/);
  assert.doesNotMatch(context, /trusted\.length < 2/);
});

test("a date range holding one run shows that run, not an empty selection", () => {
  assert.ok(only && published);
  const range = { kind: "range" as const, from: "2026-10-12", to: "2026-10-12" };
  const read = displayedAiRead(range, { phase: "idle" }, { phase: "ready", snapshots: [only] }, { phase: "ready", snapshot: published });
  assert.equal(read.phase, "ready");
  if (read.phase !== "ready") return;
  assert.equal(read.snapshot.run.audit_run_id, EARLIER_OCTOBER_12_RUN_ID);
  assert.equal(read.snapshot.calls.length, only.calls.length);
  assert.equal(read.snapshot.probes.length, only.probes.length);

  const month = displayedAiRead({ kind: "month" }, { phase: "idle" }, { phase: "ready", snapshots: [only] }, { phase: "ready", snapshot: published });
  assert.equal(month.phase, "ready");

  const empty = displayedAiRead(range, { phase: "idle" }, { phase: "ready", snapshots: [] }, { phase: "ready", snapshot: published });
  assert.deepEqual(empty, { phase: "error", message: EMPTY_SELECTION_MESSAGE, selection: "empty" });
});

test("the trend for a one-run window says the trend starts after the next run", () => {
  assert.ok(only);
  const model = buildHistoryTrend({
    snapshots: [only],
    metric: "unbranded_discovery",
    breakdown: "overall",
    fromDay: null,
    toDay: null,
    query: { kind: "all" },
  });
  assert.equal(model.status, "one-run");
  assert.equal(model.message, ONE_RUN_TREND_MESSAGE);
});
