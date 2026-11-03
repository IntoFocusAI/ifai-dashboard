// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/category-on-track.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  battlecardEngines,
  callsForEngine,
  categoryLeads,
  categoryLeadStatus,
  categoryLeadSummary,
  effectiveBattlecardFilter,
  isBattlecardFiltered,
  leadMatches,
  leadSentence,
  leadStatusDefinition,
  NO_BATTLECARD_FILTER,
} from "../lib/ai-search/category-on-track.ts";
import { categoryRoleTallies } from "../lib/ai-search/question-role.ts";
import type { AiCallRow } from "../lib/ai-search/types.ts";

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

test("on track means Fender/Squier leads more resolved answers than every other brand together", () => {
  assert.equal(categoryLeadStatus({ resolved: 10, fenderWins: 6, competitorWins: 4 }), "on_track");
  assert.equal(categoryLeadStatus({ resolved: 10, fenderWins: 4, competitorWins: 6 }), "behind");
  assert.equal(categoryLeadStatus({ resolved: 10, fenderWins: 5, competitorWins: 5 }), "even");
  assert.equal(categoryLeadStatus({ resolved: 0, fenderWins: 0, competitorWins: 0 }), "not_available");
  // Fender/Squier 8, Yamaha 6, Taylor 6: no single rival out-leads Fender/Squier, but rivals together do.
  const [lead] = leadsOf([...times(8, {}), ...times(6, yamaha), ...times(6, taylor)]);
  assert.equal(lead.status, "behind");
  assert.equal(lead.resolved, 20);
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
  assert.equal(leadSentence(lead), "Other brands lead 5 of 8 resolved answers, all Yamaha. Fender/Squier leads 3.");
});

test("a confirmed product error stays in the denominator and in neither lead", () => {
  const [lead] = leadsOf([...times(4, {}), ...times(2, { material_hallucination: "confirmed" }), ...times(3, yamaha)]);
  assert.equal(lead.resolved, 9);
  assert.equal(lead.fenderLeads, 4);
  assert.equal(lead.disqualified, 2);
  assert.equal(lead.status, "on_track");
  assert.match(leadSentence(lead), /^Fender\/Squier leads 4 of 9 resolved answers\. Other brands lead 3, all Yamaha\. 2 more/);
});

test("categories sort behind first, then the weakest Fender/Squier share, and a category with no unbranded questions is last", () => {
  const rows = [
    ...times(9, { category: "amps" }),
    ...times(1, { category: "amps", ...yamaha }),
    ...times(3, { category: "basses" }),
    ...times(2, { category: "basses", ...yamaha }),
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
      ["basses", "on_track"],
      ["amps", "on_track"],
      ["squier", "not_available"],
    ],
  );
  assert.equal(leadSentence(leads[0]), "Other brands lead 10 of 12 resolved answers, Yamaha the most (7). Fender/Squier leads 2.");
  assert.equal(leadSentence(leads[2]), "Fender/Squier leads 9 of 10 resolved answers. Other brands lead 1, all Yamaha.");
  assert.equal(leadSentence(leads[3]), "No unbranded discovery questions in this category.");
  assert.match(leadStatusDefinition(leads[3]), /no unbranded discovery questions/);
  assert.deepEqual(categoryLeadSummary(leads), { measured: 3, onTrack: 2, behind: ["Acoustics"], even: [] });
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
  for (const status of ["on_track", "behind", "even", "not_available"] as const) assert.ok(leadMatches(status, "all"));
  assert.equal(isBattlecardFiltered(NO_BATTLECARD_FILTER), false);
  assert.equal(isBattlecardFiltered({ engine: "gemini", lead: "all" }), true);
  assert.equal(isBattlecardFiltered({ engine: "", lead: "other" }), true);
  assert.deepEqual(effectiveBattlecardFilter({ engine: "claude", lead: "other" }, ["chatgpt"]), { engine: "", lead: "other" });
  assert.deepEqual(effectiveBattlecardFilter({ engine: "chatgpt", lead: "all" }, ["chatgpt"]), { engine: "chatgpt", lead: "all" });
});

test("Category Battlecards opens on the on-track visual, then the two rates, then the table", () => {
  const panel = read("components/v3/live/ai-search/CategoryBattlecardsPanel.tsx");
  const visualAt = panel.indexOf("<CategoryOnTrackVisual");
  const chipsAt = panel.indexOf("<CategoryBattleChips");
  const ratesAt = panel.indexOf("<RunDetailsLead");
  const tableAt = panel.indexOf("Category battlecards");
  assert.ok(visualAt >= 0 && chipsAt > visualAt && ratesAt > chipsAt && tableAt > ratesAt);
  assert.match(panel, /import "@\/components\/v3\/live\/ai-search\/category-battlecards\.css"/);
  assert.match(panel, /<RunDetailsLead snapshot=\{scoped\}/, "the two rates follow the engine chip");
  assert.match(panel, /sorted\.rows\.map/);
  assert.match(panel, /callsForEngine\(snapshot\.calls, filter\.engine\)/, "numbers come from the date pill's snapshot");
  const visual = read("components/v3/live/ai-search/CategoryOnTrackVisual.tsx");
  assert.match(visual, /data-ai-battle-lead-graph=""/);
  assert.match(visual, /data-ai-on-track-status=\{lead\.status\}/);
  assert.match(visual, /LEAD_STATUS_ICONS\[lead\.status\]/, "an icon and a word carry each status, not color alone");
  const chips = read("components/v3/live/ai-search/CategoryBattleChips.tsx");
  assert.match(chips, /aria-pressed=\{pressed\}/);
  assert.match(chips, /Clear filters/);
  assert.match(chips, /onChange\(NO_BATTLECARD_FILTER\)/);
});

test("battlecard copy has no em dash and no native title tooltips", () => {
  for (const path of [
    "components/v3/live/ai-search/CategoryBattlecardsPanel.tsx",
    "components/v3/live/ai-search/CategoryOnTrackVisual.tsx",
    "components/v3/live/ai-search/CategoryBattleChips.tsx",
    "lib/ai-search/category-on-track.ts",
  ]) {
    const text = read(path);
    assert.doesNotMatch(text, /\u2014/, path);
    assert.doesNotMatch(text, /\stitle=/, path);
    if (path.endsWith(".tsx")) assert.ok(text.split("\n").length - 1 <= 400, `${path} stays at or under 400 lines`);
  }
  const visual = read("components/v3/live/ai-search/CategoryOnTrackVisual.tsx");
  for (const attr of ['className="ifai-term"', "data-ifai-tooltip-title", "data-ifai-tooltip-desc", "tabIndex={0}"]) {
    assert.ok(visual.includes(attr), attr);
  }
});
