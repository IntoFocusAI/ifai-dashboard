// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/engine-unbranded-graph.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { unbrandedEnginesWeakestFirst } from "../components/v3/live/ai-search/engineUnbrandedGraph.ts";
import { QUESTION_ROLES, type RoleGroupTally } from "../lib/ai-search/question-role.ts";
import type { OutcomeTally } from "../lib/ai-search/run-metrics.ts";

function emptyTally(): OutcomeTally {
  return {
    calls: 0,
    answered: 0,
    resolved: 0,
    fenderWins: 0,
    disqualified: 0,
    competitorWins: 0,
    unresolved: 0,
    errors: 0,
    unsupported: 0,
    winPct: null,
  };
}

function engine(key: string, fenderWins: number, resolved: number): RoleGroupTally {
  const roles = Object.fromEntries(QUESTION_ROLES.map((role) => [role, emptyTally()])) as RoleGroupTally["roles"];
  roles.unbranded_discovery = {
    ...emptyTally(),
    calls: resolved,
    answered: resolved,
    resolved,
    fenderWins,
    winPct: resolved > 0 ? (100 * fenderWins) / resolved : null,
  };
  return { key, models: [], roles };
}

test("weakest Fender-lead share is first among engines with resolved unbranded answers", () => {
  const marks = unbrandedEnginesWeakestFirst([
    engine("chatgpt", 8, 10),
    engine("gemini", 2, 10),
    engine("perplexity", 5, 10),
  ]);
  assert.deepEqual(
    marks.map((row) => row.key),
    ["gemini", "perplexity", "chatgpt"],
  );
});

test("engines with no resolved unbranded answers are omitted, not drawn as 0%", () => {
  const marks = unbrandedEnginesWeakestFirst([
    engine("chatgpt", 3, 10),
    engine("gemini", 0, 0),
  ]);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].key, "chatgpt");
  assert.ok(marks[0].roles.unbranded_discovery.resolved > 0);
});

test("empty selection returns no marks", () => {
  assert.deepEqual(unbrandedEnginesWeakestFirst([engine("chatgpt", 0, 0)]), []);
});
