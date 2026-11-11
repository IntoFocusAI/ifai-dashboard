// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/failed-engine-results.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { aiSpokeHeaderChips } from "../lib/ai-search/canvas-surfaces.ts";
import { driftRead } from "../lib/ai-search/drift.ts";
import { factCheckCoverageNote, factCheckHeadline } from "../lib/ai-search/fact-check-copy.ts";
import {
  engineResultRoleTallies,
  engineRoleTallies,
} from "../lib/ai-search/question-role.ts";
import {
  engineResultTallies,
  engineTallies,
  isFailedResultEngine,
} from "../lib/ai-search/run-metrics.ts";
import { errorLine, summarizeRun } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiCurrentRun, AiProbeRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const RUN = "run-failed-engine";

const run: AiCurrentRun = {
  audit_run_id: RUN,
  run_state: "partial",
  collector_version: "v11",
  prompt_set_hash: "hash",
  expected_calls: 6,
  attempted_calls: 6,
  answered_calls: 3,
  error_calls: 3,
  started_at: "2026-10-12T16:29:33Z",
  completed_at: "2026-10-12T17:02:10Z",
  published_at: "2026-10-12T17:02:36Z",
  missing_calls: 0,
};

function call(id: string, patch: Partial<AiCallRow>): AiCallRow {
  return {
    id,
    audit_run_id: RUN,
    sim_id: Number(id.replace(/\D/g, "")),
    engine: "chatgpt",
    model: null,
    category: "electrics",
    prompt: "Best electric guitar under $900",
    prompt_key: `p${id}`,
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
    created_at: "2026-10-12T16:40:00Z",
    ...patch,
  };
}

/** ChatGPT and Gemini answered. Perplexity failed every commercial call (errors and empty). */
const calls: AiCallRow[] = [
  call("c1", { engine: "chatgpt" }),
  call("c2", { engine: "chatgpt", outcome: "competitor_win", primary_brand: "Gibson" }),
  call("c3", { engine: "gemini", model: "3.6 Flash", prompt: "Fender Player vs PRS SE" }),
  call("c4", {
    engine: "perplexity",
    call_status: "error",
    outcome: "error",
    primary_brand: null,
    error_message: "provider timeout",
  }),
  call("c5", {
    engine: "perplexity",
    call_status: "error",
    outcome: "error",
    primary_brand: null,
    error_message: "empty answer",
  }),
  call("c6", {
    engine: "perplexity",
    call_status: "error",
    outcome: "error",
    primary_brand: null,
    error_message: "empty answer",
  }),
];

const probes: AiProbeRow[] = [
  {
    audit_run_id: RUN,
    sim_id: 100,
    prompt_key: "p17",
    prompt: "Mustang Micro tubes?",
    engine: "chatgpt",
    model: null,
    call_status: "answered",
    material_hallucination: "none",
    hallucination_evidence: null,
    verified_claim: "No tubes.",
    verified_source_url: "https://www.fender.com/products/mustang-micro",
    verified_at: "2026-10-12T15:37:00Z",
    created_at: "2026-10-12T16:47:00Z",
  },
  {
    audit_run_id: RUN,
    sim_id: 101,
    prompt_key: "p17",
    prompt: "Mustang Micro tubes?",
    engine: "gemini",
    model: "3.6 Flash",
    call_status: "answered",
    material_hallucination: "none",
    hallucination_evidence: null,
    verified_claim: "No tubes.",
    verified_source_url: "https://www.fender.com/products/mustang-micro",
    verified_at: "2026-10-12T15:37:00Z",
    created_at: "2026-10-12T16:47:00Z",
  },
  {
    audit_run_id: RUN,
    sim_id: 102,
    prompt_key: "p17",
    prompt: "Mustang Micro tubes?",
    engine: "perplexity",
    model: "turbo",
    call_status: "error",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    verified_claim: "No tubes.",
    verified_source_url: "https://www.fender.com/products/mustang-micro",
    verified_at: "2026-10-12T15:37:00Z",
    created_at: "2026-10-12T16:47:00Z",
  },
];

const snapshot: AiSearchSnapshot = { run, calls, probes, citations: [] };

test("an engine with only errors or empty answers is a failed result engine", () => {
  const all = engineTallies(calls);
  const perplexity = all.find((engine) => engine.key === "perplexity");
  assert.ok(perplexity);
  assert.equal(perplexity.answered, 0);
  assert.equal(perplexity.errors, 3);
  assert.equal(isFailedResultEngine(perplexity), true);
  assert.equal(isFailedResultEngine(all.find((engine) => engine.key === "chatgpt")!), false);
});

test("failed engines are omitted from result tallies, not shown as 0%", () => {
  const results = engineResultTallies(calls);
  assert.deepEqual(
    results.map((engine) => engine.key),
    ["chatgpt", "gemini"],
  );
  assert.ok(results.every((engine) => engine.answered > 0));
  assert.equal(
    results.some((engine) => engine.key === "perplexity"),
    false,
  );

  const roleResults = engineResultRoleTallies(calls);
  assert.deepEqual(
    roleResults.map((engine) => engine.key),
    ["chatgpt", "gemini"],
  );
  assert.equal(engineRoleTallies(calls).some((engine) => engine.key === "perplexity"), true);
});

test("the run summary keeps the provider-error count and drops the failed engine from result engines", () => {
  const summary = summarizeRun(snapshot);
  assert.equal(
    summary.engines.some((engine) => engine.key === "perplexity"),
    false,
  );
  assert.ok(summary.engines.every((engine) => engine.key === "chatgpt" || engine.key === "gemini"));
  assert.match(errorLine(summary), /3 provider errors, all Perplexity/);
  assert.ok(summary.errorEngines.some((entry) => entry.engine === "perplexity" && entry.errors === 3));

  const chips = aiSpokeHeaderChips({ phase: "ready", snapshot });
  const errors = chips.find((chip) => chip.id === "errors");
  assert.ok(errors);
  assert.match(errors.value, /3 provider errors, all Perplexity/);
  assert.doesNotMatch(errors.value, /0%/);
});

test("product fact checks name engines that answered, and keep failures as a coverage note", () => {
  const coverage = driftRead(calls, probes).coverage;
  assert.deepEqual(coverage.checkedEngines, ["ChatGPT", "Gemini"]);
  assert.deepEqual(coverage.failedEngines, ["Perplexity"]);
  assert.equal(coverage.failedCalls, 1);
  assert.match(factCheckHeadline(coverage), /checked across ChatGPT and Gemini/);
  assert.doesNotMatch(factCheckHeadline(coverage), /Perplexity/);
  assert.equal(factCheckCoverageNote(coverage), "Perplexity did not return answers for 1 fact-check call.");
});

test("engines that returned answers still appear in result displays", () => {
  const results = engineResultRoleTallies(calls);
  assert.equal(results.length, 2);
  const chatgpt = results.find((engine) => engine.key === "chatgpt");
  const gemini = results.find((engine) => engine.key === "gemini");
  assert.ok(chatgpt);
  assert.ok(gemini);
  assert.ok(chatgpt.roles.unbranded_discovery.resolved > 0 || chatgpt.roles.branded_consideration.resolved > 0);
  assert.ok(gemini.roles.branded_consideration.resolved > 0);
});
