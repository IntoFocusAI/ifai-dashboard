// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-client-collector.test.ts
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";
import { defaultWindowRuns, latestPublishedDay } from "../lib/ai-search/default-window.ts";
import {
  isTrustworthyRun,
  trustedCollectorVersion,
  type HistoryRunSummary,
} from "../lib/ai-search/history-eligibility.ts";
import { isReviewHistoryRun } from "../lib/ai-search/review-runs.ts";

/* Ledlenser's AI Search read "No published run in the last 30 days" while its schema held two
   published runs. The client-side trust rule pinned Fender's collector name (v11) for every
   client, so both Ledlenser runs (collector ledlenser_ai_v1) fell outside the review history.
   Ledlenser's own history view has no collector pin. */

afterEach(() => resetActiveClientForTests(null));

/** The two runs in ledlenser.canvas_ai_run_history on 9 Nov 2026. */
const LEDLENSER_RUNS: HistoryRunSummary[] = [
  {
    audit_run_id: "4a5eda65-6493-4565-a7c5-6094a1a3c39a",
    run_kind: "ai_simulation",
    run_state: "partial",
    collector_version: "ledlenser_ai_v1",
    prompt_set_hash: "043c0f29c42dfc076ae08ec781466526",
    expected_calls: 363,
    attempted_calls: 363,
    answered_calls: 276,
    error_calls: 87,
    is_published: true,
    published_at: "2026-11-05T10:30:21.867983+00:00",
    started_at: null,
    completed_at: "2026-11-05T10:30:19.909+00:00",
  },
  {
    audit_run_id: "807cea45-ab80-4881-a331-198aadddc1f8",
    run_kind: "ai_simulation",
    run_state: "partial",
    collector_version: "ledlenser_ai_v1",
    prompt_set_hash: "043c0f29c42dfc076ae08ec781466526",
    expected_calls: 366,
    attempted_calls: 366,
    answered_calls: 291,
    error_calls: 75,
    is_published: true,
    published_at: "2026-11-07T02:30:23.769284+00:00",
    started_at: "2026-11-06T08:00:25.864+00:00",
    completed_at: "2026-11-07T02:30:22.029+00:00",
  },
];

test("Fender's history pins collector v11; Ledlenser's has no collector pin", () => {
  assert.equal(trustedCollectorVersion("public"), "v11");
  assert.equal(trustedCollectorVersion("ledlenser"), null);
  resetActiveClientForTests("ledlenser");
  assert.equal(trustedCollectorVersion(), null);
  resetActiveClientForTests("fender");
  assert.equal(trustedCollectorVersion(), "v11");
});

test("Ledlenser's published runs count in its last 30 days", () => {
  resetActiveClientForTests("ledlenser");
  assert.ok(LEDLENSER_RUNS.every(isTrustworthyRun));
  assert.ok(LEDLENSER_RUNS.every(isReviewHistoryRun));
  assert.equal(latestPublishedDay(LEDLENSER_RUNS), "2026-11-07");
  const window = defaultWindowRuns(LEDLENSER_RUNS, "2026-11-07");
  assert.deepEqual(
    window.included.map((run) => run.audit_run_id.slice(0, 8)),
    ["4a5eda65", "807cea45"],
  );
  assert.deepEqual(window.excluded, []);
});

test("the other trust rules still apply to Ledlenser runs", () => {
  resetActiveClientForTests("ledlenser");
  const [run] = LEDLENSER_RUNS;
  assert.equal(isTrustworthyRun({ ...run, is_published: false }), false);
  assert.equal(isTrustworthyRun({ ...run, run_state: "running" }), false);
  assert.equal(isTrustworthyRun({ ...run, attempted_calls: 0 }), false);
  assert.equal(isTrustworthyRun({ ...run, prompt_set_hash: null }), false);
  assert.equal(isTrustworthyRun({ ...run, published_at: null }), false);
});

test("Fender still leaves out a run from another collector", () => {
  resetActiveClientForTests("fender");
  const [run] = LEDLENSER_RUNS;
  assert.equal(isTrustworthyRun(run), false);
  assert.equal(isTrustworthyRun({ ...run, collector_version: "v11" }), true);
  assert.deepEqual(defaultWindowRuns(LEDLENSER_RUNS, "2026-11-07").included, []);
});
