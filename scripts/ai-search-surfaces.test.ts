// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-surfaces.test.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tabIndexFromSlug, tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";
import { AI_TABS, RADAR_TABS } from "../lib/ai-search/canvas-surfaces.ts";

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
  assert.match(summary, /value: "error"/);
  assert.match(summary, /value: "probe"/);
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
  for (const figure of ["$680,000", "$38M to $62M", "$50,000,000"]) assert.ok(roi.includes(figure), figure);
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
  assert.match(flatView, /product questions IntoFocus sends to every engine on purpose/);
  assert.match(flatView, /not a randomly chosen product/);
});

test("citation copy separates answers from links and avoids causal claims", () => {
  // JSX spacing ({" "}) collapsed too, so the rendered sentence can be matched whole.
  const prose = (path: string) => flat(path).replace(/\{" "\}\s*/g, " ");
  // The headline chain counts answers, then the answers that showed sources, then the links they listed.
  const chain = prose("components/v3/live/ai-search/CitationChain.tsx");
  assert.match(chain, /= citationChain\(read, lead\);/);
  assert.match(flat("lib/ai-search/citation-lead.ts"), /const \{ answered, answersWithCitation: showed \} = read;/);
  assert.match(chain, /data-ai-cited-answers> \{count\(showed\)\} of \{count\(answered\)\} \{scopeNoun\} showed sources </);
  assert.match(chain, /data-ai-cited-links> \{count\(links\)\} <\/span>/);
  assert.match(chain, /links: "Every web page those answers listed\. One answer can list several\."/);
  const steps = ["answers", "showed", "links", "owned"].map((step) => chain.indexOf(`data-citation-chain-step="${step}"`));
  assert.ok(steps.every((at, index) => at >= 0 && (index === 0 || at > steps[index - 1])), `chain order ${steps}`);
  assert.doesNotMatch(chain, /cited web sources|answers citing|cited links/i, "the chain uses the plain names");
  const panel = prose("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  const notes = panel.slice(panel.indexOf("<summary>How these counts work</summary>"));
  assert.ok(notes.length < panel.length, "the counts note is on the panel");
  assert.match(notes, /Answers and links are separate counts/);
  assert.match(
    notes,
    /\{read\.answersWithCitation\} \{scopeNoun\} produced \{read\.rows\.length\} links, so one answer can cite several pages/,
  );
  assert.match(notes, /does not measure whether the page caused the recommendation/);
  assert.match(notes, /a citation is not an endorsement/);
  const citationFiles = files("components/v3/live/ai-search", ".tsx").filter((path) => /\/Citation\w*\.tsx$/.test(path));
  assert.ok(citationFiles.length >= 10, "every Citation Ecosystem component is checked");
  for (const path of citationFiles) {
    assert.doesNotMatch(read(path), /valid link|valid cited/, path);
  }
  const note = flat("components/v3/live/ai-search/CitationRoleNote.tsx");
  assert.match(note, /canonical product facts/);
  assert.match(note, /products they can buy/);
  assert.match(note, /independent authority/);
  assert.match(note, /less control over the facts/);
  assert.match(note, /A low count does not prove a source had no influence/);
  assert.match(note, /export const CITED_LINK_COUNT_CAVEAT = "A low count does not prove a source had no influence/);
  const callout = note.slice(note.indexOf("export function CitationRoleNote"));
  assert.doesNotMatch(callout, /A low count|not a worse outcome/, "the callout keeps no qualifier on screen");
  for (const title of ["Links", "Fender-owned links"]) {
    const tooltip = new RegExp(`headerTooltip: \\{ title: "${title}", description: \`[^\`]*\\$\\{CITED_LINK_COUNT_CAVEAT\\}\``);
    assert.match(panel, tooltip, `the low-count caveat sits in the ${title} column tooltip`);
  }
  assert.match(panel, /columns=\{ENGINE_COLUMNS\}/);
  assert.match(panel, /const ENGINE_COLUMNS = \[ [^\]]*\.\.\.LINK_COLUMNS, \]/);
});

test("the old authored citation percentages stay retired", () => {
  for (const path of files("components/v3/live/ai-search", ".tsx")) {
    assert.doesNotMatch(read(path), /31%|24%|19%|14%|12% of total AI citations/, path);
  }
});
