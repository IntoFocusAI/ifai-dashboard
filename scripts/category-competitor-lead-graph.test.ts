// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/category-competitor-lead-graph.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { categoryCompetitorLeadMarks } from "../components/v3/live/ai-search/category-competitor-lead-marks.ts";
import {
  categoryRoleTallies,
  headlineAside,
  QUESTION_ROLES,
  type RoleGroupTally,
} from "../lib/ai-search/question-role.ts";
import type { OutcomeTally } from "../lib/ai-search/run-metrics.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function emptyTally(partial: Partial<OutcomeTally> = {}): OutcomeTally {
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
    ...partial,
  };
}

function group(key: string, unbranded: Partial<OutcomeTally>): RoleGroupTally {
  const roles = Object.fromEntries(QUESTION_ROLES.map((role) => [role, emptyTally()])) as RoleGroupTally["roles"];
  const fenderWins = unbranded.fenderWins ?? 0;
  const competitorWins = unbranded.competitorWins ?? 0;
  const resolved = fenderWins + competitorWins;
  roles.unbranded_discovery = emptyTally({
    calls: resolved,
    answered: resolved,
    resolved,
    fenderWins,
    competitorWins,
    winPct: resolved > 0 ? (100 * fenderWins) / resolved : null,
  });
  return { key, models: [], roles };
}

test("competitor-lead marks sort largest competitor leads first and skip zero-lead categories", () => {
  const marks = categoryCompetitorLeadMarks([
    group("amps", { fenderWins: 8, competitorWins: 2 }),
    group("beginner", { fenderWins: 3, competitorWins: 12 }),
    group("acoustic", { fenderWins: 5, competitorWins: 0 }),
    group("bass", { fenderWins: 1, competitorWins: 12 }),
  ]);
  assert.deepEqual(
    marks.map((mark) => ({ key: mark.key, fenderLeads: mark.fenderLeads, competitorLeads: mark.competitorLeads })),
    [
      { key: "bass", fenderLeads: 1, competitorLeads: 12 },
      { key: "beginner", fenderLeads: 3, competitorLeads: 12 },
      { key: "amps", fenderLeads: 8, competitorLeads: 2 },
    ],
  );
  assert.equal(marks[0].competitorLeads, Math.max(...marks.map((mark) => mark.competitorLeads)));
  assert.ok(marks.every((mark) => mark.competitorLeads > 0));
});

test("marks reuse headlineAside competitor wins from categoryRoleTallies shape", () => {
  const battles: RoleGroupTally[] = [
    group("beginner", { fenderWins: 2, competitorWins: 7 }),
    group("amps", { fenderWins: 4, competitorWins: 1 }),
  ];
  const marks = categoryCompetitorLeadMarks(battles);
  assert.equal(marks.length, 2);
  for (const mark of marks) {
    const battle = battles.find((row) => row.key === mark.key)!;
    assert.equal(mark.competitorLeads, headlineAside(battle).competitorWins);
    assert.equal(mark.fenderLeads, battle.roles.unbranded_discovery.fenderWins);
  }
  assert.equal(typeof categoryRoleTallies, "function");
});

test("zero competitor leads yields an empty mark list (no fake zero chart)", () => {
  assert.deepEqual(
    categoryCompetitorLeadMarks([
      group("amps", { fenderWins: 4, competitorWins: 0 }),
      group("bass", { fenderWins: 0, competitorWins: 0 }),
    ]),
    [],
  );
});

test("Category Battlecards keeps the two rates in its hero row and a pie for each category", () => {
  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  assert.match(panel, /CategoryBattleHeroes/);
  assert.match(panel, /CategoryLeadPies/);
  assert.doesNotMatch(panel, /RoleSumLine|CategoryCompetitorLeadGraph/);
  assert.match(read("components/v3/live/ai-search/CategoryBattleHeroes.tsx"), /<RunDetailsLead snapshot=\{snapshot\}/);
  const pies = read("components/v3/live/ai-search/CategoryLeadPies.tsx");
  assert.match(pies, /data-ai-battle-lead-graph=""/);
  assert.match(pies, /AiTerm term="unbranded discovery"/);
});

test("marks and panel copy have no em dash and no native title tooltips", () => {
  for (const path of [
    "components/v3/live/ai-search/CategoryBattlecardsPanel.tsx",
    "components/v3/live/ai-search/category-competitor-lead-marks.ts",
  ]) {
    const text = read(path);
    assert.doesNotMatch(text, /\u2014/, path);
    assert.doesNotMatch(text, /\stitle=/, path);
  }
});
