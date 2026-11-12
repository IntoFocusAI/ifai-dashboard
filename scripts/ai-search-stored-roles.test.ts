// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-stored-roles.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { questionRole } from "../lib/ai-search/question-role.ts";
import { storedQuestionRole } from "../lib/ai-search/stored-question-roles.ts";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";

/* Ledlenser's prompt battery stores each prompt's role (analytical_intent). The text rules were
   written for Fender's brands, so they read every Ledlenser branded question as unclassified
   and two brand-associated questions as unbranded discovery. The stored role wins. */

afterEach(() => resetActiveClientForTests(null));

const commercial = (prompt: string) => ({ prompt_kind: "commercial", prompt });

/** Every commercial prompt in the battery migration, with its analytical_intent. */
function batteryRoles(): Array<[string, string]> {
  const sql = readFileSync(new URL("../supabase/migrations/20261104170100_ledlenser_prompt_battery.sql", import.meta.url), "utf8");
  const rows = [...sql.matchAll(/\('l\d+', '((?:[^']|'')*)', '[a-z_]+', 'commercial', '([a-z_]+)',/g)];
  return rows.map((match) => [match[1].replace(/''/g, "'"), match[2]]);
}

test("every commercial prompt in Ledlenser's battery reads the role the battery stores", () => {
  resetActiveClientForTests("ledlenser");
  const rows = batteryRoles();
  assert.equal(rows.length, 29);
  for (const [prompt, intent] of rows) {
    assert.equal(questionRole(commercial(prompt)), intent, prompt);
  }
  const count = (role: string) => rows.filter(([, intent]) => intent === role).length;
  assert.equal(count("unbranded_discovery"), 14);
  assert.equal(count("branded_consideration"), 9);
  assert.equal(count("brand_associated_discovery"), 2);
});

test("Ledlenser's branded questions are branded consideration, and brand-associated ones leave unbranded discovery", () => {
  resetActiveClientForTests("ledlenser");
  assert.equal(questionRole(commercial("Ledlenser H7R vs Petzl Swift RL headlamp")), "branded_consideration");
  assert.equal(questionRole(commercial("Is the Ledlenser P5R worth it?")), "branded_consideration");
  assert.equal(questionRole(commercial("Best German-engineered flashlight brand")), "brand_associated_discovery");
  assert.equal(questionRole(commercial("What is the beam distance of the Ledlenser P7R?")), "product_fact");
  assert.equal(questionRole(commercial("What IP rating should a camping flashlight have?")), "shopping_guidance");
  // Spacing, case, and a collector's engine tag do not change the wording.
  assert.equal(questionRole(commercial("  best rechargeable EDC flashlight   under $100 [via ChatGPT]")), "unbranded_discovery");
  // A fact check stays a fact check whatever its text.
  assert.equal(questionRole({ prompt_kind: "probe", prompt: "Is Ledlenser a good flashlight brand?" }), "probe");
});

test("a wording the battery does not store falls back to the text rules", () => {
  resetActiveClientForTests("ledlenser");
  assert.equal(storedQuestionRole("ledlenser", "Best headlamp for cavers"), null);
  assert.equal(questionRole(commercial("Best headlamp for cavers")), "unbranded_discovery");
  assert.equal(questionRole(commercial("Which torch do campers pack?")), "other");
});

test("Fender stores no role and keeps the text rules", () => {
  resetActiveClientForTests("fender");
  assert.equal(storedQuestionRole("fender", "Is Ledlenser a good flashlight brand?"), null);
  assert.equal(questionRole(commercial("Best electric guitar under $900 for versatile tones")), "unbranded_discovery");
  assert.equal(questionRole(commercial("Fender vs Yamaha for a beginner guitarist")), "branded_consideration");
  assert.equal(questionRole(commercial("Is Ledlenser a good flashlight brand?")), "other");
});
