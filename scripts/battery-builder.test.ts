import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { callsPerRun, generateQuestions, MAX_COMBINATIONS, reviewQuestions, type BuilderVariable } from "../lib/battery-builder/generate.ts";
import { FENDER_PRESETS } from "../lib/battery-builder/presets.ts";
import { article, DEFAULT_FRAME, renderPrompt } from "../lib/battery-builder/render.ts";

const product = { item: "electric guitar", personaNoun: "player" };
const vars: BuilderVariable[] = [
  { name: "style", label: "Question style", slot: "frame", template: "{value}", values: [DEFAULT_FRAME, "Which brand makes the best {request}?"] },
  { name: "player", label: "Player", slot: "persona", template: "{value}", values: ["beginner", "intermediate"] },
  { name: "budget", label: "Budget", slot: "constraint", template: "{value}", values: ["under $500", "under $1,000"] },
  { name: "priority", label: "Top priority", slot: "clause", template: "cares most about {value}", values: ["resale value"] },
  { name: "upgrade", label: "Upgrade", slot: "context", template: "{value}", values: ["I'm upgrading from a Squier."] },
];

test("details land in their place in one natural sentence", () => {
  assert.equal(
    renderPrompt(product, vars, { player: "intermediate", budget: "under $1,000" }),
    "What is the best electric guitar under $1,000 for an intermediate player?",
  );
  assert.equal(
    renderPrompt(product, vars, { style: "Which brand makes the best {request}?", player: "beginner", priority: "resale value", upgrade: "I'm upgrading from a Squier." }),
    "Which brand makes the best electric guitar for a beginner player who cares most about resale value? I'm upgrading from a Squier.",
  );
  assert.equal(renderPrompt({ item: "guitar amp", personaNoun: "" }, vars, {}), "What is the best guitar amp?");
  assert.equal(article("intermediate"), "an");
  assert.equal(article("one-piece neck"), "a");
});

test("one detail at a time: a starting question, then one question per value that differs from it", () => {
  const set = generateQuestions(product, vars, { mode: "one_at_a_time", baseline: { player: "intermediate", budget: "under $1,000" }, tested: ["player", "budget"] });
  assert.deepEqual(
    set.questions.map((q) => `${q.kind}|${q.change}`),
    ["start|start", "test|Player = beginner", "test|Budget = under $500"],
  );
  for (const q of set.questions.slice(1)) {
    const differs = Object.keys({ ...q.attributes, ...set.questions[0].attributes }).filter((k) => q.attributes[k] !== set.questions[0].attributes[k]);
    assert.equal(differs.length, 1, q.text);
  }
  assert.deepEqual(set.notes, []);
});

test("every combination is the full grid, capped", () => {
  const set = generateQuestions(product, vars, { mode: "combination", baseline: {}, tested: ["player", "budget"] });
  assert.equal(set.questions.filter((q) => q.kind === "combination").length, 4);
  const many: BuilderVariable[] = ["a", "b", "c"].map((name) => ({
    name,
    label: name,
    slot: "constraint",
    template: "{value}",
    values: Array.from({ length: 8 }, (_, i) => `${name}${i}`),
  }));
  const capped = generateQuestions(product, many, { mode: "combination", baseline: {}, tested: ["a", "b", "c"] });
  assert.ok(capped.questions.length <= MAX_COMBINATIONS + 1);
  assert.equal(capped.notes.length, 1);
  assert.deepEqual(generateQuestions(product, vars, { mode: "one_at_a_time", baseline: {}, tested: [] }).notes, ["Pick at least one detail to vary."]);
});

test("review names the existing prompt with the same wording and the dashboard's role", () => {
  const set = generateQuestions(product, vars, { mode: "one_at_a_time", baseline: { budget: "under $1,000" }, tested: ["upgrade"] });
  const reviewed = reviewQuestions(set.questions, [
    { prompt_key: "p38", prompt_text: "what is the best  electric guitar under $1,000 for a player?", active: true },
  ]);
  assert.equal(reviewed[0].duplicateOf, "p38");
  assert.equal(reviewed[0].role, "unbranded_discovery");
  assert.equal(reviewed[1].duplicateOf, null);
  assert.equal(reviewed[1].role, "brand_associated_discovery");
  assert.equal(callsPerRun(10, 3, 3), 90);
});

test("every Fender preset question, one detail at a time, lands in a dashboard role", () => {
  for (const preset of FENDER_PRESETS) {
    const set = generateQuestions({ item: preset.item, personaNoun: preset.personaNoun }, preset.variables, {
      mode: "one_at_a_time",
      baseline: preset.baseline,
      tested: preset.variables.map((v) => v.name),
    });
    assert.ok(set.questions.length > 5, preset.label);
    for (const q of reviewQuestions(set.questions, [])) assert.notEqual(q.role, "other", q.text);
    for (const v of preset.variables) {
      if (preset.baseline[v.name]) assert.ok(v.values.includes(preset.baseline[v.name]), `${preset.label}: ${v.name}`);
    }
  }
  assert.deepEqual(FENDER_PRESETS.map((p) => p.category), ["electrics", "acoustics", "amps", "basses"]);
});

test("the page saves through the editor's save, one prompt at a time, and the editor links to it", () => {
  const page = readFileSync("components/v3/battery-builder/BatteryBuilder.tsx", "utf8");
  assert.match(page, /savePrompt\(null, q\.text, preset\.category\)/);
  assert.match(page, /disabled=\{saving \|\| locked \|\| chosen\.length === 0 \|\| overLimit \|\| !status\}/);
  assert.match(page, /client\.promptsEditable/);
  const editor = readFileSync("components/v3/prompts/PromptsEditor.tsx", "utf8");
  assert.match(editor, /\$\{DASHBOARD_PATH\}\/battery-builder/);
});

test("the dashboard header has a Build prompts button, only for clients edited from the dashboard", () => {
  const spec = readFileSync("lib/fender-canvas/build-canvas-spec.tsx", "utf8");
  assert.match(spec, /promptBuilderHref: activeClient\(\)\.promptsEditable \? `\$\{DASHBOARD_PATH\}\/battery-builder` : undefined/);
  const shell = readFileSync("lib/canvas-sdk/CanvasShell.tsx", "utf8");
  assert.match(shell, /spec\.promptBuilderHref \?/);
  assert.match(shell, /<span>Build prompts<\/span>/);
});
