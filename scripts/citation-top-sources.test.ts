// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/citation-top-sources.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { citationEvidence } from "../lib/ai-search/citations.ts";
import {
  categoryForScope,
  citationCategoryLabel,
  citationCategoryOptions,
  snapshotInCategory,
  topCitedSources,
  TOP_SOURCES_FIRST,
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

test("the list stops at ten sites and opens on five", () => {
  assert.equal(TOP_SOURCES_FIRST, 5);
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

test("Citation Ecosystem opens with the lead figure, then top sources, then the existing cards and tables", () => {
  const panel = read("components/v3/live/ai-search/CitationEcosystemPanel.tsx");
  const lead = panel.indexOf("<CitationLeadFigure");
  const hero = panel.indexOf("<CitationHero");
  const top = panel.indexOf("<CitationTopSources");
  const engines = panel.indexOf('tableId="citation-engines"');
  const evidence = panel.indexOf("<CitationEvidenceTable");
  assert.ok(lead >= 0 && lead < hero && hero < top && top < engines && engines < evidence);
  const heroFile = read("components/v3/live/ai-search/CitationHero.tsx");
  const scopes = heroFile.indexOf('part="scopes"');
  const intro = heroFile.indexOf("{intro}");
  assert.ok(scopes < intro && intro < heroFile.indexOf("<CitationExecutiveGrid"), "top sources sit above the cards");
  assert.match(panel, /owned=\{leadOwned\}\s+total=\{full\.rows\.length\}/, "the lead figure ignores the category");
  assert.ok(panel.split("\n").length - 1 <= 400);
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
  ];
  assert.match(read(files[0]), /<AiTerm term="top cited sites">/);
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
