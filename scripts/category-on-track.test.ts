// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/category-on-track.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  BATTLE_COLUMN_NOTES,
  battlecardEngines,
  callsForEngine,
  categoryLeadPie,
  categoryLeads,
  categoryLeadStatus,
  categoryLeadSummary,
  effectiveBattlecardFilter,
  ENGINE_MARK_TITLE,
  engineOnlyNote,
  HERO_RATES_NOTE,
  isBattlecardFiltered,
  leadMatches,
  leadSentence,
  leadStatusDefinition,
  NO_BATTLECARD_FILTER,
  ON_TRACK_DEFINITION,
  onTrackPie,
  restLeads,
} from "../lib/ai-search/category-on-track.ts";
import { competitorsSpokeLead } from "../lib/ai-search/canvas-surfaces.ts";
import { AI_DEFINITIONS } from "../lib/ai-search/definitions.ts";
import { explorerFilterFor } from "../lib/ai-search/evidence-filter.ts";
import { formatEvidence, parseEvidence, scopeEvidence } from "../lib/ai-search/evidence-focus.ts";
import { applyExplorerFilter } from "../lib/ai-search/explorer-filter.ts";
import { categoryRoleTallies } from "../lib/ai-search/question-role.ts";
import { summarizeRun } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const UNBRANDED = "best acoustic guitar under $500";
const BRANDED = "Is the Squier Classic Vibe a good buy";

let next = 0;
function call(patch: Partial<AiCallRow>): AiCallRow {
  next += 1;
  return {
    id: `c${next}`,
    audit_run_id: "run-a",
    sim_id: next,
    engine: "chatgpt",
    model: "gpt",
    category: "acoustics",
    prompt: UNBRANDED,
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

function times(count: number, patch: Partial<AiCallRow>): AiCallRow[] {
  return Array.from({ length: count }, () => call(patch));
}

const yamaha = { outcome: "competitor_win", primary_brand: "Yamaha" } as const;
const taylor = { outcome: "competitor_win", primary_brand: "Taylor" } as const;

function leadsOf(rows: AiCallRow[]) {
  return categoryLeads(categoryRoleTallies(rows), rows);
}

test("on track means Fender/Squier leads more resolved answers than any single other brand", () => {
  assert.equal(categoryLeadStatus({ resolved: 10, fenderWins: 6, topRivalWins: 4 }), "on_track");
  assert.equal(categoryLeadStatus({ resolved: 10, fenderWins: 4, topRivalWins: 6 }), "behind");
  assert.equal(categoryLeadStatus({ resolved: 10, fenderWins: 5, topRivalWins: 5 }), "tied");
  assert.equal(categoryLeadStatus({ resolved: 0, fenderWins: 0, topRivalWins: 0 }), "not_available");
  // Fender/Squier 8, Yamaha 6, Taylor 6: other brands together lead 12, but no single brand beats 8.
  const [lead] = leadsOf([...times(8, {}), ...times(6, yamaha), ...times(6, taylor)]);
  assert.equal(lead.status, "on_track");
  assert.equal(lead.resolved, 20);
  assert.equal(lead.otherLeads, 12);
  assert.deepEqual(lead.topRival, { brand: "Taylor", wins: 6 });
  assert.equal(restLeads(lead), 6);
  assert.equal(
    leadSentence(lead),
    "Fender/Squier leads 8 of 20 resolved answers. Taylor, the top rival, leads 6. Other brands lead 6.",
  );
  const [tied] = leadsOf([...times(6, {}), ...times(6, yamaha), ...times(2, taylor)]);
  assert.equal(tied.status, "tied", "level with the top rival is not on track");
  assert.match(leadStatusDefinition(tied), /same number/);
  const [behind] = leadsOf([...times(5, {}), ...times(6, yamaha)]);
  assert.equal(behind.status, "behind");
  assert.match(ON_TRACK_DEFINITION, /than any single other brand/);
  for (const path of ["components/v3/live/ai-search/CategoryBattlecardsPanel.tsx", "lib/ai-search/category-on-track.ts"]) {
    assert.doesNotMatch(read(path), /than every other brand together/, path);
  }
  assert.match(read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx"), /than any single other brand, tied when/);
});

test("lead counts use resolved unbranded discovery answers only", () => {
  const rows = [
    ...times(3, {}),
    ...times(5, yamaha),
    ...times(2, { outcome: "unresolved", primary_brand: null }),
    ...times(2, { call_status: "error", outcome: "error", primary_brand: null }),
    ...times(9, { prompt: BRANDED }),
    ...times(4, { prompt_kind: "probe", outcome: null }),
  ];
  const [lead] = leadsOf(rows);
  assert.equal(lead.key, "acoustics");
  assert.equal(lead.resolved, 8, "errors, no-leader answers, branded questions, and fact checks stay out");
  assert.equal(lead.fenderLeads, 3);
  assert.equal(lead.otherLeads, 5);
  assert.equal(lead.status, "behind");
  assert.deepEqual(lead.topRival, { brand: "Yamaha", wins: 5 });
  assert.equal(leadSentence(lead), "Fender/Squier leads 3 of 8 resolved answers. Yamaha, the top rival, leads 5.");
});

test("a confirmed product error stays in the denominator and in neither lead", () => {
  const [lead] = leadsOf([...times(4, {}), ...times(2, { material_hallucination: "confirmed" }), ...times(3, yamaha)]);
  assert.equal(lead.resolved, 9);
  assert.equal(lead.fenderLeads, 4);
  assert.equal(lead.disqualified, 2);
  assert.equal(lead.status, "on_track");
  assert.match(leadSentence(lead), /^Fender\/Squier leads 4 of 9 resolved answers\. Yamaha, the top rival, leads 3\. 2 more/);
});

test("categories sort behind, then tied, then the weakest Fender/Squier share, and a category with no unbranded questions is last", () => {
  const rows = [
    ...times(9, { category: "amps" }),
    ...times(1, { category: "amps", ...yamaha }),
    ...times(3, { category: "basses" }),
    ...times(2, { category: "basses", ...yamaha }),
    ...times(4, { category: "electrics" }),
    ...times(4, { category: "electrics", ...taylor }),
    ...times(2, { category: "acoustics" }),
    ...times(7, { category: "acoustics", ...yamaha }),
    ...times(3, { category: "acoustics", ...taylor }),
    ...times(4, { category: "squier", prompt: BRANDED }),
  ];
  const leads = leadsOf(rows);
  assert.deepEqual(
    leads.map((lead) => [lead.key, lead.status]),
    [
      ["acoustics", "behind"],
      ["electrics", "tied"],
      ["basses", "on_track"],
      ["amps", "on_track"],
      ["squier", "not_available"],
    ],
  );
  assert.equal(
    leadSentence(leads[0]),
    "Fender/Squier leads 2 of 12 resolved answers. Yamaha, the top rival, leads 7. Other brands lead 3.",
  );
  assert.equal(leadSentence(leads[3]), "Fender/Squier leads 9 of 10 resolved answers. Yamaha, the top rival, leads 1.");
  assert.equal(leadSentence(leads[4]), "No unbranded discovery questions in this category.");
  assert.match(leadStatusDefinition(leads[4]), /no unbranded discovery questions/);
  assert.deepEqual(categoryLeadSummary(leads), {
    measured: 4,
    onTrack: 2,
    tied: ["Electrics"],
    behind: ["Acoustics"],
    rivalsLead: ["Yamaha leads Acoustics"],
  });
  const [alone] = leadsOf(times(3, { category: "amps" }));
  assert.equal(leadSentence(alone), "Fender/Squier leads 3 of 3 resolved answers. No other brand leads any.");
});

test("engine chips cover engines with an answer, and an engine filter changes the counts", () => {
  const rows = [
    ...times(3, { engine: "ChatGPT" }),
    ...times(1, { engine: "chatgpt", ...yamaha }),
    ...times(1, { engine: "gemini" }),
    ...times(4, { engine: "gemini", ...yamaha }),
    ...times(5, { engine: "perplexity", call_status: "error", outcome: "error", primary_brand: null }),
  ];
  assert.deepEqual(battlecardEngines(rows), ["chatgpt", "gemini"], "an engine that failed every call gets no chip");
  assert.equal(leadsOf(rows)[0].status, "behind");
  const chatgpt = leadsOf(callsForEngine(rows, "chatgpt"))[0];
  assert.deepEqual([chatgpt.status, chatgpt.fenderLeads, chatgpt.resolved], ["on_track", 3, 4]);
  const gemini = leadsOf(callsForEngine(rows, "gemini"))[0];
  assert.deepEqual([gemini.status, gemini.otherLeads, gemini.resolved], ["behind", 4, 5]);
  assert.equal(callsForEngine(rows, "").length, rows.length);
});

test("who-leads chips match on-track and behind categories, and clearing restores everything", () => {
  assert.ok(leadMatches("on_track", "fender") && !leadMatches("behind", "fender"));
  assert.ok(leadMatches("behind", "other") && !leadMatches("on_track", "other"));
  assert.ok(!leadMatches("tied", "fender") && !leadMatches("tied", "other"), "a tie is neither side's lead");
  for (const status of ["on_track", "tied", "behind", "not_available"] as const) assert.ok(leadMatches(status, "all"));
  assert.equal(isBattlecardFiltered(NO_BATTLECARD_FILTER), false);
  assert.equal(isBattlecardFiltered({ engine: "gemini", lead: "all" }), true);
  assert.equal(isBattlecardFiltered({ engine: "", lead: "other" }), true);
  assert.deepEqual(effectiveBattlecardFilter({ engine: "claude", lead: "other" }, ["chatgpt"]), { engine: "", lead: "other" });
  assert.deepEqual(effectiveBattlecardFilter({ engine: "chatgpt", lead: "all" }, ["chatgpt"]), { engine: "chatgpt", lead: "all" });
});

test("the hero pie counts on track, tied, and behind out of the measured categories", () => {
  const rows = [
    ...times(9, { category: "amps" }),
    ...times(1, { category: "amps", ...yamaha }),
    ...times(4, { category: "electrics" }),
    ...times(4, { category: "electrics", ...taylor }),
    ...times(2, { category: "acoustics" }),
    ...times(7, { category: "acoustics", ...yamaha }),
    ...times(4, { category: "squier", prompt: BRANDED }),
  ];
  const summary = categoryLeadSummary(leadsOf(rows));
  const hero = onTrackPie(summary);
  assert.ok(hero);
  assert.equal(hero.total, 3, "Squier has no unbranded questions, so it is not in M");
  assert.deepEqual(
    hero.slices.map((slice) => [slice.label, slice.count]),
    [
      ["On track", 1],
      ["Tied", 1],
      ["Behind", 1],
    ],
  );
  assert.equal(onTrackPie({ measured: 0, onTrack: 0, tied: [], behind: [] }), null);
});

test("each category pie splits resolved answers into Fender/Squier, the top rival, other brands, and product errors", () => {
  const [lead] = leadsOf([
    ...times(4, {}),
    ...times(1, { material_hallucination: "confirmed" }),
    ...times(5, yamaha),
    ...times(2, taylor),
  ]);
  const pie = categoryLeadPie(lead);
  assert.ok(pie);
  assert.equal(pie.total, 12);
  assert.deepEqual(
    pie.slices.map((slice) => [slice.key, slice.label, slice.count]),
    [
      ["fender", "Fender/Squier leads", 4],
      ["competitor_brand", "Yamaha leads", 5],
      ["other", "Other brands lead", 2],
      ["none", "Fender/Squier with a confirmed product error", 1],
    ],
  );
  assert.equal(
    pie.slices.reduce((sum, slice) => sum + slice.count, 0),
    pie.total,
    "slices add up to the resolved denominator",
  );
  const [squier] = leadsOf(times(4, { category: "squier", prompt: BRANDED }));
  assert.equal(squier.status, "not_available");
  assert.equal(categoryLeadPie(squier), null, "a category with no data gets Not available*, not an empty pie");
});

test("caveats on this tab sit in tooltips, and the screen shows no line saying what a figure is not", () => {
  assert.match(ON_TRACK_DEFINITION, /The pie counts every category, including any the Who leads chip hides\.$/);
  assert.match(HERO_RATES_NOTE, /every category, including any the Who leads chip hides/);
  assert.match(AI_DEFINITIONS.resolved, /no clear leader and provider errors are not in the denominator/);
  assert.match(AI_DEFINITIONS["brand-associated discovery"], /not inside unbranded discovery/);
  assert.match(AI_DEFINITIONS["shopping guidance"], /left out of the discovery and consideration rates/);
  assert.match(AI_DEFINITIONS["product-fact question"], /stored with the shopping prompts, and they are left out/);
  for (const key of ["competitor", "leads"] as const) {
    assert.match(BATTLE_COLUMN_NOTES[key], /unbranded discovery answers/);
    assert.match(BATTLE_COLUMN_NOTES[key], /Branded consideration and the questions listed under the table are not counted\./);
  }
  for (const key of ["leader", "errors"] as const) {
    assert.match(BATTLE_COLUMN_NOTES[key], /They stay out of both Fender-lead rates\./);
  }

  const lib = read("lib/ai-search/category-on-track.ts");
  assert.doesNotMatch(lib, /heroScope/);
  const heroes = read("components/v3/live/ai-search/CategoryBattleHeroes.tsx");
  assert.doesNotMatch(heroes, /data-ai-battle-rates-scope|scope: string/);
  assert.match(heroes, /const RESOLVED_DESC = `\$\{AI_DEFINITIONS\.resolved\} \$\{HERO_RATES_NOTE\}`;/);
  assert.match(heroes, /<Term name="Resolved answers" desc=\{RESOLVED_DESC\}>/);
  assert.doesNotMatch(read("components/v3/live/ai-search/category-battlecards.css"), /ai-battle-rates-scope/);

  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  for (const gone of [/count inside/, /is not part of either/, /does not appear in/, /use unbranded\s+discovery only/]) {
    assert.doesNotMatch(panel, gone);
  }
  for (const key of ["competitor", "leads", "leader", "errors"]) {
    assert.match(panel, new RegExp(`notedColumn\\("${key}",`), key);
  }
  assert.match(panel, /headerTooltip: \{ title: name, description: BATTLE_COLUMN_NOTES\[id\] \}/);
  assert.match(panel, /<KeptOutNote snapshot=\{scoped\} inlineCaveats=\{false\} \/>/);
  assert.doesNotMatch(read("components/v3/live/ai-search/CategoryBattleChips.tsx"), /No filter is on/);

  const shared = read("components/v3/live/ai-search/RoleRateTable.tsx");
  assert.match(shared, /inlineCaveats = true,/, "Engine Comparison keeps the inline wording");
  assert.match(shared, /caveat\("Counted on its own, not inside unbranded discovery\."\)/);
  assert.doesNotMatch(read("components/v3/live/ai-search/EngineComparisonPanel.tsx"), /inlineCaveats/);
  // Run Summary leaves each caveat to its term's tooltip too (Worker 24.4, let the data speak).
  const summary = read("components/v3/live/ai-search/RunSummaryPanel.tsx");
  assert.match(summary, /<KeptOutNote snapshot=\{snapshot\} inlineCaveats=\{false\} \/>/);
  for (const gone of [/not inside unbranded discovery/, /Not in either rate above/, /, not counted as wins/]) {
    assert.doesNotMatch(summary.replace(/const DISQUALIFIED_TIP = .*/, ""), gone);
  }
});

test("Category Battlecards opens on the hero pie row, then the chips, the category pies, and the table", () => {
  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  const heroesAt = panel.indexOf("<CategoryBattleHeroes");
  const chipsAt = panel.indexOf("<CategoryBattleChips");
  const piesAt = panel.indexOf("<CategoryLeadPies");
  const tableAt = panel.indexOf("Category battlecards");
  assert.ok(heroesAt >= 0 && chipsAt > heroesAt && piesAt > chipsAt && tableAt > piesAt);
  assert.match(panel, /import "@\/components\/v3\/live\/ai-search\/category-battlecards\.css"/);
  assert.match(panel, /<CategoryBattleHeroes\s+snapshot=\{scoped\}/, "every hero pie follows the engine chip");
  assert.match(panel, /sorted\.rows\.map/);
  assert.match(panel, /callsForEngine\(snapshot\.calls, filter\.engine\)/, "numbers come from the date pill's snapshot");
  assert.doesNotMatch(panel, /CategoryOnTrackVisual|leadSentence/, "the table already lists each category's figures");
  assert.doesNotMatch(panel, /RoleSumLine|CategoryCompetitorLeadGraph|category-competitor-lead-marks/, "the pies replace the old lead graph");

  const heroes = read("components/v3/live/ai-search/CategoryBattleHeroes.tsx");
  const onTrackAt = heroes.indexOf("<OnTrackHero");
  const ratesAt = heroes.indexOf("<RunDetailsLead snapshot={snapshot}");
  assert.ok(onTrackAt >= 0 && ratesAt > onTrackAt, "categories on track, then the two rates");
  assert.match(heroes, /<CitationPieDisc/);
  assert.match(heroes, /value: `\$\{role\}\/\$\{outcome\}`/);
  assert.match(heroes, /focus\("fender_win"\)/);
  assert.match(heroes, /focus\("resolved"\)/);
  const css = read("components/v3/live/ai-search/category-battlecards.css");
  assert.match(css, /\.ai-battle-heroes > \[data-ai-run-details-lead\] \{\s*display: contents;/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(
    css,
    /\.ai-battle-pies \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(max\(140px, calc\(\(100% - 30px\) \/ 6\)\), 1fr\)\);[^}]*gap: 6px;/,
    "at most six pies a row, so all six share one row at 1280 by 720",
  );
  assert.match(css, /\.ai-battle-heroes \.citation-pie-disc \{\s*width: 62px;\s*height: 62px;/, "hero pies stay at 62px");
  for (const size of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(size[1]) >= 10, `${size[0]} keeps the 10px floor`);

  const pies = read("components/v3/live/ai-search/CategoryLeadPies.tsx");
  assert.match(pies, /data-ai-battle-lead-graph=""/);
  assert.match(pies, /AiTerm term="unbranded discovery"/);
  assert.match(pies, /data-ai-on-track-status=\{lead\.status\}/);
  assert.match(pies, /<StatusMark status=\{status\} word=\{label\} \/>/, "a mark and a word carry each status, not color alone");
  assert.match(pies, /on_track: "good",\s*tied: "okay",\s*behind: "bad",\s*not_available: null/);
  assert.match(pies, /<EvidenceLink focus=\{focus\} tab=\{AI_TABS\.simulations\}/, "a pie opens its table row's evidence");
  assert.match(pies, /Top rival: \{lead\.topRival\.brand\}/);
  const chips = read("components/v3/live/ai-search/CategoryBattleChips.tsx");
  assert.match(chips, /aria-pressed=\{pressed\}/);
  assert.match(chips, /Clear filters/);
  assert.match(chips, /onChange\(NO_BATTLECARD_FILTER\)/);
});

test("Category Battlecards drops the Competitive Radar sentence and keeps its count under the Unbranded Discovery pie", () => {
  const calls = [
    ...times(3, {}),
    ...times(2, yamaha),
    call(taylor),
    call({ material_hallucination: "confirmed" }),
    call({ prompt: BRANDED, outcome: "competitor_win", primary_brand: "Gibson" }),
  ];
  const snapshot: AiSearchSnapshot = {
    run: {
      audit_run_id: "run-a",
      run_state: "completed",
      collector_version: "v11",
      prompt_set_hash: null,
      expected_calls: calls.length,
      attempted_calls: calls.length,
      answered_calls: calls.length,
      error_calls: 0,
      started_at: "2026-10-20T00:00:00Z",
      completed_at: "2026-10-20T01:00:00Z",
      published_at: "2026-10-20T01:00:00Z",
      missing_calls: 0,
    },
    calls,
    probes: [],
    citations: [],
  };
  const unbranded = summarizeRun(snapshot).roles.unbranded;
  assert.deepEqual([unbranded.competitorWins, unbranded.resolved], [3, 7]);
  assert.equal(
    competitorsSpokeLead({ phase: "ready", snapshot }).figure,
    `Competitors led ${unbranded.competitorWins} of ${unbranded.resolved} resolved unbranded discovery answers.`,
    "the caption's N of M is the sentence's N of M",
  );
  assert.notEqual(unbranded.resolved - unbranded.fenderWins, unbranded.competitorWins, "a product error is not a competitor lead");

  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  assert.match(panel, /data-ai-battlecards-tab=""/);
  const css = read("components/v3/live/ai-search/category-battlecards.css");
  assert.match(
    css,
    /\.drilldown-panel:has\(\[data-ai-battlecards-tab\]\) \.drilldown-desc:has\(> \[data-ai-competitor-desc\]\) \{\s*display: none;/,
  );
  for (const other of ["CompetitorWinsPanel.tsx", "EngineComparisonPanel.tsx"]) {
    assert.doesNotMatch(read(`components/v3/live/ai-search/${other}`), /data-ai-battlecards-tab/, `${other} keeps the sentence`);
  }
  assert.match(read("components/v3/live/ai-search/CompetitorsSpokeDescription.tsx"), /data-ai-competitor-desc=""/);
  assert.match(read("components/v3/build-live-spokes.tsx"), /descSlot: <CompetitorsSpokeDescription \/>/);

  const heroes = read("components/v3/live/ai-search/CategoryBattleHeroes.tsx");
  assert.match(heroes, /role="unbranded_discovery"\s+tally=\{roles\.unbranded\}\s+showCompetitors/);
  assert.doesNotMatch(heroes, /role="branded_consideration"[^>]*showCompetitors/);
  assert.match(heroes, /"Competitors led "/);
  assert.match(heroes, /focus\("competitor_win"\)/, "the competitor count opens those answers");
  assert.match(heroes, /` of \$\{formatInt\(tally\.resolved\)\}`/);
});

test("a table row's rate counts open that row's category, with or without an engine chip", () => {
  const rows = [
    call({ engine: "chatgpt", category: "acoustics" }),
    call({ engine: "gemini", category: "acoustics" }),
    call({ engine: "chatgpt", category: "amps" }),
    call({ engine: "gemini", category: "acoustics", ...yamaha }),
  ];
  const opened = (focus: Parameters<typeof explorerFilterFor>[0]) =>
    applyExplorerFilter(rows, explorerFilterFor(focus)).map((row) => row.id);
  const cell = (scope: { category: string; engine?: string }) =>
    scopeEvidence({ field: "role", value: "unbranded_discovery/fender_win" }, scope);

  const allEngines = cell({ category: "acoustics" });
  assert.equal(formatEvidence(allEngines), "role:unbranded_discovery/fender_win,category:acoustics");
  assert.deepEqual(parseEvidence(formatEvidence(allEngines)), allEngines);
  assert.deepEqual(opened(allEngines), [rows[0].id, rows[1].id], "every engine, this row's category only");
  assert.deepEqual(
    opened(scopeEvidence({ field: "role", value: "unbranded_discovery/resolved" }, { category: "acoustics" })),
    [rows[0].id, rows[1].id, rows[3].id],
  );
  const oneEngine = cell({ category: "acoustics", engine: "chatgpt" });
  assert.equal(formatEvidence(oneEngine), "role:unbranded_discovery/fender_win,category:acoustics,engine:chatgpt");
  assert.deepEqual(opened(oneEngine), [rows[0].id]);

  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  assert.doesNotMatch(panel, /rowScope = filter\.engine/, "the category no longer waits for an engine chip");
  assert.match(panel, /<EngineMark engineName=\{battle\.roles\.unbranded_discovery\.resolved > 0 \? engineName : null\} \/>/);
});

test("with an engine chip on, every evidence link on the tab opens that engine's rows, and its figure carries an asterisk", () => {
  assert.deepEqual(parseEvidence("category:acoustics"), { field: "category", value: "acoustics" });
  assert.equal(formatEvidence({ field: "category", value: "acoustics" }), "category:acoustics", "no chip, same link as before");
  const pie = scopeEvidence({ field: "category", value: "acoustics" }, { engine: "chatgpt" });
  assert.equal(formatEvidence(pie), "category:acoustics,engine:chatgpt");
  assert.deepEqual(parseEvidence(formatEvidence(pie)), pie);
  const cell = scopeEvidence({ field: "role", value: "unbranded_discovery/fender_win" }, { category: "amps", engine: "gemini" });
  assert.equal(formatEvidence(cell), "role:unbranded_discovery/fender_win,category:amps,engine:gemini");
  assert.deepEqual(parseEvidence(formatEvidence(cell)), cell);
  const plain = { field: "competitor", value: "Yamaha" } as const;
  assert.equal(scopeEvidence(plain, undefined), plain);

  const rows = [
    call({ engine: "chatgpt", category: "acoustics" }),
    call({ engine: "gemini", category: "acoustics" }),
    call({ engine: "chatgpt", category: "amps" }),
    call({ engine: "chatgpt", category: "acoustics", ...yamaha }),
  ];
  const opened = (focus: Parameters<typeof explorerFilterFor>[0]) =>
    applyExplorerFilter(rows, explorerFilterFor(focus)).map((row) => row.id);
  assert.deepEqual(opened(pie), [rows[0].id, rows[3].id]);
  assert.deepEqual(opened({ field: "category", value: "acoustics" }), [rows[0].id, rows[1].id, rows[3].id]);
  assert.deepEqual(
    opened(scopeEvidence({ field: "role", value: "unbranded_discovery/fender_win" }, { category: "acoustics", engine: "chatgpt" })),
    [rows[0].id],
  );
  assert.equal(
    engineOnlyNote("ChatGPT"),
    "ChatGPT only. Answers from the other engines are left out.\nClear the engine to see all engines.",
  );

  assert.match(read("components/v3/live/ai-search/EvidenceLink.tsx"), /data-ifai-evidence=\{focus \? formatEvidence\(focus\) : "all"\}/);
  const explorer = read("components/v3/live/ai-search/SimulationsExplorer.tsx");
  assert.doesNotMatch(explorer, /filterFromEvidence/, "Run Details reads the engine and category too");
  assert.equal(explorer.match(/explorerFilterFor\(focus\)/g)?.length, 3);
  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  assert.match(panel, /const engineScope = filter\.engine \? \{ engine: filter\.engine \} : undefined;/);
  assert.match(panel, /const rowScope = \{ category: battle\.key, \.\.\.engineScope \};/);
  assert.equal(panel.match(/scope=\{rowScope\}/g)?.length, 2, "both rate cells in a row");
  assert.equal(panel.match(/<EngineMark /g)?.length, 3, "the category name and both rate cells");
  assert.match(panel, /<CategoryLeadPies[\s\S]*?scope=\{engineScope\}[\s\S]*?engineName=\{engineName\}/);
  const pies = read("components/v3/live/ai-search/CategoryLeadPies.tsx");
  assert.match(pies, /scopeEvidence\(\{ field: "category", value: lead\.key \}, scope\)/);
  assert.match(pies, /if \(!engineName\) return null;/, "no asterisk with all engines");
  assert.match(pies, /<Term name=\{ENGINE_MARK_TITLE\} desc=\{engineOnlyNote\(engineName\)\} className="partial-figure-mark ai-battle-engine-mark">/);
  assert.equal(ENGINE_MARK_TITLE, "Filtered figure");
  const heroes = read("components/v3/live/ai-search/CategoryBattleHeroes.tsx");
  assert.match(heroes, /scopeEvidence\(\{ field: "role", value: `\$\{role\}\/\$\{outcome\}` \}, engineScope\)/);
  assert.equal(heroes.match(/<EngineMark /g)?.length, 3, "the on-track figure, both rate captions, and the competitor line");
  assert.match(read("components/v3/live/ai-search/RoleRateTable.tsx"), /scopeEvidence\(\{ field: "role", value: `\$\{role\}\/\$\{outcome\}` \}, scope\)/);
});

test("battlecard copy has no em dash and no native title tooltips", () => {
  for (const path of [
    "components/v3/live/ai-search/CategoryBattlecardsPanel.tsx",
    "components/v3/live/ai-search/CategoryBattleHeroes.tsx",
    "components/v3/live/ai-search/CategoryLeadPies.tsx",
    "components/v3/live/ai-search/CategoryBattleChips.tsx",
    "lib/ai-search/category-on-track.ts",
  ]) {
    const text = read(path);
    assert.doesNotMatch(text, /\u2014/, path);
    assert.doesNotMatch(text, /\stitle=/, path);
    if (path.endsWith(".tsx")) assert.ok(text.split("\n").length - 1 <= 400, `${path} stays at or under 400 lines`);
  }
  const pies = read("components/v3/live/ai-search/CategoryLeadPies.tsx");
  for (const attr of ['"ifai-term"', "data-ifai-tooltip-title", "data-ifai-tooltip-desc", "tabIndex={0}"]) {
    assert.ok(pies.includes(attr), attr);
  }
});
