// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/citation-filters.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CITATION_QUESTIONS,
  answeredEngines,
  coveringChoice,
  engineKindLabel,
  presetEngines,
  presetForEngines,
  questionScope,
  snapshotForEngines,
  snapshotForQuestion,
  toggleEngine,
} from "../lib/ai-search/citation-filters.ts";
import type { AiCallRow, AiCitationRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function snapshot(): AiSearchSnapshot {
  const call = (id: string, engine: string, kind: string, prompt: string, status = "answered"): AiCallRow =>
    ({ id, audit_run_id: "r", sim_id: Number(id.replace(/\D/g, "")), engine, prompt_kind: kind, prompt, call_status: status }) as AiCallRow;
  const calls = [
    call("c1", "chatgpt", "commercial", "Best electric guitar for beginners"),
    call("c2", "gemini", "commercial", "Fender Stratocaster vs Gibson Les Paul"),
    call("c3", "openai_api", "commercial", "Best electric guitar for beginners"),
    call("c4", "chatgpt", "probe", "Neck radius of the Player II Stratocaster"),
    call("c5", "claude_api", "commercial", "Best acoustic guitar", "error"),
  ];
  const citations = calls.map((row, index) => ({ simulation_id: row.id, url: `https://site${index}.com/a`, position: 1 }) as AiCitationRow);
  return {
    run: { audit_run_id: "r", attempted_calls: 5, answered_calls: 4 } as AiSearchSnapshot["run"],
    calls,
    probes: [],
    citations,
  };
}

test("decision 86: one question control with exactly five choices", () => {
  assert.deepEqual(
    CITATION_QUESTIONS.map(([, label]) => label).join(" | "),
    "All shopping | Unbranded shopping | Branded shopping | Product fact checks | All answers",
  );
  assert.equal(questionScope("unbranded"), "commercial");
  assert.equal(questionScope("probe"), "probe");
  assert.equal(questionScope("all"), "all");
});

test("engine labels say (search) or (API), so the two kinds stay apart", () => {
  assert.equal(engineKindLabel("chatgpt"), "ChatGPT (search)");
  assert.equal(engineKindLabel("openai_api"), "ChatGPT (API)");
  assert.equal(engineKindLabel("claude_api"), "Claude (API)");
});

test("chips list only engines with an answer; presets set the chips; any other mix is Custom", () => {
  const snap = snapshot();
  const available = answeredEngines([snap]);
  assert.deepEqual(available, ["chatgpt", "gemini", "openai_api"], "search first, and no chip for an engine with no answer");
  assert.deepEqual(presetEngines("search", available), ["chatgpt", "gemini"]);
  assert.deepEqual(presetEngines("api", available), ["openai_api"]);
  assert.equal(presetForEngines(available, available), "all");
  assert.equal(presetForEngines(["gemini", "chatgpt"], available), "search");
  assert.equal(presetForEngines(["openai_api"], available), "api");
  assert.equal(presetForEngines(["chatgpt", "openai_api"], available), "custom");
  assert.equal(presetForEngines(["chatgpt"], available), "custom");
  // Without API engines (Ledlenser), every chip on is All.
  assert.equal(presetForEngines(["chatgpt", "gemini"], ["chatgpt", "gemini"], ["all"]), "all");
  assert.equal(coveringChoice(["chatgpt"]), "search");
  assert.equal(coveringChoice(["openai_api"]), "api");
  assert.equal(coveringChoice(["chatgpt", "openai_api"]), "all");
  assert.deepEqual(toggleEngine(["chatgpt", "gemini"], "gemini"), ["chatgpt"]);
  assert.deepEqual(toggleEngine(["chatgpt"], "chatgpt"), ["chatgpt"], "the last chip stays on");
  assert.deepEqual(toggleEngine(["chatgpt"], "openai_api"), ["chatgpt", "openai_api"]);
});

test("the chips and the question narrow calls and the citations that join to them", () => {
  const snap = snapshot();
  const chat = snapshotForEngines(snap, ["chatgpt"]);
  assert.deepEqual(chat.calls.map((row) => row.id), ["c1", "c4"]);
  assert.deepEqual(chat.citations.map((row) => row.simulation_id), ["c1", "c4"]);
  assert.equal(chat.run.attempted_calls, 2);
  assert.equal(snapshotForEngines(snap, null), snap);
  assert.deepEqual(snapshotForQuestion(snap, "unbranded").calls.map((row) => row.id), ["c1", "c3", "c5"]);
  assert.deepEqual(snapshotForQuestion(snap, "branded").calls.map((row) => row.id), ["c2"]);
  assert.equal(snapshotForQuestion(snap, "shopping"), snap);
});

test("Citation Ecosystem wires the chips beside the presets and the question control into the hero", () => {
  const dir = "components/v3/live/ai-search";
  const panel = read(`${dir}/CitationEcosystemPanel.tsx`);
  assert.match(panel, /snapshotForQuestion\(snapshotForEngines\(snapshot, narrowTo\), question\)/);
  assert.match(panel, /useAiExportScope\(\s*\{ citations: \{ question, scope, category, engines: narrowTo \} \},\s*filters\.readChoice,\s*\)/);
  const engineSwitch = read(`${dir}/EngineGroupSwitch.tsx`);
  assert.match(engineSwitch, /data-ai-engine-choice="custom">\s*Custom\s*</);
  assert.match(read(`${dir}/CitationHero.tsx`), /<CitationControlsStrip question=\{question\} onQuestion=\{onQuestion\} \/>/);
  assert.match(read(`${dir}/CitationEngineChips.tsx`), /if \(available\.length < 2\) return null;/);
});
