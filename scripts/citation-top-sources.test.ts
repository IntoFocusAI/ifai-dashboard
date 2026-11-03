// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/citation-top-sources.test.ts
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { citationEvidence } from "../lib/ai-search/citations.ts";
import {
  categoryForScope,
  citationCategoryLabel,
  citationCategoryOptions,
  snapshotInCategory,
  topCitedSources,
  TOP_SITES_RULE,
  TOP_SOURCES_MAX,
} from "../lib/ai-search/citation-top-sources.ts";
import { citationPickLabel, citationPickMatches, pickAfterCategoryChange } from "../lib/ai-search/citation-pick.ts";
import { AI_DEFINITIONS } from "../lib/ai-search/definitions.ts";
import type { AiCallRow, AiCitationRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function call(id: string, category: string, patch: Partial<AiCallRow> = {}): AiCallRow {
  return {
    id,
    audit_run_id: "run",
    sim_id: Number(id.replace(/\D/g, "")) || 1,
    engine: "chatgpt",
    model: null,
    category,
    prompt: `Best ${category} pick`,
    prompt_key: id,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender/Squier",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-10-18T12:00:00.000Z",
    ...patch,
  };
}

function cite(simulationId: string, url: string, position = 1): AiCitationRow {
  return {
    audit_run_id: "run",
    sim_id: 1,
    simulation_id: simulationId,
    prompt_key: simulationId,
    prompt_kind: "commercial",
    category: null,
    engine: "chatgpt",
    position,
    url,
    domain: new URL(url).hostname,
    title: null,
  };
}

const calls: AiCallRow[] = [
  call("e1", "electrics"),
  call("e2", "electrics"),
  call("e3", "electrics"),
  call("a1", "acoustics"),
  call("a2", "acoustics"),
  call("a3", "acoustics", { call_status: "error", outcome: "error" }),
  call("p1", "hallucinations", { prompt_kind: "probe" }),
];

const citations: AiCitationRow[] = [
  // reddit: 1 answer, 3 links. fender: 3 answers, 3 links. sweetwater: 2 answers, 2 links.
  cite("e1", "https://www.reddit.com/r/guitar/a", 1),
  cite("e1", "https://www.reddit.com/r/guitar/b", 2),
  cite("e1", "https://www.reddit.com/r/guitar/c", 3),
  cite("e1", "https://www.fender.com/strat", 4),
  cite("e2", "https://www.fender.com/tele", 1),
  cite("e2", "https://www.sweetwater.com/strat", 2),
  cite("a1", "https://www.fender.com/acoustic", 1),
  cite("a1", "https://www.sweetwater.com/acoustic", 2),
  cite("a2", "https://www.guitarcenter.com/acoustic", 1),
  cite("p1", "https://www.fender.com/specs", 1),
];

const snapshot: AiSearchSnapshot = {
  run: {} as AiSearchSnapshot["run"],
  calls,
  probes: [],
  citations,
};

test("top sources rank by answers that cite the site, not by link count", () => {
  const ranked = topCitedSources(citationEvidence(calls, citations, "commercial"));
  assert.deepEqual(
    ranked.map((source) => [source.rank, source.domain, source.answers, source.answered, source.links]),
    [
      [1, "fender.com", 3, 5, 3],
      [2, "sweetwater.com", 2, 5, 2],
      [3, "reddit.com", 1, 5, 3],
      [4, "guitarcenter.com", 1, 5, 1],
    ],
  );
});

test("ties on answers go to the site with more cited links", () => {
  const ranked = topCitedSources(citationEvidence(calls, citations, "commercial"));
  const reddit = ranked.find((source) => source.domain === "reddit.com")!;
  const center = ranked.find((source) => source.domain === "guitarcenter.com")!;
  assert.equal(reddit.answers, center.answers);
  assert.ok(reddit.rank < center.rank, "reddit has 3 links to guitarcenter's 1");
});

test("the Cited links toggle ranks by links, ties go to more answers, and N of M is links of all links", () => {
  const ranked = topCitedSources(citationEvidence(calls, citations, "commercial"), TOP_SOURCES_MAX, "links");
  assert.deepEqual(
    ranked.map((source) => [source.rank, source.domain, source.links, source.linksTotal, source.answers]),
    [
      [1, "fender.com", 3, 9, 3],
      [2, "reddit.com", 3, 9, 1],
      [3, "sweetwater.com", 2, 9, 2],
      [4, "guitarcenter.com", 1, 9, 1],
    ],
  );
  assert.deepEqual(
    topCitedSources(citationEvidence(calls, citations, "commercial")),
    topCitedSources(citationEvidence(calls, citations, "commercial"), TOP_SOURCES_MAX, "answers"),
    "answers is the default measure",
  );
});

test("each row carries N of M answers and whether the site is Fender-owned", () => {
  const ranked = topCitedSources(citationEvidence(calls, citations, "commercial"));
  for (const source of ranked) {
    assert.equal(source.answered, 5, "M is answered shopping calls; the error call is out");
    assert.ok(source.answers <= source.answered);
    assert.equal(source.fenderOwned, source.domain === "fender.com");
  }
  assert.equal(ranked[0].classLabel, "Fender-owned");
  assert.equal(ranked.find((source) => source.domain === "sweetwater.com")!.classLabel, "Retailer");
});

test("the chart stops at ten sites", () => {
  assert.equal(TOP_SOURCES_MAX, 10);
  const many = Array.from({ length: 14 }, (_, index) => cite("e3", `https://site${index}.example.com/p`, index + 1));
  const ranked = topCitedSources(citationEvidence(calls, many, "commercial"));
  assert.equal(ranked.length, 10);
  assert.deepEqual(ranked.map((source) => source.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("a site's row opens exactly that site's citation rows", () => {
  const evidence = citationEvidence(calls, citations, "commercial");
  for (const source of topCitedSources(evidence)) {
    const rows = evidence.rows.filter((row) => citationPickMatches(row, { field: "domain", value: source.domain }));
    assert.equal(rows.length, source.links, source.domain);
    assert.equal(new Set(rows.map((row) => row.simulationId)).size, source.answers, source.domain);
  }
});

test("a category narrows the ranked list and the rows beneath it, and clearing restores them", () => {
  const all = citationEvidence(calls, citations, "commercial");
  const electrics = snapshotInCategory(snapshot, "electrics");
  const narrowed = citationEvidence(electrics.calls, electrics.citations, "commercial");
  assert.equal(narrowed.answered, 3);
  assert.ok(narrowed.rows.every((row) => row.category === "electrics"));
  assert.deepEqual(
    topCitedSources(narrowed).map((source) => [source.domain, source.answers, source.answered]),
    [
      ["fender.com", 2, 3],
      ["reddit.com", 1, 3],
      ["sweetwater.com", 1, 3],
    ],
  );
  assert.ok(!topCitedSources(narrowed).some((source) => source.domain === "guitarcenter.com"));
  assert.equal(snapshotInCategory(snapshot, null), snapshot, "no category is the same snapshot");
  assert.deepEqual(
    topCitedSources(citationEvidence(snapshot.calls, snapshot.citations, "commercial")),
    topCitedSources(all),
  );
});

test("category options use the stored category values in scope", () => {
  assert.deepEqual(citationCategoryOptions(calls, "commercial"), [
    { key: "electrics", label: "Electrics", answered: 3 },
    { key: "acoustics", label: "Acoustics", answered: 2 },
  ]);
  assert.deepEqual(
    citationCategoryOptions(calls, "all").map((option) => option.label),
    ["Electrics", "Acoustics", "Product fact checks"],
  );
  assert.equal(citationCategoryLabel("hallucinations"), "Product fact checks");
  assert.equal(categoryForScope(calls, "all", "electrics"), "electrics");
  assert.equal(categoryForScope(calls, "probe", "electrics"), null);
  assert.equal(categoryForScope(calls, "commercial", null), null);
});

test("an active category adds one Clear button to the control row and keeps its sentence for screen readers", () => {
  const filter = read("components/v3/live/ai-search/CitationCategoryFilter.tsx").replace(/\s+/g, " ");
  assert.match(filter, /aria-pressed=\{active\?\.key === option\.key\}/);
  assert.match(filter, /<span className="sr-only"> Showing \{active\.label\} only: \{active\.answered\} \{scopeNoun\}\. <\/span>/);
  assert.match(filter, /data-citation-category-clear onClick=\{\(\) => onChange\(null\)\} > Clear category <\/button>/);
});

test("the cited-links title names the category, and a new category keeps only site-level picks", () => {
  assert.equal(citationPickLabel(null), "every cited link");
  assert.equal(citationPickLabel(null, "electrics"), "every cited link in Electrics");
  assert.equal(citationPickLabel({ field: "domain", value: "reddit.com" }, "electrics"), "reddit.com in Electrics");
  assert.equal(citationPickLabel({ field: "category", value: "hallucinations" }), "Product fact checks");
  const domain = { field: "domain", value: "reddit.com" } as const;
  assert.equal(pickAfterCategoryChange(domain), domain);
  assert.equal(pickAfterCategoryChange({ field: "category", value: "amps" }), null);
  assert.equal(pickAfterCategoryChange({ field: "gap", value: "amps", simulationIds: ["e1"] }), null);
});

test("Citation Ecosystem opens with figure tiles, one control row, then the chart beside the tiles", () => {
  const panel = read("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  const hero = panel.indexOf("<CitationHero");
  const notes = panel.indexOf("How these counts work");
  const engines = panel.indexOf('tableId="citation-engines"');
  const evidence = panel.indexOf("<CitationEvidenceTable");
  assert.ok(hero >= 0 && hero < notes && notes < engines && engines < evidence, "the method notes and tables stay below");
  const glance = read("components/v3/live/ai-search/CitationHero.tsx");
  const order = [
    "<CitationFigureTiles",
    "data-citation-control-row",
    "<CitationControlsStrip",
    "<CitationCategoryFilter",
    'className="citation-glance-grid"',
    "<CitationTopSources",
    "<CitationExecutiveGrid",
    "<GapsCard",
  ].map((marker) => glance.indexOf(marker));
  assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])), `order ${order}`);
  const tiles = read("components/v3/live/ai-search/CitationFigureTiles.tsx");
  assert.ok(tiles.indexOf("<CitationLeadFigure") < tiles.indexOf("data-ai-cited-answers"));
  assert.ok(tiles.indexOf("data-ai-cited-answers") < tiles.indexOf("data-ai-cited-links"));
  assert.match(panel, /lead=\{\{ owned: fender\.length, total: read\.rows\.length \}\}/, "the lead counts the filtered rows");
  assert.match(glance, /<CitationFigureTiles[^>]*category=\{category \? citationCategoryLabel\(category\) : null\}/s);
  assert.ok(panel.split("\n").length - 1 <= 400);
});

test("with a category picked, each figure tile carries an asterisk whose tooltip names it", () => {
  const mark = read("components/v3/live/ai-search/CitationFilteredMark.tsx").replace(/\s+/g, " ");
  assert.match(mark, /if \(!category\) return null;/, "clearing the category removes the asterisk");
  assert.match(mark, /const description = `\$\{category\} only\. Clear the category to see all categories\.`;/);
  assert.match(mark, /className="ifai-term citation-figure-filtered"/);
  assert.match(mark, /data-ifai-tooltip-desc=\{description\}/);
  assert.match(mark, /tabIndex=\{0\}/);
  assert.match(mark, /aria-label=\{`Category filter: \$\{description\}`\}/);
  assert.match(mark, /> \* <\/span>/);
  assert.doesNotMatch(mark, /\stitle=/);
  const tiles = read("components/v3/live/ai-search/CitationFigureTiles.tsx");
  const lead = read("components/v3/live/ai-search/CitationLeadFigure.tsx");
  assert.match(tiles, /<CitationLeadFigure [^>]*category=\{category\}/);
  assert.equal(tiles.match(/<CitationFilteredMark category=\{category\} \/>/g)?.length, 2, "answers and total tiles");
  assert.match(lead, /<CitationFilteredMark category=\{category\} \/>/, "lead tile");
  for (const text of [tiles, lead]) assert.doesNotMatch(text, /` in \$\{|\bwithin\b/, "no on-screen \"in Amps\" wording");
  assert.match(lead, /<AiTerm term="Fender-owned">Fender-owned<\/AiTerm> links\s*<\/span>/);
  const notAvailable = tiles.slice(tiles.indexOf(") : ("), tiles.indexOf("Not available*"));
  assert.doesNotMatch(notAvailable, /CitationFilteredMark/, "Not available* keeps its own asterisk only");
});

test("the Fender-owned lead follows the category", () => {
  const electrics = snapshotInCategory(snapshot, "electrics");
  const narrowed = citationEvidence(electrics.calls, electrics.citations, "commercial");
  const owned = narrowed.rows.filter((row) => row.sourceClass === "fender_owned").length;
  assert.deepEqual([owned, narrowed.rows.length], [2, 6], "electrics: fender 2 of 6 links");
  const all = citationEvidence(snapshot.calls, snapshot.citations, "commercial");
  assert.deepEqual(
    [all.rows.filter((row) => row.sourceClass === "fender_owned").length, all.rows.length],
    [3, 9],
    "clearing restores every category",
  );
  assert.equal(citationCategoryLabel("amps"), "Amps");
});

test("bars scale to the largest count shown, and N of M sits beside each bar", () => {
  const chart = read("components/v3/live/ai-search/CitationTopSources.tsx");
  assert.match(chart, /const max = Math\.max\(1, \.\.\.ranked\.map/);
  assert.match(chart, /width: `\$\{\(100 \* n\) \/ max\}%`/);
  assert.match(chart, /<strong>\{n\}<\/strong> of \{m\}/);
  assert.match(chart, /\[source\.links, source\.linksTotal\] : \[source\.answers, source\.answered\]/);
  assert.match(chart, /citation-top-source-owner">Fender-owned</);
  const css = read("components/v3/live/ai-search/citation-glance.css");
  assert.match(css, /\.citation-glance-grid \{[^}]*grid-template-columns: minmax\(0, [\d.]+fr\) minmax\(0, 1fr\)/s);
  assert.match(css, /\.citation-figure-tiles \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/s);
  const narrow = css.match(/@container citation-glance \(max-width: 1060px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(narrow, /\.citation-top-source-list \{[^}]*grid-auto-flow: column;[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(chart, /gridTemplateRows: `repeat\(\$\{Math\.ceil\(ranked\.length \/ 2\)\}, auto\)`/);
  for (const path of [css, read("components/v3/live/ai-search/citation-top-sources.css")]) {
    for (const size of path.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(size[1]) >= 10, size[0]);
  }
});

test("each measure's rule is one sentence in a custom tooltip that names that measure", () => {
  assert.deepEqual(TOP_SITES_RULE, { answers: "top cited sites", links: "top cited sites by links" });
  const answers = AI_DEFINITIONS[TOP_SITES_RULE.answers];
  const links = AI_DEFINITIONS[TOP_SITES_RULE.links];
  for (const rule of [answers, links]) {
    assert.equal(rule.split(/[.!?](\s|$)/).filter((part) => part.trim()).length, 1, rule);
  }
  assert.match(answers, /how many answers in the selected period cite it/);
  assert.match(links, /how many cited links in the selected period point to it/);
  const chart = read("components/v3/live/ai-search/CitationTopSources.tsx");
  assert.match(chart, /<AiTerm term=\{TOP_SITES_RULE\[measure\]\}>Top cited sites<\/AiTerm>/);
  assert.match(chart, /\["answers", "Answers citing"\],\s*\["links", "Cited links"\]/);
  assert.match(chart, /useState<TopSitesMeasure>\("answers"\)/, "answers is the default");
  assert.match(chart, /aria-pressed=\{measure === value\}/);
});

test("the tab has one ranked chart of sites, and Fender-owned rows say so in words", () => {
  const dir = "components/v3/live/ai-search";
  assert.ok(!existsSync(join(root, dir, "CitationDomainsMix.tsx")), "the older domains list is gone");
  for (const name of readdirSync(join(root, dir)).filter((file) => file.endsWith(".tsx"))) {
    assert.doesNotMatch(read(join(dir, name)), /CitationDomainsMix|data-citation-domains-mix/, name);
  }
  const chart = read(join(dir, "CitationTopSources.tsx"));
  assert.match(chart, /citation-top-source-owner">Fender-owned</);
  assert.match(chart, /width: `\$\{\(100 \* n\) \/ max\}%`/);
});

test("the ranking rule is one plain sentence in a custom tooltip, and the copy claims no cause", () => {
  const rule = AI_DEFINITIONS["top cited sites"];
  assert.equal(rule.split(/[.!?](\s|$)/).filter((part) => part.trim()).length, 1);
  assert.match(rule, /how many answers in the selected period cite it/);
  assert.match(rule, /more cited links/);
  const files = [
    "components/v3/live/ai-search/CitationTopSources.tsx",
    "components/v3/live/ai-search/CitationCategoryFilter.tsx",
    "components/v3/live/ai-search/CitationCountTable.tsx",
    "components/v3/live/ai-search/CitationFigureTiles.tsx",
    "components/v3/live/ai-search/CitationHero.tsx",
    "components/v3/live/ai-search/CitationExecutiveGrid.tsx",
    "components/v3/live/ai-search/CitationGapsCard.tsx",
    "components/v3/live/ai-search/CitationLeadFigure.tsx",
    "components/v3/live/ai-search/CitationFilteredMark.tsx",
  ];
  for (const path of files) {
    const text = read(path);
    assert.doesNotMatch(text, /\stitle=/, path);
    assert.doesNotMatch(text, /\u2014/, path);
    assert.doesNotMatch(text, /\b(drove|drives|drive|influenced|because of|thanks to|led to the answer)\b/i, path);
    assert.doesNotMatch(text, /(?<!not show that )the site caused/, path);
    assert.doesNotMatch(text, /\bfees?\b|retainer/i, path);
  }
  assert.match(read(files[0]), /does not show that the site caused what the answer said/);
});
