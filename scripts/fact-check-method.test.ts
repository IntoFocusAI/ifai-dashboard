// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/fact-check-method.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { driftRead } from "../lib/ai-search/drift.ts";
import {
  DEFAULT_FILTER,
  applyExplorerFilter,
  factCheckColumnLabel,
} from "../lib/ai-search/explorer-filter.ts";
import { factCheckAccuracyLead, factCheckMethodStatement } from "../lib/ai-search/fact-check-copy.ts";
import type { AiCallRow, AiProbeRow } from "../lib/ai-search/types.ts";

function probe(partial: Partial<AiProbeRow> & Pick<AiProbeRow, "sim_id" | "prompt_key" | "engine">): AiProbeRow {
  return {
    audit_run_id: "r1",
    prompt: `Question ${partial.prompt_key}`,
    model: null,
    call_status: "answered",
    material_hallucination: "none",
    hallucination_evidence: null,
    verified_claim: "Neck radius is 9.5 inches",
    verified_source_url: "https://www.fender.com/example",
    verified_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function call(patch: Partial<AiCallRow>): AiCallRow {
  return {
    id: "row",
    audit_run_id: "r1",
    sim_id: 1,
    engine: "chatgpt",
    model: null,
    category: "electrics",
    prompt: "Prompt",
    prompt_key: "p01",
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

/** Shape of the published run: five fact-check questions, one with no verified fact, some failed calls. */
function publishedShape(): AiProbeRow[] {
  const rows: AiProbeRow[] = [];
  let sim = 1;
  for (const key of ["p17", "p18", "p19", "p33", "p34"]) {
    const noFact = key === "p18";
    for (const engine of ["chatgpt", "gemini", "perplexity"]) {
      const failed = engine === "perplexity";
      rows.push(
        probe({
          sim_id: sim++,
          prompt_key: key,
          engine,
          call_status: failed ? "error" : "answered",
          material_hallucination: failed || noFact ? "not_evaluated" : "none",
          verified_claim: noFact ? null : `Fact for ${key}`,
        }),
      );
    }
  }
  return rows;
}

test("method statement says N of M products, that the pick is not recorded, and what it covers", () => {
  const coverage = driftRead([], publishedShape()).coverage;
  assert.equal(coverage.questionsSent, 5);
  assert.equal(coverage.factsChecked, 4);
  assert.equal(
    factCheckMethodStatement(coverage),
    "The question set names 5 Fender products for fact checks. 4 of 5 were checked against a verified fact in this run. How these products were picked is not recorded, and neither is what part of Fender's catalog they stand for, so this result covers these 5 products only.",
  );
  assert.match(factCheckMethodStatement(coverage, true) ?? "", /in this selection\./);
});

test("method statement never calls the set representative and stays in client copy rules", () => {
  const one = driftRead([], [probe({ sim_id: 1, prompt_key: "p1", engine: "chatgpt" })]).coverage;
  const many = driftRead([], publishedShape()).coverage;
  for (const text of [factCheckMethodStatement(one), factCheckMethodStatement(many, true)]) {
    assert.ok(text);
    assert.doesNotMatch(text, /representative|random/i);
    assert.doesNotMatch(text, /\u2014/, "no em dash in client copy");
    assert.doesNotMatch(text, /regex|collector|probe/i);
  }
  assert.equal(
    factCheckMethodStatement(one),
    "The question set names 1 Fender product for fact checks. 1 of 1 was checked against a verified fact in this run. How this product was picked is not recorded, and neither is what part of Fender's catalog it stands for, so this result covers this product only.",
  );
});

test("no fact-check questions means no method statement", () => {
  assert.equal(factCheckMethodStatement(driftRead([], []).coverage), null);
});

test("adding the method statement leaves the Accuracy lead figure and colors unchanged", () => {
  const coverage = driftRead([], publishedShape()).coverage;
  const lead = factCheckAccuracyLead(coverage);
  assert.equal(lead.rate, "100.0%");
  assert.equal(lead.tone, "success");
  const panel = readFileSync("components/v3/live/ai-search/AiDriftPanel.tsx", "utf8");
  assert.match(panel, /factCheckMethodStatement\(coverage, windowed\)/);
  assert.match(panel, /color: rateColor/);
  assert.match(panel, /\{accuracy\.rate\} Accuracy/);
  // The statement sits in the explainer beside the Accuracy figure, right under the headline.
  const explainer = panel.slice(panel.indexOf("data-ai-accuracy-lead"), panel.indexOf("data-ai-accuracy-row"));
  const headlineAt = explainer.indexOf("data-ai-fact-headline");
  const methodAt = explainer.indexOf("data-ai-fact-method");
  assert.ok(headlineAt > 0 && methodAt > headlineAt, "method follows the headline");
  assert.ok(methodAt < explainer.indexOf("FACT_CHECK_SCOPE"), "method precedes the scope line");
  assert.doesNotMatch(explainer, /\btitle=/);
});

test("a fact-check result filter never returns a non-fact-check row", () => {
  const rows = [
    call({ id: "c1", sim_id: 1, prompt_kind: "commercial", material_hallucination: "not_evaluated" }),
    call({ id: "c2", sim_id: 2, prompt_kind: "commercial", material_hallucination: "confirmed" }),
    call({ id: "c3", sim_id: 3, prompt_kind: null, material_hallucination: "none" }),
    call({ id: "f1", sim_id: 4, prompt_kind: "probe", material_hallucination: "not_evaluated" }),
    call({ id: "f2", sim_id: 5, prompt_kind: "probe", material_hallucination: "none" }),
    call({ id: "f3", sim_id: 6, prompt_kind: "probe", material_hallucination: "confirmed" }),
  ];
  for (const scope of ["commercial", "probe", "all"] as const) {
    for (const accuracy of ["confirmed", "none", "not_evaluated", "unverified"] as const) {
      const matched = applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope, accuracy });
      for (const row of matched) {
        assert.equal(row.prompt_kind, "probe", `${scope}/${accuracy} matched ${row.id}`);
        assert.notEqual(factCheckColumnLabel(row), "n/a");
      }
    }
  }
  assert.deepEqual(
    applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope: "all", accuracy: "not_evaluated" }).map((r) => r.id),
    ["f1"],
  );
  // Without a fact-check result filter, shopping rows still list and read "n/a".
  const shopping = applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope: "all" }).filter(
    (row) => row.prompt_kind !== "probe",
  );
  assert.equal(shopping.length, 3);
  for (const row of shopping) assert.equal(factCheckColumnLabel(row), "n/a");
});

test("choosing a fact-check result on Shopping prompts moves the table to Product fact checks", () => {
  const filters = readFileSync("components/v3/live/ai-search/SimulationFilters.tsx", "utf8");
  assert.match(filters, /accuracy !== "" && filter\.scope === "commercial"/);
  assert.match(filters, /\{ accuracy, scope: "probe", category: "" \}/);
});
