// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/one-count.test.ts
//
// One count per item, for every client (Brian Magazu, 23 Nov 2026 fix round 2). A synthetic client
// with every item kind the plan can produce: each ranked item carries one structured count, and
// every surface (Priorities, the rank reason, deck slide 9, Action Items, the CSV) shows the same N.
// The kinds come from GAP_KINDS in the code, so a new kind fails here until it carries the count.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deckFixes } from "../lib/deck/deck-model.ts";
import type { DeckInput } from "../lib/deck/deck-types.ts";
import type { ClientEstimates } from "../lib/estimates/live-inputs.ts";
import { aplusPlanItem } from "../lib/fender-canvas/action-items-aplus-row.ts";
import { planWithBuyBoxCauses } from "../lib/fender-canvas/action-items-buybox-rows.ts";
import { bulletsPlanItem } from "../lib/fender-canvas/action-items-bullets-row.ts";
import type { BriefingFinding, BriefingFindingId } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { buildLiveCommandCenter, firstMoveLine, PRIORITIES_DESC, priorityFromPlan, priorityItems } from "../lib/fender-canvas/command-center-from-live.ts";
import { FIX_LIST_PRIORITY_RULE } from "../lib/fender-canvas/action-items-fix-list.ts";
import { GAP_KINDS, gapKindOf } from "../lib/fender-canvas/priority-list.ts";
import { countFigure, countRatio, rankSeverity, SEVERITY_FLOOR, SEVERITY_ORDER, severityOf, type Severity } from "../lib/fender-canvas/priority-rank.ts";
import type { ActuationAction } from "../lib/fender-canvas/roadmap-actuation.ts";
import type { FocusAction } from "../lib/fender-canvas/roadmap-focus.ts";
import { FACTOR_COVERED_BY, ownPagesAction, urgentOwnPagesAction, type OwnPageAction, type OwnPageFactor } from "../lib/fender-canvas/roadmap-own-pages.ts";
import { brandSite } from "../lib/brand-copy.ts";
import { fixListCells } from "../lib/fender-canvas/roadmap-plan-read.ts";
import { buildPlan, firstMove, inPriorities, planFigure, rankPlan, type PlanInput, type PlanItem } from "../lib/fender-canvas/roadmap-plan.ts";
import type { SignalAction } from "../lib/fender-canvas/roadmap-signals.ts";
import type { SourceAction } from "../lib/fender-canvas/roadmap-sources.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

// ---------- a synthetic client ----------

function finding(id: BriefingFindingId, tone: BriefingFinding["tone"], numerator: number, denominator: number): BriefingFinding {
  return {
    id,
    spokeId: id === "exact_official_product" ? "specs" : id === "unbranded_discovery" ? "aeo" : "ecommerce",
    tab: "Tab",
    label: `Label ${id}`,
    percent: `${((100 * numerator) / denominator).toFixed(1)}%`,
    ratio: `${numerator} of ${denominator}`,
    color: "var(--danger-red)",
    tone,
    pie: null,
    tip: null,
    explainer: "",
    numerator,
    denominator,
    partial: null,
    loading: false,
  };
}

const PARTIAL = { reason: "coverage", missing: "Some listings were not read.", coverage: "80 of 100", source: "Synthetic read" } as const;

function signal(id: string, group: SignalAction["group"], numerator: number, denominator: number, partial = false): SignalAction {
  return {
    id,
    group,
    label: `Label ${id}`,
    share: numerator / denominator,
    numerator,
    denominator,
    fact: "f",
    action: `Act on ${id}.`,
    open: { spokeId: "aeo", tab: "Tab" },
    partial: partial ? PARTIAL : null,
  };
}

function focus(id: string, kind: FocusAction["focus"], tier: FocusAction["tier"], numerator: number, denominator: number, gap: number): FocusAction {
  return {
    id,
    focus: kind,
    tier,
    label: `Label ${id}`,
    numerator,
    denominator,
    fact: "f",
    action: `Act on ${id}.`,
    open: { spokeId: "aeo", tab: "Run Details" },
    evidence: null,
    categories: [],
    siteType: null,
    pages: [],
    trend: null,
    gap,
    partial: null,
  };
}

function factor(id: OwnPageFactor["id"], tone: OwnPageFactor["tone"], affected: number, base: number): OwnPageFactor {
  return {
    id,
    label: `Factor ${id}`,
    percent: "50.0%",
    ratio: `${base - affected} of ${base}`,
    tone,
    open: { spokeId: "specs", tab: "Tab" },
    affected,
    base,
    short: `Short on ${id}`,
    task: `Work on ${id}`,
    effort: "M",
  };
}

function actuation(id: string, rule: ActuationAction["rule"], counts?: { count: number; target: number }): ActuationAction {
  return { id, factor: "P1", rule, phase: "days_31_60", label: `Label ${id}`, percent: "0.0%", ratio: null, fact: "f", action: `Act on ${id}.`, targets: null, ...(counts ? { counts } : {}) };
}

const SOURCE: SourceAction = {
  domain: "reviews.example",
  type: "publication",
  answers: 140,
  answersWithSources: 700,
  share: 0.2,
  runsOver: 3,
  runsRead: 3,
  categories: [],
  categoryKeys: [],
  pages: [],
  fact: "f",
  action: "Reach out to reviews.example.",
};

/** Line 7 (A+) on two listings, one priced: enough for the A+ row. */
const EST = {
  lines: [{ lineId: "aplus", countsInTotal: true }],
  byListing: new Map([
    ["X1", { asin: "X1", lines: { aplus: { low: 1200, mid: 2400, high: 3600 } } }],
    ["X2", { asin: "X2", lines: { aplus: null } }],
    ["X3", { asin: "X3", lines: {} }],
  ]),
} as unknown as ClientEstimates;

function syntheticInput(ownPages: OwnPageAction | null): PlanInput {
  return {
    findings: [
      finding("buy_box", "danger", 40, 900),
      finding("map_leakage", "warning", 120, 500),
      finding("splintered_bundles", "warning", 30, 200),
      finding("exact_official_product", "danger", 90, 880),
      finding("unbranded_discovery", "warning", 300, 1000),
    ],
    signals: [
      signal("signal:out_of_stock", "ecommerce", 70, 900),
      signal("signal:missing_specs", "ecommerce", 200, 200, true),
      signal("signal:fact_contradictions", "answers", 5, 400),
      signal("signal:rival:category-a", "answers", 260, 1000),
    ],
    sources: [SOURCE],
    ownPages,
    focus: [
      focus("focus:engine:engine-b", "engine", "priority", 100, 400, 25),
      focus("focus:question:q-one", "question", "priority", 10, 120, 30),
      { ...focus("focus:questions:watch", "question", "watch", 50, 200, 8), members: [
        { id: "focus:question:q-two", label: '"q two"', numerator: 30, denominator: 100, gap: 8 },
        { id: "focus:question:q-three", label: '"q three"', numerator: 20, denominator: 100, gap: 6 },
      ] },
      focus("focus:site:forum.example", "site", "priority", 90, 700, 40),
    ],
    actuation: [
      actuation("actuation:P1:confirm", "confirm"),
      actuation("actuation:E2:activity", "activity", { count: 3, target: 10 }),
      actuation("actuation:P2:renew", "renew"),
    ],
    reach: { answers: 2000, listings: 1000 },
    extra: [bulletsPlanItem({ listings: 800, fullBullets: 500, short: 300, pct: 62.5 })!, aplusPlanItem(EST)!],
  };
}

const OWN_FACTORS = [
  factor("page_found", "danger", 300, 880),
  factor("completeness", "warning", 120, 580),
  factor("machine_specs", "warning", 400, 580),
  factor("amazon_completeness", "warning", 50, 880),
  factor("aplus", "warning", 500, 800),
];

const SPLIT = { withheld: 40, price: 25, other: 15, priceAsins: new Set<string>(), otherAsins: new Set<string>() };

/** Every item the synthetic client produces: one plan with the urgent own-pages row, one with the wording row. */
function everyItem(): PlanItem[] {
  const urgent = planWithBuyBoxCauses(buildPlan(syntheticInput(urgentOwnPagesAction(OWN_FACTORS))), SPLIT);
  const wording: OwnPageAction = {
    id: "own:wording",
    urgent: false,
    phase: "days_61_90",
    label: "Brand site in shopping answers",
    percent: "10.0%",
    ratio: "70 of 700",
    tone: null,
    fact: "f",
    action: "Word the pages.",
    open: { spokeId: "aeo", tab: "Citation Ecosystem" },
    share: 0.1,
    cited: { answers: 70, total: 700 },
  };
  const later = buildPlan(syntheticInput(wording)).filter((item) => item.id === "own:wording");
  return [...urgent, ...later];
}

/** N in "1,018 of 1,109" or "Touches 1,018 of 1,198 ...". */
function firstN(text: string): string | null {
  return /([\d,]+) of [\d,]+/.exec(text)?.[1] ?? null;
}

function reasonN(reason: string): string | null {
  return /Touches ([\d,]+) of /.exec(reason)?.[1] ?? null;
}

// ---------- the tests ----------

test("every item kind the plan produces is registered, and the synthetic client produces every registered kind", () => {
  const kinds = new Set(everyItem().map((item) => gapKindOf(item.id)));
  for (const kind of kinds) assert.ok(kind in GAP_KINDS, `${kind} is produced but not in GAP_KINDS: give it the one count and register it`);
  assert.deepEqual([...kinds].sort(), Object.keys(GAP_KINDS).sort(), "the synthetic client covers every registered kind");
});

test("one count per item: the figure's N equals the rank reason's N on every surface, for every kind", () => {
  const items = everyItem();
  for (const item of items) {
    const kind = gapKindOf(item.id);
    if (GAP_KINDS[kind] === "uncounted") {
      assert.equal(item.count, null, item.id);
      assert.doesNotMatch(item.reason, /Touches/, item.id);
      continue;
    }
    const count = item.count;
    assert.ok(count, `${item.id} (${kind}) carries the one count`);
    const n = reasonN(item.reason);
    assert.ok(n, `${item.id}: the reason names N`);
    // Priorities' figure line, Action Items and the Roadmap, the CSV, and the item's own fields.
    const card = priorityFromPlan(item);
    assert.ok(card.impact!.startsWith(countFigure(count)), `${item.id}: Priorities renders the one count`);
    assert.equal(firstN(card.impact!), n, `${item.id}: Priorities figure N = reason N`);
    assert.equal(card.why, item.reason);
    assert.equal(firstN(planFigure(item).ratio ?? ""), n, `${item.id}: Action Items figure N = reason N`);
    assert.equal(firstN(fixListCells(item, new Date(2026, 10, 23))[2]!), n, `${item.id}: CSV figure N = reason N`);
    assert.equal(firstN(countRatio(count)), n, item.id);
    assert.ok(count.base > 0 && count.affected <= count.base, `${item.id}: N of its own base M`);
    if (count.common != null) assert.ok(count.common >= count.base, `${item.id}: the common base holds the own base`);
  }
});

test("deck slide 9 shows each item's one count, the N its reason names", () => {
  const plan = buildPlan(syntheticInput(urgentOwnPagesAction(OWN_FACTORS)));
  const fixes = deckFixes({ brandSite: "site.example", plan } as unknown as DeckInput);
  const listed = plan.filter((item) => inPriorities(item) && !item.noReading).slice(0, 5);
  assert.equal(fixes.length, 5);
  fixes.forEach((fix, index) => {
    const item = listed[index]!;
    assert.equal(fix.rank, item.rank);
    assert.equal(firstN(fix.ratio), reasonN(item.reason), item.id);
    assert.equal(fix.figureLabel, item.count?.label ?? null);
  });
});

test("the figure states the problem count; a partial own base keeps its asterisk", () => {
  const items = everyItem();
  const byId = new Map(items.map((item) => [item.id, item]));
  const exact = byId.get("finding:exact_official_product")!;
  assert.equal(exact.count!.label, "Listings without an exact official product page");
  assert.deepEqual([exact.count!.affected, exact.count!.base, exact.count!.common], [790, 880, 1000]);
  assert.equal(countFigure(exact.count!), "Listings without an exact official product page: 790 of 880");
  assert.match(exact.reason, /Touches 790 of 1,000 monitored listings \(79\.0%\)/);
  const specs = byId.get("signal:missing_specs")!;
  assert.equal(countRatio(specs.count!), "200 of 200*");
  assert.match(priorityFromPlan(specs).impact!, /: 200 of 200\*/);
  const engine = byId.get("focus:engine:engine-b")!;
  assert.equal(engine.count!.label, "Answers behind the best engine on Label focus:engine:engine-b");
  assert.equal(engine.count!.affected, 100, "25 points behind on 400 answers");
  const group = byId.get("focus:questions:watch")!;
  assert.deepEqual(group.members!.map((member) => member.ratio), ["8 of 100", "6 of 100"]);
  assert.equal(group.count!.affected, 14, "the members' counts add up to the item's");
  const activity = byId.get("actuation:E2:activity")!;
  assert.equal(countFigure(activity.count!), "Verified links short of the target: 7 of 10");
  for (const id of ["finding:buy_box:price", "finding:buy_box:other"]) {
    const row = byId.get(id)!;
    assert.equal(firstN(planFigure(row).ratio!), reasonN(row.reason), id);
  }
});

test("severity: one order for every word the dashboard uses; Critical first, then At risk, then the rest", () => {
  const words: Array<[string | null, Severity]> = [
    ["danger", "critical"], ["critical", "critical"], ["Critical", "critical"], ["bad", "critical"],
    ["warning", "at_risk"], ["at_risk", "at_risk"], ["At risk", "at_risk"], ["high", "at_risk"], ["okay", "at_risk"],
    ["moderate", "moderate"], ["Recommended", "moderate"], ["no_reading", "moderate"], ["No reading", "moderate"], [null, "moderate"],
    ["success", "low"], ["on_track", "low"], ["On track", "low"], ["Watch", "low"],
  ];
  for (const [word, severity] of words) assert.equal(severityOf(word), severity, String(word));
  assert.ok(SEVERITY_ORDER.critical < SEVERITY_ORDER.at_risk && SEVERITY_ORDER.at_risk < SEVERITY_ORDER.moderate && SEVERITY_ORDER.moderate < SEVERITY_ORDER.low);
  const plan = buildPlan(syntheticInput(urgentOwnPagesAction(OWN_FACTORS)));
  const listed = plan.filter(inPriorities);
  const levels = listed.map((item) => SEVERITY_ORDER[rankSeverity(item.inputs)]);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), "no item outranks one more severe at or over the floor");
  const rank = (id: string) => plan.find((item) => item.id === id)!.rank;
  assert.ok(rank("finding:map_leakage") < rank("signal:rival:category-a"), "At risk on 12% leads the ungraded items");
  // Fix round 3: the Buy Box (Critical, 4% of listings) is under the 5% floor, so it ranks with
  // the rest by reach: the bullets row on 30% now comes first. It keeps its Critical tag.
  assert.ok(rank("signal:amazon_bullets") < rank("finding:buy_box"));
  assert.ok(rank("finding:splintered_bundles") > rank("signal:out_of_stock"), "At risk on 3% follows out of stock on 7%");
  assert.equal(plan.find((item) => item.id === "finding:buy_box")!.inputs.severity, "critical");
  // Within a level: reach, then dollars, then effort.
  assert.ok(rank("finding:exact_official_product") < rank("finding:map_leakage"), "Critical 79% before At risk 12%");
  // The leading tier holds only items at or over the floor, and they come first.
  const leading = listed.filter((item) => rankSeverity(item.inputs) !== "moderate" && rankSeverity(item.inputs) !== "low");
  assert.deepEqual(leading.map((item) => item.id), listed.slice(0, leading.length).map((item) => item.id));
  for (const item of leading) assert.ok(item.share! >= SEVERITY_FLOOR, item.id);
  // Priorities shows each item's own severity word.
  const cards = priorityItems(plan);
  assert.equal(cards[0]!.severity, "critical");
  assert.equal(cards.find((card) => card.id === "buybox-suppression")!.severity, "critical");
});

test("no duplicate fixes: the own-pages item skips factors another ranked item fixes", () => {
  const plan = buildPlan(syntheticInput(urgentOwnPagesAction(OWN_FACTORS)));
  const own = plan.find((item) => item.id === "own:pages")!;
  // Page found (exact pages), Amazon completeness (missing specs) and A+ (the A+ row) are covered;
  // completeness remains (machine specs folds into it: one gap, one figure), so it leads. Its title is
  // that factor's short task, and its effort is that factor's (fix round 3).
  assert.equal(own.action, "Work on completeness.");
  assert.equal(own.title, "Work on completeness");
  assert.equal(own.inputs.effort, "M");
  assert.match(own.reason, /Medium effort, catalog and site content\.$/);
  assert.doesNotMatch(own.fact, /page_found|amazon_completeness|Factor aplus/);
  assert.equal(own.count!.label, "Short on completeness");
  assert.equal(own.count!.affected, 120);
  // A factor returns when the item covering it leaves the list.
  const withoutExact = rankPlan(plan.filter((item) => item.id !== "finding:exact_official_product"));
  assert.equal(withoutExact.find((item) => item.id === "own:pages")!.action, "Work on page_found.");
  // With every factor covered, the item drops.
  const covered = OWN_FACTORS.filter((item) => FACTOR_COVERED_BY[item.id] != null);
  const only = buildPlan(syntheticInput(urgentOwnPagesAction(covered)));
  assert.equal(only.some((item) => item.id === "own:pages"), false);
  // No two Priorities cards publish brand-site pages.
  assert.equal(priorityItems(plan).filter((card) => /page found|exact product/i.test(`${card.title} ${card.impact}`)).length, 1);
});

test("the opening summary and the first move are central #1", () => {
  const plan = buildPlan(syntheticInput(urgentOwnPagesAction(OWN_FACTORS)));
  const first = firstMove(plan)!;
  const cc = buildLiveCommandCenter({} as CanvasBundle, { phase: "loading" }, { phase: "loading" }, plan);
  assert.equal(cc.items[0]!.title, first.title, "commandItems[0], which the Briefing's first move reads, is central #1");
  assert.equal(priorityItems(plan)[0]!.title, first.title);
  assert.ok(cc.summary!.startsWith(firstMoveLine(plan)!));
  assert.equal(firstMoveLine(plan), `First move: ${first.title}. ${countFigure(first.count!)}.`);
});

test("let the data speak: no reason heading, no severity opener, no effort letter in any rendered text (fix round 3)", () => {
  const items = everyItem();
  const plan = buildPlan(syntheticInput(urgentOwnPagesAction(OWN_FACTORS)));
  const cc = buildLiveCommandCenter({} as CanvasBundle, { phase: "loading" }, { phase: "loading" }, plan);
  const deck = deckFixes({ brandSite: "site.example", plan } as unknown as DeckInput);
  const texts: string[] = [
    PRIORITIES_DESC,
    FIX_LIST_PRIORITY_RULE,
    cc.summary ?? "",
    ...cc.items.flatMap((card) => [card.title, card.why, card.impact ?? ""]),
    ...items.flatMap((item) => {
      const card = priorityFromPlan(item);
      return [item.reason, item.title, item.action, item.fact, card.why, card.impact ?? "", ...fixListCells(item, new Date(2026, 10, 23))];
    }),
    ...deck.flatMap((fix) => [fix.action, fix.ratio, fix.figureLabel ?? "", fix.statusWord]),
  ];
  for (const text of texts) {
    assert.doesNotMatch(text, /\bEffort [SML]\b/, text);
    assert.doesNotMatch(text, /so it (leads|follows)|why it is at the top|no common base, so/i, text);
  }
  // Each reason is its data line only: an optional reach sentence, optional dollars, then effort in words.
  for (const item of items) {
    assert.match(item.reason, /^(Touches [\d,]+ of [\d,]+ [a-zA-Z ]+ \([\d.]+%\)\. )?(\$[\d.,]+[KM]? a month, analyst estimate\. )?(Small|Medium|Large) effort, [a-z ]+\.$/, item.id);
  }
  // The Priorities card has no reason heading.
  assert.doesNotMatch(readFileSync(new URL("../lib/canvas-sdk/CommandCenter.tsx", import.meta.url), "utf8"), /Why it is at the top/i);
});

test("the brand-site spec item counts listings from the page read: one unit, one count, one item (worker 32.18)", () => {
  // A synthetic client's page read: 40 pages serve 120 listings with a found page; 36 pages (108
  // listings) have no spec block, and one listing's own read also misses the description.
  const pages = Array.from({ length: 40 }, (_, i) => ({
    url: `https://site.example/products/p${i}`,
    model: `P${i}`,
    asins: [0, 1, 2].map((k) => `B${i}-${k}`),
    missingFields: i < 36 ? ["additionalProperty"] : [],
    hasSpecBlock: i >= 36,
    basicsPresent: 7,
    missingBasics: [],
    checkedAt: null,
  }));
  const foundListings = pages.flatMap((page, i) =>
    page.asins.map((asin, k) => ({ asin, missingFields: i === 0 && k === 0 ? ["additionalProperty", "description"] : page.missingFields })),
  );
  const bundle = {
    m: { spec_checked: 300, spec_fender_found: 120, spec_fender_found_pct: 40, spec_avg_fender_pct: 80, spec_avg_amazon_pct: 99 },
    specPages: { pages, foundListings, withSpecBlock: 4, withAllBasics: 40, listings: 120 },
    listingContent: null,
  } as unknown as CanvasBundle;
  const read = ownPagesAction(bundle, null);
  const completeness = read.factors.find((factor) => factor.id === "completeness")!;
  const machine = read.factors.find((factor) => factor.id === "machine_specs")!;
  // Both brand-site page factors count listings, the unit the rank measures against.
  assert.deepEqual([completeness.affected, completeness.base], [108, 120]);
  assert.deepEqual([machine.affected, machine.base], [108, 120]);
  // One gap, one figure: the machine-readable specs factor folds into completeness.
  assert.deepEqual(read.action!.below!.map((factor) => factor.id), ["page_found", "completeness"]);
  assert.doesNotMatch(read.action!.fact, /machine-readable/i);

  const plan = buildPlan(syntheticInput(read.action));
  const own = plan.filter((item) => item.id === "own:pages");
  assert.equal(own.length, 1, "one own-pages item");
  const item = own[0]!;
  // Page found is covered by the exact pages finding, so the item works on completeness.
  assert.equal(item.title, `Add machine-readable specs to ${brandSite()} product pages`);
  assert.equal(item.count!.unit, "listings");
  assert.equal(countFigure(item.count!), `Listings whose ${brandSite()} page lacks machine-readable specs: 108 of 120`);
  assert.equal(firstN(planFigure(item).ratio ?? ""), reasonN(item.reason));
  assert.match(item.reason, /^Touches 108 of 1,000 monitored listings /);
  assert.equal(firstN(priorityFromPlan(item).impact!), "108");
  assert.equal(firstN(fixListCells(item, new Date(2026, 10, 23))[2]!), "108");
  assert.equal(item.tip, `${brandSite()} pages without machine-readable specs: 36 of 40 found pages. One page can serve several listings.`);
  // Exactly one item about brand-site specs on Priorities and the deck's fix slide.
  const specs = (text: string) => /machine-readable specs|spec block/i.test(text);
  assert.equal(priorityItems(plan).filter((card) => specs(`${card.title} ${card.impact} ${card.why}`)).length, 1);
  const fixes = deckFixes({ brandSite: "site.example", plan } as unknown as DeckInput);
  assert.ok(fixes.filter((fix) => specs(`${fix.action} ${fix.figureLabel ?? ""}`)).length <= 1);
});
