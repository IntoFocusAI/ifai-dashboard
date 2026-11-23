// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/thousands-separators.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contradictionCount, factCheckAccuracyLead, factCheckHeadline, factCheckMethodLine } from "../lib/ai-search/fact-check-copy.ts";
import type { FactCheckCoverage } from "../lib/ai-search/drift.ts";

const coverage: FactCheckCoverage = {
  questionsSent: 2301,
  questionsWithFact: 2301,
  catalogProducts: 0,
  amazonMismatches: 0,
  factsChecked: 1234,
  answersChecked: 2506,
  contradictions: 4,
  checkedEngines: ["ChatGPT"],
  questionsWithoutFact: [],
  answersWithoutFact: 0,
  failedCalls: 0,
  failedEngines: [],
};

test("fact-check copy shows thousands separators", () => {
  assert.match(factCheckHeadline(coverage), /4 of 2,506 answers contradicted/);
  assert.match(factCheckHeadline(coverage), /1,234/);
  assert.equal(factCheckAccuracyLead(coverage).population, "2,502 of 2,506 answers matched.");
  assert.match(factCheckMethodLine(coverage)?.tip ?? "", /1,234 of 2,301/);
  assert.equal(contradictionCount(1200), "1,200 contradictions");
});

test("citation ecosystem cards format visible counts", () => {
  const gaps = readFileSync("components/v3/live/ai-search/CitationGapsCard.tsx", "utf8");
  assert.match(gaps, /citation-gap-count">\{formatInt\(gap\.count\)\}/);
  const disc = readFileSync("components/v3/live/ai-search/CitationPieDisc.tsx", "utf8");
  assert.match(disc, /\{slice\.label\}: \{formatInt\(slice\.count\)\}/);
});
