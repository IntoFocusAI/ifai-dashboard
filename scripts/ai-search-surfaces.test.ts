// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-surfaces.test.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tabIndexFromSlug, tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";
import { AI_TABS, RADAR_TABS } from "../lib/ai-search/canvas-surfaces.ts";
import { applyExplorerFilter, filterFromEvidence } from "../lib/ai-search/explorer-filter.ts";
import type { AiCallRow } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");
/** Source with JSX line wrapping collapsed, so copy assertions read as sentences. */
const flat = (path: string) => read(path).replace(/\s+/g, " ");
const spec = JSON.parse(read("data/fender-v3-spec.json"));

function files(dir: string, ext: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) return files(rel, ext);
    return rel.endsWith(ext) ? [rel] : [];
  });
}

test("AI Search and Competitive Radar tabs match the panels", () => {
  assert.deepEqual(spec.spokes.aeo.tabs, Object.values(AI_TABS));
  assert.deepEqual(spec.spokes.competitors.tabs, Object.values(RADAR_TABS));
});

test("old AI Search and Competitive Radar slugs still open the same tab", () => {
  const aeo = spec.spokes.aeo.tabs as string[];
  const radar = spec.spokes.competitors.tabs as string[];
  const copied: Array<[string[], string, number]> = [
    [aeo, "dual-index-scoring-executive-callout", 0],
    [aeo, "100-ai-simulations-interactive-explorer", 1],
    [aeo, "ai-spec-hallucination-engine-root-causes", 2],
    [aeo, "citation-ecosystem-fender-dtc-opportunity", 3],
    [aeo, "hallucination", 2],
    [radar, "head-to-head-category-battlecards", 0],
    [radar, "rival-strategies-countermeasures", 1],
    [radar, "multi-marketplace-channel-scope-sweetwater-reverb-walmart", 2],
  ];
  for (const [tabs, slug, index] of copied) assert.equal(tabIndexFromSlug(tabs, slug), index, slug);
  for (const tabs of [aeo, radar]) {
    tabs.forEach((tab, index) => assert.equal(tabIndexFromSlug(tabs, tabSlug(tab)), index));
  }
});

test("Competitive Radar has no retail-channel coverage", () => {
  const radar = JSON.stringify(spec.spokes.competitors);
  const panels = ["CategoryBattlecardsPanel", "CompetitorWinsPanel", "EngineComparisonPanel"].map((name) =>
    read(`components/v3/live/ai-search/${name}.tsx`),
  );
  for (const text of [radar, ...panels]) {
    assert.doesNotMatch(text, /Sweetwater|Reverb|Walmart|listing_channel_price|shelf price/i);
    assert.doesNotMatch(text, /\bMAP\b/);
  }
});

test("AI surfaces never read the pooled canvas_metrics sim fields", () => {
  for (const path of [
    "lib/fender-canvas/nodes-from-live.ts",
    "lib/fender-canvas/tour-from-live.ts",
    "lib/fender-canvas/command-center-from-live.ts",
    ...files("lib/ai-search", ".ts"),
    ...files("components/v3/live/ai-search", ".tsx"),
  ]) {
    assert.doesNotMatch(read(path), /\bm\.sim_|sim_win_pct|sim_hallucinations/, path);
  }
});

test("every headline figure opens its evidence", () => {
  const summary = read("components/v3/live/ai-search/RunSummaryPanel.tsx");
  for (const value of [
    "\\$\\{tally\\.role\\}/fender_win",
    "\\$\\{tally\\.role\\}/resolved",
    "brand_associated_discovery/resolved",
    "shopping_guidance",
    "product_fact",
  ]) {
    assert.match(summary, new RegExp(value), value);
  }
  assert.match(summary, /value: "probe"/);
  // Provider errors sit on the run card, for one run and for a pooled selection alike.
  assert.match(summary, /<RunCompletenessCard snapshot=\{snapshot\} \/>/);
  const card = flat("components/v3/live/ai-search/RunCompletenessCard.tsx");
  const errorLinks = card.match(
    /<td>Provider errors<\/td> <td> <EvidenceLink focus=\{\{ field: "outcome", value: "error" \}\} tab=\{SIM\}> \{errorLine\(s\)\}/g,
  );
  assert.equal(errorLinks?.length, 2, "single-run and pooled cards both link the provider-error count");
  const failed = filterFromEvidence({ field: "outcome", value: "error" });
  const calls = [
    { id: "a", sim_id: 1, prompt_kind: "commercial", call_status: "error", outcome: "error" },
    { id: "b", sim_id: 2, prompt_kind: "probe", call_status: "error", outcome: "error" },
    { id: "c", sim_id: 3, prompt_kind: "commercial", call_status: "answered", outcome: "fender_win" },
  ] as AiCallRow[];
  assert.deepEqual(
    applyExplorerFilter(calls, failed).map((row) => row.id),
    ["a", "b"],
    "the link opens every failed call, fact checks included",
  );
  assert.match(read("components/v3/live/ai-search/CitationEcosystemPanel.tsx"), /CitationEvidenceTable/);
  assert.match(read("components/v3/live/ai-search/FactCheckTable.tsx"), /field: "sim"/);
  assert.match(read("components/v3/live/ai-search/CompetitorWinsPanel.tsx"), /field: "sim"/);
});

test("remediation and root cause render only through the genuine-text check", () => {
  const drawer = read("components/v3/live/ai-search/SimulationEvidenceDrawer.tsx");
  assert.doesNotMatch(read("components/v3/live/ai-search/FactCheckEvidence.tsx"), /root_cause|remediation/);
  assert.match(drawer, /genuineGuidance\(row\.root_cause/);
  assert.match(drawer, /genuineGuidance\(row\.remediation_patch/);
  assert.match(drawer, /\{remediation \? \(/);
});

test("dotted AI definitions use the custom tooltip, never a native title", () => {
  const term = read("components/v3/live/ai-search/AiTerm.tsx");
  for (const attr of ['className="ifai-term"', "data-ifai-tooltip-title", "data-ifai-tooltip-desc", "tabIndex={0}", "aria-label"]) {
    assert.ok(term.includes(attr), attr);
  }
  for (const path of files("components/v3/live/ai-search", ".tsx")) {
    assert.doesNotMatch(read(path), /\stitle=/, path);
  }
});

test("TSX files stay within 400 lines", () => {
  for (const path of [...files("components/v3", ".tsx"), ...files("lib/fender-canvas", ".tsx")]) {
    const lines = read(path).split("\n").length - 1;
    assert.ok(lines <= 400, `${path} has ${lines} lines`);
  }
});

test("client copy has no em dashes", () => {
  for (const path of [...files("components/v3/live/ai-search", ".tsx"), ...files("lib/ai-search", ".ts")]) {
    // Stored answers are quoted as returned. Their punctuation is not authored dashboard copy.
    if (path.endsWith("lib/ai-search/stored-run-copy-data.ts")) continue;
    assert.doesNotMatch(read(path), /\u2014/, path);
  }
});

test("protected surfaces are unchanged", () => {
  assert.match(read("lib/canvas-sdk/canvas-chrome-flags.ts"), /SHOW_HEADER_TICKERS = false/);
  const spokes = read("components/v3/build-live-spokes.tsx");
  // The retail panels stay bound to the retail read. The prop list is not pinned: the
  // Featured Offer reading also passes job freshness so it uses its own clock.
  assert.match(spokes, /<RetailOverview read=\{retail\}/);
  assert.match(spokes, /<SuppressedListingsPanel read=\{retail\}/);
  assert.match(spokes, /<MapChannelPanel/);
  const roi = JSON.stringify(spec.spokes.suggestions);
  for (const figure of ["{phase_one_lift}", "{enterprise_potential}", "$50M midpoint"]) assert.ok(roi.includes(figure), figure);
  assert.doesNotMatch(roi, /Reddit \/r\/Guitar Community|largest SOV gaps/);
});

test("the fact-check headline leads with the business result, not a zero", () => {
  const panel = read("components/v3/live/ai-search/AiDriftPanel.tsx");
  const copy = read("lib/ai-search/fact-check-copy.ts");
  assert.match(copy, /Fender product fact/);
  assert.match(copy, /No contradictions were found in/);
  assert.match(copy, /These checks cover the selected facts only/);
  assert.match(copy, /not every factual claim in the shopping answers/);
  // No zero-led commercial coverage statement, and no collector or regex terminology.
  for (const text of [panel, copy]) {
    assert.doesNotMatch(text, /commercialChecked|commercialAnswered/, "commercial zero statement");
    assert.doesNotMatch(text, /regex|pattern check|collector|probe call/i);
  }
  assert.doesNotMatch(panel, /0 confirmed/);
});

test("the fact-check evidence view runs question, fact, source, answer, result", () => {
  const view = read("components/v3/live/ai-search/FactCheckEvidence.tsx");
  const order = ["Question checked", "Verified Fender fact", "Official Fender source", "AI answer", "Result"];
  let cursor = -1;
  for (const [index, heading] of order.entries()) {
    const at = view.indexOf(`heading="${heading}"`);
    assert.ok(at > cursor, `step ${index + 1} is ${heading}`);
    cursor = at;
  }
  assert.ok(view.indexOf("Engine and run details") > cursor, "engine details stay last");
  const flatView = flat("components/v3/live/ai-search/FactCheckEvidence.tsx");
  assert.match(
    flatView,
    /<CopyTip label=\{FACT_CHECK_METHOD_TITLE\} description=\{factCheckPickTip\(questionsSent\)\}> product questions <\/CopyTip>\{" "\} IntoFocus sends to every engine on purpose\./,
  );
  assert.doesNotMatch(flatView, /randomly chosen/);
});

test("citation copy separates answers from links and avoids causal claims", () => {
  const panel = read("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  assert.match(panel, /cited web sources/);
  assert.match(panel, /Those answers contained \{read\.rows\.length\}/);
  const flatPanel = flat("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  assert.match(flatPanel, /Answers and links are separate counts/);
  assert.match(flatPanel, /does not measure whether the page caused the recommendation/);
  assert.match(flatPanel, /not an endorsement/);
  for (const path of [
    "components/v3/live/ai-search/CitationEcosystemPanel.tsx",
    "components/v3/live/ai-search/CitationEvidenceTable.tsx",
    "components/v3/live/ai-search/CitationRoleNote.tsx",
  ]) {
    assert.doesNotMatch(read(path), /valid link|valid cited/, path);
  }
  const note = flat("components/v3/live/ai-search/CitationRoleNote.tsx");
  assert.match(note, /canonical product facts/);
  assert.match(note, /products they can buy/);
  assert.match(note, /independent authority/);
  assert.match(note, /less control over the facts/);
  assert.match(note, /A low count does not prove a source had no influence/);
});

test("the old authored citation percentages stay retired", () => {
  for (const path of files("components/v3/live/ai-search", ".tsx")) {
    assert.doesNotMatch(read(path), /31%|24%|19%|14%|12% of total AI citations/, path);
  }
});
