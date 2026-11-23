// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/briefing-narrative.test.ts
// Worker 31.1: Summary › Briefing "What this means for {brand}" (docs/briefing-narrative-spec.md,
// decisions 128 and 129, FDD H-09). One test per sentence-table row, the missing-data row of every
// block, the three-gap selection order, and a snapshot of the Fender and Ledlenser outputs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  answerBlock,
  blockText,
  briefingNarrative,
  firstMoveBlock,
  gapSentence,
  narrativeGaps,
  relyBlock,
  selectGaps,
  sellingModelLine,
  sentenceText,
  worthBlock,
  type GapReading,
  type NarrativeInput,
} from "../lib/fender-canvas/briefing-narrative.ts";
import type { BriefingFinding } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { amazonSpecGapsFinding, selectRetailHeadline, type PortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";
import { specHero } from "../lib/fender-canvas/retail-overview-lead.ts";
import { signalActions } from "../lib/fender-canvas/roadmap-signals.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const base = { brand: "Acme", site: "acme.com" };
const answer = (u: [number, number] | null, b: [number, number] | null = null) =>
  blockText(
    answerBlock({
      brand: "Acme",
      unbranded: u ? { wins: u[0], resolved: u[1] } : null,
      branded: b ? { wins: b[0], resolved: b[1] } : null,
    }),
  );
const gap = (id: GapReading["id"], affected: number, population: number, tone: GapReading["tone"] = "danger"): GapReading => ({
  id,
  affected,
  population,
  tone,
});

// Block 1: the answer shoppers get.

test("Block 1: unbranded above 65 reads usually the answer", () => {
  assert.equal(answer([70, 100]), "When a shopper asks an AI assistant what to buy, Acme is usually the answer: 7 times in 10.");
});

test("Block 1: unbranded 30 to 65 names the other times", () => {
  assert.equal(answer([30, 100]), "When a shopper asks an AI assistant what to buy, Acme is the answer 3 times in 10. The other 7 times, a rival is named first.");
  assert.match(answer([65, 100]), /is the answer 7 times in 10\. The other 3 times/);
});

test("Block 1: unbranded below 30 reads rarely the answer", () => {
  assert.equal(answer([29, 100]), "When a shopper asks an AI assistant what to buy, Acme is rarely the answer: 3 times in 10. A rival is named first the rest of the time.");
});

test("Block 1: no resolved answers is the missing-data row", () => {
  for (const block of [answerBlock({ brand: "Acme", unbranded: null, branded: null }), answerBlock({ brand: "Acme", unbranded: { wins: 0, resolved: 0 }, branded: { wins: 5, resolved: 10 } })]) {
    assert.equal(blockText(block), "No AI answers in this window yet.");
    assert.equal(block.notAvailable, true);
  }
});

test("Block 1: branded above 90 and unbranded not above 65 is a finding gap", () => {
  assert.match(answer([50, 100], [95, 100]), /Shoppers who already ask about Acme get confirmed 95\.0% of the time\. The gap is being found, not being trusted\.$/);
});

test("Block 1: branded below 70 and unbranded above 65 is a trust gap", () => {
  assert.match(answer([80, 100], [60, 100]), /Acme is found, but shoppers who ask about it directly get confirmed only 60\.0% of the time\. The gap is trust, not discovery\.$/);
});

test("Block 1: both low", () => {
  assert.match(answer([20, 100], [50, 100]), /Shoppers who ask about Acme directly get confirmed 50\.0% of the time, and unbranded shoppers hear a rival first\. Both need work\.$/);
});

test("Block 1: both high", () => {
  assert.match(answer([80, 100], [95, 100]), /Shoppers who ask about Acme directly get confirmed 95\.0% of the time\. Discovery and trust are both in good shape\.$/);
});

test("Block 1: no branded answers leaves the second sentence out", () => {
  assert.equal(answer([80, 100], [0, 0]), "When a shopper asks an AI assistant what to buy, Acme is usually the answer: 8 times in 10.");
});

test("Block 1: the plain phrases open the Unbranded Discovery and Branded Consideration tooltips", () => {
  const block = answerBlock({ brand: "Acme", unbranded: { wins: 50, resolved: 100 }, branded: { wins: 95, resolved: 100 } });
  const terms = [block.lead, ...block.body].flat().filter((part) => typeof part !== "string");
  assert.deepEqual(terms, [
    { text: "what to buy", term: "unbranded" },
    { text: "ask about Acme", term: "branded" },
  ]);
});

// Block 2: what assistants rely on.

const rely = (input: Partial<NarrativeInput>) => blockText(relyBlock({ ...base, cited: null, gaps: [], ...input }));

test("Block 2: the lead is fixed and the owned share reads 1 page in K", () => {
  assert.equal(
    rely({ cited: { owned: 6404, total: 36289 } }),
    "Assistants decide by reading product pages, retailer listings and reviews. For Acme, 1 page in 6 they read is Acme's own.",
  );
});

test("Block 2: below 10% owned reads almost none", () => {
  assert.match(rely({ cited: { owned: 9, total: 100 } }), /Almost none of the pages they read \(9\.0%\) are Acme's own\.$/);
});

test("Block 2: no cited links and no gap readings leave only the lead", () => {
  assert.equal(rely({ cited: { owned: 0, total: 0 } }), "Assistants decide by reading product pages, retailer listings and reviews.");
});

test("Block 2: each gap reads in plain words and ends with why it changes what assistants recommend", () => {
  const say = (g: GapReading) => sentenceText(gapSentence(g, "Acme", "acme.com"));
  assert.equal(say(gap("exact_pages", 999, 1091)), "9 in 10 Amazon listings have no matching page on acme.com, so assistants describe those products from retailer and rival pages instead of Acme's.");
  assert.equal(say(gap("missing_specs", 1524, 3080)), "1,524 listings are missing the specs assistants compare, so assistants cannot match them to shoppers' questions.");
  assert.equal(say(gap("buy_box", 60, 1173)), "60 listings are not showing Acme's price at the moment of purchase, so the page assistants cite sends shoppers elsewhere.");
  assert.equal(say(gap("splintered", 38, 330)), "38 bundles split their reviews across separate listings, so assistants see fewer reviews behind each one and recommend it less.");
  assert.equal(say(gap("map_leakage", 187, 633)), "187 offers are advertised below the agreed floor price, so assistants can repeat a price below the one Acme sets.");
});

test("Block 2: a gap of one reads singular", () => {
  const say = (g: GapReading) => sentenceText(gapSentence(g, "Acme", "acme.com"));
  assert.equal(say(gap("missing_specs", 1, 10)), "1 listing is missing the specs assistants compare, so assistants cannot match it to shoppers' questions.");
  assert.equal(say(gap("buy_box", 1, 10)), "1 listing is not showing Acme's price at the moment of purchase, so the page assistants cite sends shoppers elsewhere.");
  assert.equal(say(gap("splintered", 1, 10)), "1 bundle splits its reviews across separate listings, so assistants see fewer reviews behind it and recommend it less.");
  assert.equal(say(gap("map_leakage", 1, 10)), "1 offer is advertised below the agreed floor price, so assistants can repeat a price below the one Acme sets.");
});

test("Block 2: no gap Poor or Fair reads good shape", () => {
  assert.match(rely({ gaps: [gap("buy_box", 0, 100, "success"), gap("missing_specs", 1, 100, "success")] }), /Acme's listings on those pages are in good shape\.$/);
});

test("Block 2: three-gap selection: Poor before Fair, then the larger share, then the findings' order", () => {
  const picked = selectGaps([
    gap("missing_specs", 4, 100, "warning"),
    gap("buy_box", 5, 100),
    gap("map_leakage", 30, 100),
    gap("splintered", 5, 100),
    gap("exact_pages", 90, 100),
  ]);
  assert.deepEqual(picked.map((g) => g.id), ["exact_pages", "map_leakage", "buy_box"]);
  const fair = selectGaps([gap("missing_specs", 50, 100, "warning"), gap("splintered", 1, 100), gap("buy_box", 0, 100, "success")]);
  assert.deepEqual(fair.map((g) => g.id), ["splintered", "missing_specs"]);
  assert.equal(selectGaps([gap("exact_pages", 1, 2), gap("map_leakage", 1, 2), gap("buy_box", 1, 2), gap("splintered", 1, 2)]).map((g) => g.id).join(), "buy_box,map_leakage,splintered");
});

test("Block 2: gaps come from the hero-row findings; exact pages counts the listings without one", () => {
  const finding = (id: BriefingFinding["id"], numerator: number | null, denominator: number | null, tone: BriefingFinding["tone"] = "danger", loading = false) =>
    ({ id, numerator, denominator, tone, loading }) as BriefingFinding;
  const gaps = narrativeGaps(
    [
      finding("buy_box", 60, 1173),
      finding("map_leakage", null, null, "warning"),
      finding("splintered_bundles", 38, 330, "danger", true),
      finding("exact_official_product", 92, 1091),
      finding("unbranded_discovery", 2998, 4978),
    ],
    null,
  );
  assert.deepEqual(gaps, [gap("buy_box", 60, 1173), gap("exact_pages", 999, 1091)]);
});

test("Ruling 2: missing specs is the count Action Items shows (listings missing at least one field)", () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => ({ asin: `B00000000${i}`, title: null, amazon_checked: true, amazon_missing_fields: i < 4 ? "color; weight" : null })),
    { asin: "B000000009", title: null, amazon_checked: false, amazon_missing_fields: "color" },
  ];
  const unavailable = { status: "unavailable" as const, issueCount: null, missingMessage: "x", detail: null };
  const findings = { suppressedListings: unavailable, mapLeakage: unavailable, unnestedBundles: unavailable, amazonSpecGaps: amazonSpecGapsFinding(rows) };
  const snapshot = { ...findings, headline: selectRetailHeadline(findings) } as PortfolioRetailSnapshot;
  const [spec] = narrativeGaps([], specHero(snapshot));
  const action = signalActions({ retail: { phase: "ready", snapshot }, ai: { phase: "loading" }, stock: { phase: "loading" } }).find(
    (signal) => signal.id === "signal:missing_specs",
  );
  assert.equal(spec.affected, 4);
  assert.equal(spec.affected, action?.numerator);
  assert.equal(spec.population, action?.denominator);
  assert.equal(spec.tone, "danger");
});

// Block 3: what it is worth.

test("Block 3: a prepared estimate reads the monthly figure and its range, labeled analyst estimate", () => {
  const block = worthBlock({ low: 55_700, mid: 102_000, high: 158_000 });
  assert.equal(blockText(block), "Fixing those listings is worth about $102K a month, an analyst estimate (range $55.7K to $158K) from the Amazon sales those listings already make.");
  assert.deepEqual(block.lead[1], { text: "$102K", figure: "monthly" });
});

test("Block 3: no estimate is the missing-data row", () => {
  const block = worthBlock(null);
  assert.equal(blockText(block), "A dollar estimate is not available yet.");
  assert.equal(block.notAvailable, true);
});

// Block 4 and the selling-model line.

test("Block 4: the first move is the top Priorities item; an empty queue says so", () => {
  assert.equal(blockText(firstMoveBlock("Publish one acme.com page per exact product.")), "The first move: Publish one acme.com page per exact product.");
  assert.equal(blockText(firstMoveBlock(null)), "No open action; the queue is clear.");
  assert.equal(firstMoveBlock("  ").lead.length, 0);
});

test("the selling-model line names no seller", () => {
  assert.deepEqual(sellingModelLine("Partner-led", "Acme"), { label: "Partner-led:", text: "authorized sellers are meant to hold the Buy Box." });
  assert.deepEqual(sellingModelLine("Brand-led", "Acme"), { label: "Brand-led:", text: "Acme's own seller accounts are meant to hold the Buy Box." });
});

// Snapshots: wording changes must be deliberate.

const FENDER: NarrativeInput = {
  brand: "Fender",
  site: "fender.com",
  unbranded: { wins: 2998, resolved: 4978 },
  branded: { wins: 3012, resolved: 3211 },
  cited: { owned: 6404, total: 36289 },
  gaps: [gap("buy_box", 60, 1173), gap("map_leakage", 187, 633), gap("splintered", 38, 330), gap("exact_pages", 999, 1091), gap("missing_specs", 524, 1080)],
};

const LEDLENSER: NarrativeInput = {
  brand: "Ledlenser",
  site: "ledlenserusa.com",
  unbranded: { wins: 120, resolved: 800 },
  branded: { wins: 410, resolved: 650 },
  cited: { owned: 90, total: 2400 },
  gaps: [gap("buy_box", 0, 210, "success"), gap("splintered", 5, 40), gap("exact_pages", 190, 220), gap("missing_specs", 12, 200, "warning")],
};

test("snapshot: Fender", () => {
  const text = briefingNarrative(FENDER, { low: 55_700, mid: 102_000, high: 158_000 }, "Publish one fender.com page per exact product").map(blockText);
  assert.deepEqual(text, [
    "When a shopper asks an AI assistant what to buy, Fender is the answer 6 times in 10. The other 4 times, a rival is named first. Shoppers who already ask about Fender get confirmed 93.8% of the time. The gap is being found, not being trusted.",
    "Assistants decide by reading product pages, retailer listings and reviews. For Fender, 1 page in 6 they read is Fender's own. 9 in 10 Amazon listings have no matching page on fender.com, so assistants describe those products from retailer and rival pages instead of Fender's. 524 listings are missing the specs assistants compare, so assistants cannot match them to shoppers' questions. 187 offers are advertised below the agreed floor price, so assistants can repeat a price below the one Fender sets.",
    "Fixing those listings is worth about $102K a month, an analyst estimate (range $55.7K to $158K) from the Amazon sales those listings already make.",
    "The first move: Publish one fender.com page per exact product.",
  ]);
});

test("snapshot: Ledlenser", () => {
  const text = briefingNarrative(LEDLENSER, null, null).map(blockText);
  assert.deepEqual(text, [
    "When a shopper asks an AI assistant what to buy, Ledlenser is rarely the answer: 2 times in 10. A rival is named first the rest of the time. Shoppers who ask about Ledlenser directly get confirmed 63.1% of the time, and unbranded shoppers hear a rival first. Both need work.",
    "Assistants decide by reading product pages, retailer listings and reviews. Almost none of the pages they read (3.8%) are Ledlenser's own. 9 in 10 Amazon listings have no matching page on ledlenserusa.com, so assistants describe those products from retailer and rival pages instead of Ledlenser's. 5 bundles split their reviews across separate listings, so assistants see fewer reviews behind each one and recommend it less. 12 listings are missing the specs assistants compare, so assistants cannot match them to shoppers' questions.",
    "A dollar estimate is not available yet.",
    "No open action; the queue is clear.",
  ]);
});

test("no client name, contraction, emoji or em dash in the narrative code (X-35, brand voice)", () => {
  const lib = read("lib/fender-canvas/briefing-narrative.ts");
  const component = read("components/v3/live/BriefingAiLead.tsx");
  // The module path "lib/fender-canvas" is a folder name, not a client branch.
  assert.doesNotMatch(lib.replace(/@\/lib\/fender-canvas\//g, ""), /fender|ledlenser|squier|fmic/i);
  assert.doesNotMatch(component, /"fender"|"ledlenser"|isFender|isLedlenser/i);
  for (const source of [lib, component]) {
    assert.doesNotMatch(source, /—/);
    assert.doesNotMatch(source, /\b(?:isn|aren|don|doesn|can|won|it)'(?:t|s)\b/i);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u);
  }
  assert.doesNotMatch(component, /activeOffersLine|Active offers|authorizedPartnersFromSave/);
  assert.match(component, /What this means for \{brand\}/);
  assert.match(component, /commandItems\[0\]/);
  assert.match(component, /data-ifai-open="suggestions"/);
});
