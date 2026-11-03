// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/run-calls-line.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runCompleteness } from "../lib/ai-search/run-metrics.ts";
import { answeredOfCallsLine } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiCurrentRun } from "../lib/ai-search/types.ts";

const run = {
  audit_run_id: "window",
  run_state: "completed",
  expected_calls: null,
  answered_calls: null,
  error_calls: null,
  missing_calls: null,
} as unknown as AiCurrentRun;

const rows = (answered: number, errors: number): AiCallRow[] =>
  [
    ...Array.from({ length: answered }, () => ({ call_status: "answered" })),
    ...Array.from({ length: errors }, () => ({ call_status: "error" })),
  ] as AiCallRow[];

test("the Calls card reads answered of total, from the same call rows", () => {
  const c = runCompleteness(run, rows(4601, 2027));
  assert.equal(c.rowsRead, 6628);
  assert.equal(c.answeredRows, 4601);
  assert.equal(answeredOfCallsLine(c), "4,601 answered of 6,628 calls");
  assert.equal(answeredOfCallsLine(runCompleteness(run, rows(1, 0))), "1 answered of 1 call");
  assert.equal(answeredOfCallsLine(runCompleteness(run, rows(0, 3))), "0 answered of 3 calls");
});

test("the window Calls card no longer labels every row as answered", () => {
  const card = readFileSync("components/v3/live/ai-search/RunCompletenessCard.tsx", "utf8");
  assert.doesNotMatch(card, /Answered call rows/);
  assert.match(card, /<td>Calls in this selection<\/td>\s*<td data-ai-window-calls>\{answeredOfCallsLine\(s\.completeness\)\}<\/td>/);
});
