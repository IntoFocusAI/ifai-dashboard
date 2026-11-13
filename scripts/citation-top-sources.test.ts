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

test("Citation Ecosystem opens with the headline chain, one control row, then the chart beside the tiles", () => {
  const panel = read("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  const hero = panel.indexOf("<CitationHero");
  const notes = panel.indexOf("How these counts work");
  const engines = panel.indexOf('tableId="citation-engines"');
  const evidence = panel.indexOf("<CitationEvidenceTable");
  assert.ok(hero >= 0 && hero < notes && notes < engines && engines < evidence, "the method notes and tables stay below");
  const glance = read("components/v3/live/ai-search/CitationHero.tsx");
  const order = [
    "<CitationChain",
    "data-citation-control-row",
    "<CitationControlsStrip",
    "<CitationCategoryFilter",
    'className="citation-glance-grid"',
    "<CitationTopSources",
    "<CitationExecutiveGrid",
    "<GapsCard",
  ].map((marker) => glance.indexOf(marker));
  assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])), `order ${order}`);
  assert.doesNotMatch(glance, /CitationFigureTiles|CitationLeadFigure/, "the three figure tiles are retired");
  const chain = read("components/v3/live/ai-search/CitationChain.tsx");
  assert.ok(chain.indexOf("data-ai-cited-answers") < chain.indexOf("data-ai-cited-links"));
  assert.ok(chain.indexOf("data-ai-cited-links") < chain.indexOf("data-citation-lead-figure"));
  assert.match(panel, /lead=\{\{ owned: fender\.length, total: read\.rows\.length \}\}/, "the lead counts the filtered rows");
  assert.match(glance, /<CitationChain[^>]*category=\{category \? citationCategoryLabel\(category\) : null\}/s);
  for (const path of [panel, chain, glance]) assert.ok(path.split("\n").length - 1 <= 400);
});

test("each chain step has a one-line definition in a custom tooltip, and the split is named", () => {
  const chain = read("components/v3/live/ai-search/CitationChain.tsx").replace(/\s+/g, " ");
  const definitions = {
    showed: "Answers that listed web pages as sources. The sites and shares on this tab come from these answers.",
    none: "Answers given without showing a web page. These rely on what the model already knows.",
    links: "Every web page those answers listed. One answer can list several.",
    owned: "Links that lead to ${brandSite()} and other ${brandOwned()} sites.",
  };
  for (const [key, text] of Object.entries(definitions)) {
    assert.ok(chain.includes(`${key}: "${text}"`) || chain.includes(`${key}: \`${text}\``), key);
  }
  for (const [title, key, label] of [
    ["Showed sources", "showed", "showed sources"],
    ["No sources", "none", "{count(none)} no sources"],
    ["Links", "links", "links"],
    ["To ${brandOwned()} sites", "owned", "to {brandOwned()} sites"],
    ["Other sites", "other", "{count(other)} other sites"],
  ]) {
    const name = title.includes("${") ? `{\`${title}\`}` : `"${title}"`;
    assert.ok(chain.includes(`<Term name=${name} desc={CHAIN_DEFINITIONS.${key}}> ${label} </Term>`), title);
  }
  assert.match(chain, /data-ifai-tooltip-title=\{name\} data-ifai-tooltip-desc=\{desc\} tabIndex=\{0\} aria-label=\{`\$\{name\}: \$\{desc\}`\}/);
  assert.match(chain, /const answersDesc = `\$\{engines\.length \? `Answers from \$\{listed\(engines\)\}` : "Answers"\} in this view\./);
  assert.match(chain, /style=\{\{ height: `\$\{100 \* kept\}%` \}\}/, "the band height is the share");
});

test("with a category picked, each chain step carries an asterisk whose tooltip names it", () => {
  const mark = read("components/v3/live/ai-search/CitationFilteredMark.tsx").replace(/\s+/g, " ");
  assert.match(mark, /if \(!category && !engines && !note\) return null;/, "clearing the category removes the asterisk");
  assert.match(mark, /category \? `\$\{category\} only\. Clear the category to see all categories\.` : "",/);
  // A custom engine-chip mix (decision 86) marks the same figures and names the engines.
  assert.match(mark, /engines \? `\$\{engines\} only\. Choose a preset to see every engine in it\.` : "",/);
  assert.match(mark, /const description = parts\.filter\(Boolean\)\.join\(" "\);/);
  assert.match(mark, /className="ifai-term citation-figure-filtered"/);
  assert.match(mark, /data-ifai-tooltip-desc=\{description\}/);
  assert.match(mark, /tabIndex=\{0\}/);
  assert.match(mark, /aria-label=\{`\$\{title\}: \$\{description\}`\}/);
  assert.match(mark, /> \* <\/span>/);
  assert.doesNotMatch(mark, /\stitle=/);
  const chain = read("components/v3/live/ai-search/CitationChain.tsx");
  assert.equal(
    chain.match(/<CitationFilteredMark category=\{category\} engines=\{engineFilter\} note=\{note\} \/>/g)?.length,
    1,
    "the first step names runs left out",
  );
  assert.match(chain, /const mark = <CitationFilteredMark category=\{category\} engines=\{engineFilter\} \/>;/);
  assert.equal(chain.match(/\{showedShare == null \? null : mark\}|\{mark\}|\{ownedLead\.population \? mark : null\}/g)?.length, 3, "the other three steps");
  assert.doesNotMatch(chain, /` in \$\{|\bwithin\b/, "no on-screen \"in Amps\" wording");
  assert.doesNotMatch(read("components/v3/live/ai-search/CitationHero.tsx"), /data-citation-window|\{note\}</, "the window note lives in the asterisk tooltip");
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
  assert.match(chart, /<strong>\{count\(n\)\}<\/strong> of \{count\(m\)\}/);
  assert.doesNotMatch(chart, /sliceColor/, "bars use Fender blue or slate, not a color per class");
  assert.match(chart, /\[source\.links, source\.linksTotal\] : \[source\.answers, source\.answered\]/);
  assert.match(chart, /citation-top-source-owner">\{brandOwned\(\)\}</);
  const css = read("components/v3/live/ai-search/citation-glance.css");
  assert.match(css, /\.citation-glance-grid \{[^}]*grid-template-columns: minmax\(0, [\d.]+fr\) minmax\(0, 1fr\)/s);
  const chainCss = read("components/v3/live/ai-search/citation-chain.css");
  const chainGrid = chainCss.match(/\.citation-chain \{[^}]*grid-template-columns:([^;]*);/s)?.[1] ?? "";
  assert.equal(chainGrid.match(/minmax\(0, 1fr\)/g)?.length, 4, "four steps in one row");
  const sitesCss = read("components/v3/live/ai-search/citation-top-sources.css");
  assert.match(sitesCss, /\.citation-top-source-fill \{[^}]*background: var\(--chain-answers/s);
  assert.match(sitesCss, /\.citation-top-source-fender \.citation-top-source-fill \{[^}]*background: var\(--citation-owned-fill/s);
  const narrow = css.match(/@container citation-glance \(max-width: 1060px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(narrow, /\.citation-top-source-list \{[^}]*grid-auto-flow: column;[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(chart, /gridTemplateRows: `repeat\(\$\{Math\.ceil\(ranked\.length \/ 2\)\}, auto\)`/);
  for (const path of [css, sitesCss, chainCss, read("components/v3/live/ai-search/citation-share-bars.css")]) {
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
  assert.match(chart, /\["answers", "Answers"\],\s*\["links", "Links"\]/);
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
  assert.match(chart, /citation-top-source-owner">\{brandOwned\(\)\}</);
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
    "components/v3/live/ai-search/CitationChain.tsx",
    "components/v3/live/ai-search/CitationShareBars.tsx",
    "components/v3/live/ai-search/CitationHero.tsx",
    "components/v3/live/ai-search/CitationExecutiveGrid.tsx",
    "components/v3/live/ai-search/CitationGapsCard.tsx",
    "components/v3/live/ai-search/CitationFilteredMark.tsx",
    "components/v3/live/ai-search/CitationNotAvailable.tsx",
    "components/v3/live/ai-search/CitationRoleNote.tsx",
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

/** Text a reader sees between tags, without comments, code, or attribute strings. */
function onScreenText(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(/[>}]([^<>{}]*)</g)]
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter((text) => text && !/["`]|=>|\b(const|import|export|return)\b/.test(text));
}

test("on-screen Citation copy says what each figure is, and its caveats sit in that figure's tooltip", () => {
  const dir = "components/v3/live/ai-search";
  // Required labels and error states stay on screen. "How these counts work" keeps its sentences.
  // "did not load" is the read-failure status; its database error is that phrase's tooltip.
  const kept = [/^Not available\*$/, /hidden because .+ do not match/, /^did not load$/];
  for (const name of readdirSync(join(root, dir)).filter((file) => /^Citation\w*\.tsx$/.test(file))) {
    let source = read(join(dir, name));
    if (name === "CitationEcosystemPanel.tsx") {
      const notes = source.slice(source.indexOf('<details className="citation-method-notes">'), source.indexOf("</details>"));
      assert.match(notes, /\{brandName\(\)\} does not control/);
      assert.match(notes, /does not measure whether the page\s+caused the recommendation/);
      source = source.replace(notes, "");
    }
    for (const text of onScreenText(source).filter((line) => /\bnot\b|n't\b/i.test(line))) {
      assert.ok(kept.some((rule) => rule.test(text)), `${name}: "${text}" belongs in a tooltip`);
    }
  }

  const grid = read(join(dir, "CitationExecutiveGrid.tsx"));
  assert.match(grid, /export const ROLE_ASSOCIATION_CAVEAT = "An association, not proof of cause\.";/);
  assert.equal(grid.match(/did not\. \$\{ROLE_ASSOCIATION_CAVEAT\}`/g)?.length, 2, "role bar tooltip and its spoken label");
  assert.match(grid, /const desc = `\$\{led\} [^`]*\$\{ROLE_ASSOCIATION_CAVEAT\}`;/, "each lead count's tooltip");
  assert.match(grid, /data-ifai-tooltip-desc=\{desc\}\s+tabIndex=\{0\}\s+aria-label=\{`\$\{role\.roleLabel\}: \$\{desc\}`\}/);
  assert.match(grid, /\{showSmallSample \? \(\s*<p className="citation-card-caveat" data-citation-small-sample>\s*Counts from one run\./);
  assert.match(grid, /<RankedShareBars pie=\{pie\} ownedKey="fender_owned" caveat=\{SOURCE_MIX_CAVEAT\}/);
  const bars = read(join(dir, "CitationShareBars.tsx"));
  assert.match(bars, /const desc = `\$\{slice\.label\}: [^`]*\$\{caveat\}`;/, "each source-class row's tooltip");
  assert.match(bars, /data-ifai-tooltip-desc=\{desc\}/);
  const note = read(join(dir, "CitationRoleNote.tsx"));
  assert.match(note, /export const SOURCE_MIX_CAVEAT =\s+`A useful authorized retailer citation is not a worse outcome than a \$\{brandName\(\)\} page/);

  const chart = read(join(dir, "CitationTopSources.tsx"));
  assert.match(chart, /<li\s+className="citation-chart-tip ifai-term"\s+data-ifai-tooltip-title=\{source\.domain\}\s+data-ifai-tooltip-desc=\{`\$\{counts\} \$\{TOP_SITE_ASSOCIATION\}`\}/);
  assert.match(chart, /\$\{TOP_SITE_ASSOCIATION\} Opens its cited links\.`\}/, "the row button says it too");
  assert.doesNotMatch(chart, /citation-card-caveat/);

  const panel = read(join(dir, "CitationEcosystemPanel.tsx"));
  assert.match(panel, /data-ai-citation-count>[\s\S]*?Cited sites:\{" "\}\s*<CitationNotAvailable description="This copy does not list each URL, so these rows are not read as a change in the citation ecosystem\." \/>/);
  assert.match(panel, /data-ai-citation-caution>\s*Cited sites for this run: <CitationNotAvailable description=\{caution\} \/>/);
  const mark = read(join(dir, "CitationNotAvailable.tsx"));
  assert.match(mark, /className="ifai-term"/);
  assert.match(mark, /data-ifai-tooltip-desc=\{description\}/);
  assert.match(mark, /tabIndex=\{0\}/);
  assert.match(mark, />\s*Not available\*\s*</);
  assert.match(read(join(dir, "CitationChain.tsx")), />\s*Not available\*\s*</, "required label stays visible");
});
