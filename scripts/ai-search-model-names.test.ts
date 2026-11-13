// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-model-names.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyExplorerFilter, DEFAULT_FILTER } from "../lib/ai-search/explorer-filter.ts";
import { cleanModelName, engineTallies, modelLabel } from "../lib/ai-search/run-metrics.ts";
import type { AiCallRow } from "../lib/ai-search/types.ts";

/* Gemini's stored model name sometimes carries a no-break space or a left-to-right mark
   ("3.5 Flash-Lite", "‎3.5 Flash-Lite"). Those are one model, shown once. */

function call(id: string, model: string | null): AiCallRow {
  return {
    id,
    audit_run_id: "r1",
    sim_id: Number(id),
    engine: "gemini",
    model,
    category: "electrics",
    prompt: "Best electric guitar under $900",
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
    created_at: "2026-11-08T07:00:00Z",
  };
}

test("invisible characters in a model name are normalized for display", () => {
  assert.equal(modelLabel("3.5 Flash-Lite"), "3.5 Flash-Lite");
  assert.equal(modelLabel("‎3.5 Flash-Lite"), "3.5 Flash-Lite");
  assert.equal(modelLabel("3.5‎ Flash-Lite"), "3.5 Flash-Lite");
  assert.equal(modelLabel("  3.5 ​ Flash-Lite﻿ "), "3.5 Flash-Lite");
  assert.equal(modelLabel("‎"), "Not available*");
  assert.equal(modelLabel(null), "Not available*");
  assert.equal(cleanModelName(" "), "");
});

test("visible differences in a model name are kept as stored", () => {
  assert.equal(modelLabel("3.5 Flash Lite"), "3.5 Flash Lite");
  assert.equal(modelLabel("Flash-Lite"), "Flash-Lite");
  assert.equal(modelLabel("turbo"), "turbo");
});

test("an engine lists one model for names that differ only by invisible characters", () => {
  const rows = [call("1", "3.5 Flash-Lite"), call("2", "3.5 Flash-Lite"), call("3", "‎3.5 Flash-Lite")];
  assert.deepEqual(engineTallies(rows)[0].models, ["3.5 Flash-Lite"]);
});

test("the model filter matches every stored spelling of the model it shows", () => {
  const rows = [call("1", "3.5 Flash-Lite"), call("2", "3.5 Flash-Lite"), call("3", "turbo")];
  const matched = applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope: "all", model: "3.5 Flash-Lite" });
  assert.deepEqual(
    matched.map((row) => row.id),
    ["1", "2"],
  );
});
