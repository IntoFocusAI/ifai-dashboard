// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/radar-tables.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AI_EXPORT_TABLE_IDS } from "../lib/export/ai-export.ts";
import { EXPORT_TABLE_IDS } from "../lib/export/tables.ts";
import {
  battlecardFilterLabel,
  battlecardTable,
  competitorWinsTable,
  engineCategoryTable,
  engineComparisonTable,
  parseBattlecardFilter,
} from "../lib/ai-search/radar-tables.ts";
import { discoveryCategories, roleTally } from "../lib/ai-search/question-role.ts";
import { radarBubbleLead } from "../lib/ai-search/radar-bubble.ts";
import { runWithClient } from "../lib/client/server-client.ts";
import { whyNotBrand } from "../lib/ai-search/why-not-brand.ts";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

let next = 0;
function call(patch: Partial<AiCallRow>): AiCallRow {
  next += 1;
  return {
    id: `r${next}`,
    audit_run_id: "run-a",
    sim_id: next,
    engine: "chatgpt",
    model: "gpt",
    category: "acoustics",
    prompt: "best acoustic guitar under $500",
    prompt_key: `k${next}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender",
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-10-20T00:00:00Z",
    ...patch,
  };
}

const times = (count: number, patch: Partial<AiCallRow>) => Array.from({ length: count }, () => call(patch));
const snap = (calls: AiCallRow[]) => ({ calls, citations: [], probes: [], run: null }) as unknown as AiSearchSnapshot;

const rows = [
  ...times(2, { category: "acoustics" }),
  ...times(5, { category: "acoustics", outcome: "competitor_win", primary_brand: "Taylor" }),
  ...times(1, { category: "acoustics", outcome: "competitor_win", primary_brand: "Yamaha" }),
  ...times(6, { category: "electrics", engine: "gemini" }),
  ...times(2, { category: "electrics", engine: "gemini", outcome: "competitor_win", primary_brand: "Gibson" }),
  ...times(1, { category: "electrics", engine: "gemini", outcome: "unresolved", primary_brand: null }),
];

test("Competitor Wins downloads one row per rival with the cells the table draws", () => {
  const table = competitorWinsTable(snap(rows));
  assert.deepEqual(table.header, ["Competitor", "Leads", "Categories", "Engines"]);
  assert.deepEqual(
    table.rows.map((row) => row.cells),
    [
      ["Taylor", "5 of 16 resolved", "Acoustics 5 of 8", "ChatGPT 5 of 8"],
      ["Gibson", "2 of 16 resolved", "Electrics 2 of 8", "Gemini 2 of 8"],
      ["Yamaha", "1 of 16 resolved", "Acoustics 1 of 8", "ChatGPT 1 of 8"],
    ],
  );
  assert.deepEqual(table.rows.map((row) => row.key), ["Taylor", "Gibson", "Yamaha"]);
});

test("Engine Comparison folds every rival into one wrapping column, so any number of brands fits", () => {
  const table = engineComparisonTable(snap(rows), false);
  assert.equal(table.header[4], "Competitor leads");
  const byKey = Object.fromEntries(table.rows.map((row) => [row.key, row.cells]));
  assert.equal(byKey.chatgpt[4], "Taylor 5, Yamaha 1");
  assert.equal(byKey.gemini[4], "Gibson 2");
  assert.equal(byKey.gemini[5], "1", "No leader");
  const panel = read("components/v3/live/ai-search/EngineComparisonPanel.tsx");
  assert.doesNotMatch(panel, /brands\.map\(\(brand\) => clientColumn/, "no column per brand");
  assert.match(panel, /fillColumnId="competitors"/);
});

test("the engine and category grid has one row per engine and one column per category", () => {
  const table = engineCategoryTable(snap(rows), false);
  assert.deepEqual(table.header, ["Engine", "Acoustics", "Electrics"]);
  const chatgpt = table.rows.find((row) => row.key === "chatgpt")!;
  assert.equal(chatgpt.cells[1], "Unbranded 25.0% (2 of 8). Branded No resolved answers");
  assert.equal(chatgpt.cells[2], "Unbranded No resolved answers. Branded No resolved answers");
  const panel = read("components/v3/live/ai-search/EngineCategoryGrid.tsx");
  assert.match(panel, /wrapColumnIds=\{categories\.map\(categoryId\)\}/);
  assert.match(panel, /className="ai-grid-rate-part"/, "a rate and its counts never break inside");
});

test("Category Battlecards downloads the rows the chips leave, with the chips in plain words", () => {
  const all = battlecardTable(snap(rows), { engine: "", lead: "all" }, false);
  assert.deepEqual(all.rows.map((row) => [row.key, row.cells[1], row.cells[4]]), [
    ["acoustics", "Behind", "Taylor (5)"],
    ["electrics", "On track", "Gibson (2)"],
  ]);
  assert.equal(all.filter, null);
  const behind = battlecardTable(snap(rows), { engine: "gemini", lead: "other" }, false);
  assert.deepEqual(behind.rows, []);
  assert.equal(battlecardFilterLabel({ engine: "gemini", lead: "other" }), "Engine: Gemini. Who leads: Another brand leads");
  assert.deepEqual(parseBattlecardFilter({ engine: "ChatGPT", lead: "nope" }), { engine: "chatgpt", lead: "all" });
  assert.deepEqual(parseBattlecardFilter(null), { engine: "", lead: "all" });
});

test("the four Radar tables have a server CSV that reads the AI Search selection (X-10)", () => {
  for (const id of ["category-battlecards", "competitor-wins", "engine-comparison", "engine-category"] as const) {
    assert.ok((EXPORT_TABLE_IDS as readonly string[]).includes(id), id);
    assert.ok((AI_EXPORT_TABLE_IDS as readonly string[]).includes(id), id);
  }
  for (const file of ["CategoryBattlecardsPanel", "CompetitorWinsPanel", "EngineComparisonPanel", "EngineCategoryGrid"]) {
    assert.match(read(`components/v3/live/ai-search/${file}.tsx`), /exportScope=\{exportScope\}/, file);
  }
});

test("a Ledlenser answer that names Ledlenser reads as mentioned, and Fender is not looked for", async () => {
  const view = await runWithClient("ledlenser", async () =>
    whyNotBrand({ answerText: "Fenix beats the Ledlenser P7R on runtime.", winner: "Fenix", pages: [] }),
  );
  assert.equal(view.brandMentioned, true);
  assert.equal(view.summary, "Fenix was named most. Ledlenser was mentioned, but named less often. No cited page was stored.");
  const fender = await runWithClient("ledlenser", async () =>
    whyNotBrand({ answerText: "Fender makes guitars.", winner: "Fenix", pages: [] }),
  );
  assert.equal(fender.brandMentioned, false);
  assert.equal(whyNotBrand({ answerText: "A Squier is a fine start.", winner: "Yamaha", pages: [] }).brandMentioned, true);
});

test("a category whose questions are all branded is no battlecard, for every client (decision 93)", async () => {
  // Fender: "squier" asks branded questions only. Its answers still count in Branded Consideration.
  const squierPrompt = "Squier Classic Vibe vs Yamaha Pacifica comparison";
  const squier = [
    ...times(3, { category: "squier", prompt: squierPrompt }),
    ...times(1, { category: "squier", prompt: squierPrompt, outcome: "competitor_win", primary_brand: "Yamaha" }),
  ];
  const fender = snap([...rows, ...squier]);
  assert.deepEqual(battlecardTable(fender, { engine: "", lead: "all" }, false).rows.map((row) => row.key), ["acoustics", "electrics"]);
  assert.deepEqual(engineCategoryTable(fender, false).header, ["Engine", "Acoustics", "Electrics"]);
  assert.deepEqual(discoveryCategories(fender.calls), ["acoustics", "electrics"]);
  assert.equal(roleTally(fender.calls, "branded_consideration").resolved, 4, "the Squier answers still count in Branded Consideration");
  assert.equal(radarBubbleLead(fender.calls)?.key, "acoustics");

  // Ledlenser: "brand" holds stored Branded Consideration and brand-associated questions, no Unbranded Discovery.
  const led = await runWithClient("ledlenser", async () => {
    const calls = [
      ...times(4, { category: "headlamps", prompt: "Best rechargeable headlamp for backpacking and hiking", primary_brand: "Ledlenser" }),
      ...times(3, { category: "brand", prompt: "Is Ledlenser a good flashlight brand?", primary_brand: "Ledlenser" }),
      ...times(2, { category: "brand", prompt: "Best German-engineered flashlight brand", primary_brand: "Ledlenser" }),
    ];
    return {
      cards: battlecardTable(snap(calls), { engine: "", lead: "all" }, false).rows.map((row) => row.key),
      grid: engineCategoryTable(snap(calls), false).header,
      categories: discoveryCategories(calls),
      branded: roleTally(calls, "branded_consideration").resolved,
    };
  });
  assert.deepEqual(led.cards, ["headlamps"]);
  assert.deepEqual(led.grid, ["Engine", "Headlamps"]);
  assert.deepEqual(led.categories, ["headlamps"]);
  assert.equal(led.branded, 3, "the Brand answers still count in Branded Consideration");
});
