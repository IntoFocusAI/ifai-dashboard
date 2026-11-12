// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/fact-check-accuracy-lead.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { driftRead } from "../lib/ai-search/drift.ts";
import {
  factCheckAccuracyStatus,
  factCheckAccuracyLead,
  factCheckAccuracyPie,
  factCheckAccuracyPieTip,
  factCheckHeadline,
} from "../lib/ai-search/fact-check-copy.ts";
import { pct } from "../lib/ai-search/summary.ts";
import type { AiProbeRow } from "../lib/ai-search/types.ts";

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

test("accuracy lead matches satellite formula and population wording", () => {
  const probes = [
    probe({ sim_id: 1, prompt_key: "p1", engine: "chatgpt" }),
    probe({ sim_id: 2, prompt_key: "p1", engine: "gemini" }),
    probe({
      sim_id: 3,
      prompt_key: "p2",
      engine: "chatgpt",
      material_hallucination: "confirmed",
      hallucination_evidence: "Said 7.25",
    }),
  ];
  const coverage = driftRead([], probes).coverage;
  assert.equal(coverage.answersChecked, 3);
  assert.equal(coverage.contradictions, 1);
  const lead = factCheckAccuracyLead(coverage);
  assert.equal(lead.checked, 3);
  assert.equal(lead.matched, 2);
  assert.equal(lead.contradictions, 1);
  assert.equal(lead.rate, pct(2, 3));
  assert.equal(lead.rate, "66.7%");
  assert.equal(lead.population, "2 of 3 answers matched.");
  assert.equal(lead.tone, "danger");
  assert.equal(factCheckAccuracyStatus(lead.tone), "bad");
});

test("perfect accuracy is 100.0% green with a single pie slice", () => {
  const probes = [
    probe({ sim_id: 1, prompt_key: "p1", engine: "chatgpt" }),
    probe({ sim_id: 2, prompt_key: "p1", engine: "gemini" }),
  ];
  const coverage = driftRead([], probes).coverage;
  const lead = factCheckAccuracyLead(coverage);
  assert.equal(lead.rate, "100.0%");
  assert.equal(lead.tone, "success");
  assert.equal(factCheckAccuracyStatus(lead.tone), "good");
  const pie = factCheckAccuracyPie(coverage);
  assert.ok(pie);
  assert.equal(pie.id, "accuracy");
  assert.equal(pie.total, 2);
  assert.deepEqual(
    pie.slices.map((slice) => slice.key),
    ["matched"],
  );
  assert.match(factCheckAccuracyPieTip(coverage), /2 answers matched/);
  assert.match(factCheckAccuracyPieTip(coverage), /0 answers contradicted/);
});

test("satellite yellow band includes 95% and 98%", () => {
  const twenty = Array.from({ length: 20 }, (_, i) =>
    probe({
      sim_id: i + 1,
      prompt_key: `p${i}`,
      engine: i % 2 ? "chatgpt" : "gemini",
      material_hallucination: i < 1 ? "confirmed" : "none",
      hallucination_evidence: i < 1 ? "Wrong radius" : null,
    }),
  );
  // 19 of 20 = 95.0% -> yellow
  assert.equal(factCheckAccuracyLead(driftRead([], twenty).coverage).tone, "warning");
  assert.equal(
    factCheckAccuracyStatus(factCheckAccuracyLead(driftRead([], twenty).coverage).tone),
    "okay",
  );

  const fifty = Array.from({ length: 50 }, (_, i) =>
    probe({
      sim_id: i + 1,
      prompt_key: `p${i}`,
      engine: "chatgpt",
      material_hallucination: i < 1 ? "confirmed" : "none",
      hallucination_evidence: i < 1 ? "Wrong" : null,
    }),
  );
  // 49 of 50 = 98.0% -> yellow (closed high end)
  assert.equal(factCheckAccuracyLead(driftRead([], fifty).coverage).tone, "warning");
});

test("empty checks show no percentage, tone, or pie", () => {
  const emptyCoverage = driftRead([], []).coverage;
  const empty = factCheckAccuracyLead(emptyCoverage);
  assert.equal(empty.rate, null);
  assert.equal(empty.population, null);
  assert.equal(empty.tone, null);
  assert.equal(empty.ratePct, null);
  assert.equal(factCheckAccuracyStatus(empty.tone), null);
  assert.equal(factCheckAccuracyPie(emptyCoverage), null);
  assert.equal(factCheckHeadline(emptyCoverage), "This run sent no product fact checks.");

  const failedOnly = [
    probe({
      sim_id: 1,
      prompt_key: "p1",
      engine: "chatgpt",
      call_status: "error",
      material_hallucination: "not_evaluated",
      verified_claim: null,
    }),
  ];
  const failedCoverage = driftRead([], failedOnly).coverage;
  const failedLead = factCheckAccuracyLead(failedCoverage);
  assert.equal(failedLead.rate, null);
  assert.equal(factCheckAccuracyPie(failedCoverage), null);
  assert.doesNotMatch(String(failedLead.rate ?? ""), /100/);
  assert.match(factCheckHeadline(failedCoverage), /No product fact check completed/);
});
