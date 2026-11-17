// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/category-standing.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { aiMetrics, categoryStandingMetrics } from "../lib/ai-search/canvas-surfaces.ts";
import {
  formatGapPts,
  periodCategoryLeads,
  STRONGEST_CATEGORY_DEFINITION,
  strongestCategoryStanding,
  WEAKEST_CATEGORY_DEFINITION,
  weakestCategoryStanding,
} from "../lib/ai-search/category-standing.ts";
import type { AiCallRow, AiSearchRead, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

afterEach(() => resetActiveClientForTests(null));

let next = 0;
function call(category: string, outcome: "fender_win" | "competitor_win" | "unresolved", brand: string, patch: Partial<AiCallRow> = {}): AiCallRow {
  next += 1;
  return {
    id: `c${next}`,
    audit_run_id: "run-a",
    sim_id: next,
    engine: "chatgpt",
    model: "gpt",
    category,
    prompt: `best ${category} for the money`,
    prompt_key: `k${next}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome,
    primary_brand: brand,
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-11-10T00:00:00Z",
    ...patch,
  };
}

/** `own` brand leads, `rival` leads for `rivalBrand`, and `others` leads for a third brand. */
function category(key: string, own: number, rival: number, rivalBrand: string, ownBrand: string, others = 0): AiCallRow[] {
  return [
    ...Array.from({ length: own }, () => call(key, "fender_win", ownBrand)),
    ...Array.from({ length: rival }, () => call(key, "competitor_win", rivalBrand)),
    ...Array.from({ length: others }, () => call(key, "competitor_win", "Other Co")),
  ];
}

function ready(calls: AiCallRow[]): AiSearchRead {
  return { phase: "ready", snapshot: { calls } as unknown as AiSearchSnapshot };
}

/** Fender: Electrics +40 pts, Acoustics -12 pts (Taylor), Amps tied, Basses too small to compare. */
const FENDER_CALLS = () => [
  ...category("electrics", 14, 6, "Gibson", "Fender"),
  ...category("acoustics", 7, 10, "Taylor", "Fender", 8),
  ...category("amps", 5, 5, "Boss", "Fender"),
  ...category("basses", 1, 8, "Ibanez", "Fender"),
];

test("strongest category: the largest lead over the top rival, in points of resolved Unbranded Discovery answers", () => {
  const result = strongestCategoryStanding(periodCategoryLeads(FENDER_CALLS()));
  assert.equal(result.standing?.lead.key, "electrics");
  assert.equal(result.standing?.margin, 8);
  assert.equal(result.standing?.marginPts, 40);
  const metric = categoryStandingMetrics(ready(FENDER_CALLS())).strongestCategorySov;
  assert.equal(metric.label, "Strongest category for Fender");
  assert.equal(metric.value, "+40 pts");
  assert.equal(metric.detail, "Fender/Squier leads Electrics by 40 pts. Fender/Squier 14 vs Gibson 6 of 20 resolved Electrics Unbranded Discovery answers.");
  assert.equal(metric.subTab, "Category Battlecards");
});

test("weakest category: the largest gap against the brand, naming the top rival from the data", () => {
  const result = weakestCategoryStanding(periodCategoryLeads(FENDER_CALLS()));
  assert.equal(result.standing?.lead.key, "acoustics", "Basses has fewer than 10 resolved answers, so it is not compared");
  assert.equal(result.standing?.lead.topRival?.brand, "Taylor");
  const metric = categoryStandingMetrics(ready(FENDER_CALLS())).weakestCategoryGap;
  assert.equal(metric.label, "Weakest category: gap to top rival");
  assert.equal(metric.value, "-12 pts");
  assert.match(metric.detail, /^Taylor leads Acoustics by 12 pts\. Fender\/Squier 7 vs Taylor 10 of 25 resolved Acoustics Unbranded Discovery answers\.$/);
  assert.equal(metric.tone, "danger");
});

test("a tied category is neither strongest nor weakest, and equal gaps pick the larger sample, then A to Z", () => {
  const tiedOnly = periodCategoryLeads(category("amps", 6, 6, "Boss", "Fender"));
  assert.equal(strongestCategoryStanding(tiedOnly).standing, null);
  assert.equal(weakestCategoryStanding(tiedOnly).standing, null);
  assert.match(strongestCategoryStanding(tiedOnly).missing ?? "", /does not lead any category/);
  assert.match(weakestCategoryStanding(tiedOnly).missing ?? "", /No other brand leads Fender\/Squier/);

  const even = periodCategoryLeads([
    ...category("pedals", 6, 4, "Boss", "Fender"),
    ...category("amps", 12, 8, "Marshall", "Fender"),
    ...category("cables", 12, 8, "Mogami", "Fender"),
  ]);
  assert.equal(strongestCategoryStanding(even).standing?.lead.key, "amps", "20 pts each: the larger samples win, then A to Z");
});

test("no qualifying category reads Not available* with the reason", () => {
  const empty = categoryStandingMetrics(ready([]));
  for (const metric of Object.values(empty)) {
    assert.equal(metric.value, "Not available*");
    assert.equal(metric.detail, "The selected period has no Unbranded Discovery questions in any category.");
    assert.equal(metric.tone, "warning");
  }
  const small = categoryStandingMetrics(ready(category("electrics", 3, 2, "Gibson", "Fender")));
  for (const metric of Object.values(small)) {
    assert.equal(metric.value, "Not available*");
    assert.match(metric.detail, /^No category has 10 or more resolved Unbranded Discovery answers in the selected period/);
  }
  const unclear = categoryStandingMetrics(ready([call("electrics", "unresolved", "")]));
  assert.match(unclear.strongestCategorySov.detail, /had a clear leader/);
  const branded = categoryStandingMetrics(ready(category("electrics", 12, 2, "Gibson", "Fender").map((row) => ({ ...row, prompt: "Is the Fender Stratocaster worth it" }))));
  assert.equal(branded.strongestCategorySov.detail, "The selected period has no Unbranded Discovery questions in any category.", "Branded Consideration is not a battlecard category");
});

test("a client whose questions hold no beginner category never shows a beginner figure", () => {
  resetActiveClientForTests("ledlenser");
  const calls = [
    ...category("headlamps", 9, 3, "Petzl", "Ledlenser"),
    ...category("flashlights", 4, 9, "Fenix", "Ledlenser"),
  ];
  const metrics = categoryStandingMetrics(ready(calls));
  assert.equal(metrics.strongestCategorySov.label, "Strongest category for Ledlenser");
  assert.equal(metrics.strongestCategorySov.value, "+50 pts");
  assert.match(metrics.strongestCategorySov.detail, /^Ledlenser leads Headlamps by 50 pts\. Ledlenser 9 vs Petzl 3 of 12 /);
  assert.equal(metrics.weakestCategoryGap.value, "-38.5 pts");
  assert.match(metrics.weakestCategoryGap.detail, /^Fenix leads Flashlights by 38\.5 pts\. Ledlenser 4 vs Fenix 9 of 13 /);
  const text = JSON.stringify(metrics);
  assert.doesNotMatch(text, /beginner/i);
  assert.doesNotMatch(text, /Fender|Squier|Yamaha|guitar/i);
  const keys = Object.keys(aiMetrics({ phase: "loading" }));
  assert.deepEqual(keys.filter((key) => /beginner/i.test(key)), []);
});

test("the figures wait for the date-pill read and never fall back to a stored run", () => {
  const loading = categoryStandingMetrics({ phase: "loading" });
  assert.equal(loading.strongestCategorySov.value, "Loading");
  assert.equal(loading.weakestCategoryGap.value, "Loading");
  const failed = categoryStandingMetrics({ phase: "error", message: "down" });
  assert.equal(failed.weakestCategoryGap.value, "Unavailable");
});

test("gap points read with one decimal at most", () => {
  assert.equal(formatGapPts(12), "12 pts");
  assert.equal(formatGapPts(-38.46), "38.5 pts");
  assert.equal(formatGapPts(0.04), "0 pts");
});

test("no code names a fixed beginner category, and the definitions name no brand", () => {
  for (const file of [
    "lib/ai-search/canvas-surfaces.ts",
    "lib/ai-search/category-standing.ts",
    "lib/fender-canvas/minimal-metrics-other.ts",
    "lib/fender-canvas/metrics-from-live.ts",
    "lib/fender-canvas/template-vars.ts",
    "components/v3/fender-metrics.ts",
  ]) {
    assert.doesNotMatch(read(file), /beginner/i, file);
  }
  for (const definition of [STRONGEST_CATEGORY_DEFINITION, WEAKEST_CATEGORY_DEFINITION]) {
    assert.doesNotMatch(definition, /Fender|Squier|Ledlenser|beginner|—/);
  }
});
