import assert from "node:assert/strict";
import test from "node:test";

import { batteryGaps, BATTERY_ENGINES, PROMPT_BATTERY } from "../lib/ai-search/prompt-battery.ts";
import { questionRole } from "../lib/ai-search/question-role.ts";

const wave2 = PROMPT_BATTERY.filter((prompt) => prompt.wave === 2);
const wave1 = PROMPT_BATTERY.filter((prompt) => prompt.wave === undefined);

function callsFor(prompts: typeof PROMPT_BATTERY) {
  return prompts.flatMap((prompt) =>
    BATTERY_ENGINES.map((engine) => ({ prompt_key: prompt.key, prompt: prompt.text, prompt_kind: prompt.kind, engine })),
  );
}

test("wave 2 is p38 to p67: 30 commercial prompts with keys and wording of their own", () => {
  assert.equal(wave2.length, 30);
  assert.deepEqual(
    wave2.map((prompt) => prompt.key),
    Array.from({ length: 30 }, (_, index) => `p${index + 38}`),
  );
  assert.ok(wave2.every((prompt) => prompt.kind === "commercial"));
  assert.equal(new Set(PROMPT_BATTERY.map((prompt) => prompt.key)).size, PROMPT_BATTERY.length);
  assert.equal(new Set(PROMPT_BATTERY.map((prompt) => prompt.text.toLowerCase())).size, PROMPT_BATTERY.length);
  assert.ok(wave2.every((prompt) => ["electrics", "acoustics", "amps", "basses", "squier"].includes(prompt.category)));
});

test("wave 2 lands in the dashboard's question roles as designed", () => {
  const roles = new Map(wave2.map((prompt) => [prompt.key, questionRole({ prompt_kind: prompt.kind, prompt: prompt.text })]));
  // The two upgrade questions name a brand, so they stay out of the unbranded headline.
  assert.equal(roles.get("p63"), "brand_associated_discovery");
  assert.equal(roles.get("p64"), "brand_associated_discovery");
  assert.equal(roles.get("p67"), "branded_consideration");
  const rest = wave2.filter((prompt) => !["p63", "p64", "p67"].includes(prompt.key));
  assert.equal(rest.length, 27);
  for (const prompt of rest) assert.equal(roles.get(prompt.key), "unbranded_discovery", prompt.key);
});

test("a run from before wave 2 shows no wave 2 gaps", () => {
  const before = callsFor(wave1);
  assert.deepEqual(batteryGaps(before), []);
  const missingOne = before.slice(1);
  assert.equal(batteryGaps(missingOne).length, 1);
  assert.ok(batteryGaps(missingOne).every((gap) => !gap.promptKey.startsWith("p3") || Number(gap.promptKey.slice(1)) < 38));
});

test("a run that asked wave 2 names its missing wave 2 pairs", () => {
  const all = callsFor(PROMPT_BATTERY);
  assert.deepEqual(batteryGaps(all), []);
  const missing = all.filter((call) => !(call.prompt_key === "p54" && call.engine === "perplexity"));
  assert.deepEqual(
    batteryGaps(missing).map((gap) => `${gap.promptKey}|${gap.engine}`),
    ["p54|perplexity"],
  );
});
