// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/priority-rank.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deckFixes } from "../lib/deck/deck-model.ts";
import type { DeckInput } from "../lib/deck/deck-types.ts";
import type { BriefingFinding, BriefingFindingId } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { buildLiveCommandCenter, inPriorities, PRIORITIES_CAP, priorityId, priorityItems } from "../lib/fender-canvas/command-center-from-live.ts";
import { bulletsPlanItem, BULLETS_ROW_ID } from "../lib/fender-canvas/action-items-bullets-row.ts";
import { groupQuestions, type FocusAction } from "../lib/fender-canvas/roadmap-focus.ts";
import { buildHubSlots } from "../lib/fender-canvas/hub-slots.ts";
import {
  compareRankInputs,
  placeByRank,
  rankPriorities,
  rankReason,
  commonReach,
  rankShare,
  sharePoints,
  countRatio,
  type RankInputs,
} from "../lib/fender-canvas/priority-rank.ts";
import { planWithBuyBoxCauses } from "../lib/fender-canvas/action-items-buybox-rows.ts";
import { buildPlan, firstMove, phaseItems, PLAN_PHASES, type PlanItem } from "../lib/fender-canvas/roadmap-plan.ts";
import { gapKindOf, priorityList, topPriorities } from "../lib/fender-canvas/priority-list.ts";
import { brandSite } from "../lib/brand-copy.ts";
import type { SignalAction } from "../lib/fender-canvas/roadmap-signals.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");

function inputs(extra: Partial<RankInputs>): RankInputs {
  return { affected: null, base: null, unit: null, monthly: null, effort: "M", dependsOn: [], tier: "action", ...extra };
}

function ranked(rows: Array<[string, Partial<RankInputs>]>): string[] {
  return rankPriorities(rows.map(([id, extra]) => ({ id, inputs: inputs(extra) }))).map((row) => row.id);
}

test("reach: answers and listings compare as shares of a common base, never as raw counts", () => {
  // 600 answers of 4,000 (15%) against 30 listings of 100 (30%): the listings gap leads despite the smaller count.
  assert.deepEqual(
    ranked([
      ["answers", { affected: 600, base: 4000, unit: "answers" }],
      ["listings", { affected: 30, base: 100, unit: "listings" }],
    ]),
    ["listings", "answers"],
  );
  assert.equal(rankShare({ affected: 30, base: 100 }), 0.3);
  assert.equal(rankShare({ affected: 3, base: 0 }), null, "an empty base has no share");
  assert.equal(rankShare({ affected: null, base: 100 }), null);
  assert.equal(rankShare({ affected: 30, base: 100, reach: 1000 }), 0.03, "the common base replaces the own base");
});

test("reach: a single question with a small base cannot outrank a fix touching thousands", () => {
  // 112 of 112 answers is 100% of its own base, but 112 of 5,000 resolved AI answers on the common base.
  const rows = rankPriorities(
    [
      { id: "question", inputs: inputs({ affected: 112, base: 112, unit: "answers" }) },
      { id: "rival", inputs: inputs({ affected: 611, base: 4978, unit: "answers" }) },
      { id: "pages", inputs: inputs({ affected: 997, base: 1090, unit: "listings" }) },
    ],
    { answers: 5000, listings: 1170 },
  );
  assert.deepEqual(rows.map((row) => row.id), ["pages", "rival", "question"]);
  assert.equal(rows[2]!.reason, "Touches 112 of 5,000 resolved AI answers (2.2%). Effort M, catalog and site content.");
  assert.equal(rows[0]!.reason, "Touches 997 of 1,170 monitored listings (85.2%). Effort M, catalog and site content.");
  // Without a read total, the common base is the largest own base of the unit.
  assert.deepEqual(commonReach([{ inputs: inputs({ affected: 1, base: 112, unit: "answers" }) }, { inputs: inputs({ affected: 1, base: 4978, unit: "answers" }) }]), { answers: 4978, listings: null });
  // Links have no common base, so a links item follows every counted item.
  assert.deepEqual(
    ranked([
      ["links", { affected: 10, base: 10, unit: "links", effort: "S" }],
      ["small", { affected: 1, base: 100, unit: "listings", effort: "L" }],
    ]),
    ["small", "links"],
  );
});

test("tie-break: same whole point, then larger monthly dollars, then the quicker fix, then input order", () => {
  assert.equal(sharePoints(0.052), 5);
  assert.equal(sharePoints(0.0449), 4);
  // Every item on the same common base (1,000), so only rules 1 to 3 order them.
  assert.deepEqual(
    ranked([
      ["slow", { affected: 52, base: 1000, unit: "listings", effort: "L" }],
      ["quick", { affected: 50, base: 1000, unit: "answers", effort: "S" }],
      ["dollars", { affected: 30, base: 1000, unit: "listings", effort: "L", monthly: 1200 }],
      ["more-dollars", { affected: 30, base: 1000, unit: "listings", effort: "L", monthly: 4000 }],
      ["bigger", { affected: 40, base: 1000, unit: "listings", effort: "L" }],
      ["same-as-quick", { affected: 46, base: 1000, unit: "answers", effort: "S" }],
    ]),
    ["quick", "same-as-quick", "slow", "bigger", "more-dollars", "dollars"],
  );
});

test("tiers: no count follows the counted items; watch, on track, and the outcome follow every action", () => {
  assert.deepEqual(
    ranked([
      ["outcome", { affected: 90, base: 100, unit: "answers", tier: "outcome" }],
      ["on-track", { affected: 80, base: 100, unit: "listings", tier: "on_track" }],
      ["watch", { affected: 70, base: 100, unit: "answers", tier: "watch" }],
      ["no-count", { monthly: 9000, effort: "S" }],
      ["counted", { affected: 1, base: 100, unit: "listings" }],
    ]),
    ["counted", "no-count", "watch", "on-track", "outcome"],
  );
  assert.ok(compareRankInputs(inputs({ affected: 1, base: 2 }), inputs({ affected: 1, base: 2 })) === 0);
});

test("each item carries its rank inputs and one plain reason, in brand voice", () => {
  const [row] = rankPriorities([{ id: "a", inputs: inputs({ affected: 524, base: 1080, unit: "listings", monthly: 12345, effort: "M" }) }]);
  assert.equal(row!.rank, 1);
  assert.equal(row!.reason, "Touches 524 of 1,080 monitored listings (48.5%). $12.3K a month, analyst estimate. Effort M, catalog and site content.");
  assert.equal(rankReason(inputs({ effort: "S" })), "Has no single answer or listing count, so it follows the counted items. Effort S, a listing or offer fix.");
  for (const line of [row!.reason, rankReason(inputs({ tier: "outcome" })), rankReason(inputs({ tier: "watch" }))]) {
    assert.doesNotMatch(line, /n't|—/);
  }
});

const deps = (id: string, dependsOn: string[] = []) => ({ id, inputs: { dependsOn } });

test("placement: a third per column by rank; never more than half of 6 or more in one column", () => {
  const six = placeByRank(["a", "b", "c", "d", "e", "f"].map((id) => deps(id)));
  assert.deepEqual([...six.values()], [0, 0, 1, 1, 2, 2]);
  // Every item but the first waits on the first: the first column keeps one, the rest share the
  // next two, and no column passes half (5 of 10).
  const ten = placeByRank(Array.from({ length: 10 }, (_, i) => deps(`i${i}`, i === 0 ? [] : ["i0"])));
  const counts = [0, 1, 2].map((column) => [...ten.values()].filter((value) => value === column).length);
  assert.deepEqual(counts, [1, 5, 4]);
  assert.ok(counts.every((count) => count <= 5));
});

test("placement: an item goes in a later column than its prerequisite, even one ranked below it", () => {
  const placed = placeByRank([deps("content", ["pages"]), deps("x"), deps("pages"), deps("y")]);
  assert.ok(placed.get("content")! > placed.get("pages")!);
  const absent = placeByRank([deps("content", ["pages"])]);
  assert.equal(absent.get("content"), 0, "a prerequisite not in the list holds nothing back");
});

function finding(id: BriefingFindingId, tone: BriefingFinding["tone"], numerator: number, denominator: number): BriefingFinding {
  return {
    id,
    spokeId: id === "exact_official_product" ? "specs" : id === "unbranded_discovery" ? "aeo" : "ecommerce",
    tab: id === "exact_official_product" ? "Findability" : id === "unbranded_discovery" ? "Run Details" : "Suppressed Listings",
    label: id,
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

function signal(id: string, group: SignalAction["group"], numerator: number, denominator: number, spokeId: string): SignalAction {
  return { id, group, label: id, share: numerator / denominator, numerator, denominator, fact: "f", action: `Act on ${id}.`, open: { spokeId, tab: "Tab" }, partial: null };
}

function livePlan(): PlanItem[] {
  return buildPlan({
    findings: [
      finding("buy_box", "danger", 60, 1170),
      finding("map_leakage", "danger", 121, 633),
      finding("splintered_bundles", "warning", 75, 451),
      finding("exact_official_product", "danger", 82, 1041),
      finding("unbranded_discovery", "danger", 300, 1000),
    ],
    signals: [
      signal("signal:out_of_stock", "ecommerce", 400, 1170, "ecommerce"),
      signal("signal:missing_specs", "ecommerce", 524, 1080, "specs"),
      signal("signal:rival:acoustics", "answers", 611, 4978, "competitors"),
      signal("signal:fact_contradictions", "answers", 4, 2301, "aeo"),
    ],
    sources: [],
  });
}

test("one list drives every view: Priorities, Urgent Interventions, deck, map cards, Briefing first move, Roadmap", () => {
  const plan = livePlan();
  const top = plan.slice(0, 5).map((item) => item.id);
  // Critical first (exact pages, MAP, Buy Box), then At risk (splintered bundles), then the rest by
  // reach. Common bases: 1,170 monitored listings, 4,978 resolved AI answers (the largest own bases here).
  assert.deepEqual(top, [
    "finding:exact_official_product",
    "finding:map_leakage",
    "finding:buy_box",
    "finding:splintered_bundles",
    "signal:missing_specs",
  ]);
  // Priorities (the command center) and the Briefing's first move.
  const priorities = buildLiveCommandCenter({} as CanvasBundle, { phase: "loading" }, { phase: "loading" }, plan).items;
  assert.deepEqual(priorities.slice(0, 5).map((item) => item.id), top.map(priorityId));
  assert.equal(firstMove(plan)?.id, top[0]);
  assert.equal(priorities[0]!.id, priorityId(firstMove(plan)!.id));
  assert.match(priorities[0]!.why, /^Critical, so it leads the items that need action\. Touches 959 of 1,170 monitored listings/);
  assert.equal(priorities[0]!.severity, "critical");
  // Urgent Interventions: the table shows the plan, with the Buy Box row split in place, same ranks.
  const split = { withheld: 60, price: 50, other: 10, priceAsins: new Set<string>(), otherAsins: new Set<string>() };
  const table = planWithBuyBoxCauses(plan, split);
  const rest = (items: readonly PlanItem[]) => items.filter((item) => !item.id.startsWith("finding:buy_box")).map((item) => [item.rank, item.id]);
  assert.deepEqual(rest(table), rest(plan));
  // Each Buy Box row shows its own listings as its one count, in its figure and its reason alike.
  for (const row of table.filter((item) => item.id.startsWith("finding:buy_box:"))) {
    assert.match(row.reason, new RegExp(`Touches ${countRatio({ ...row.count!, partial: false }).split(" of ")[0]} of `), row.id);
  }
  const buyBoxRank = plan.find((item) => item.id === "finding:buy_box")!.rank;
  assert.deepEqual(table.filter((item) => item.id.startsWith("finding:buy_box")).map((item) => item.rank), [buyBoxRank, buyBoxRank]);
  // Deck slide 9.
  const deck = deckFixes({ brandSite: "brand.test", plan } as unknown as DeckInput);
  assert.deepEqual(deck.map((fix) => fix.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(deck.map((fix) => fix.ratio), plan.slice(0, 5).map((item) => countRatio(item.count!)));
  // Map action cards: each card names its bubble's best-ranked item at that item's rank.
  const feeds = buildHubSlots({
    suppressed: "loading",
    ai: { phase: "loading" },
    findability: { phase: "loading" },
    missingSpecPages: null,
    phaseOneValue: "",
    phaseOneDetail: "",
    commandItems: priorities,
  });
  const specs = feeds["spoke-specs"]!.slots[2];
  assert.equal(specs.figure, "#1");
  assert.equal(specs.label, priorities[0]!.title);
  const retail = feeds["spoke-retail"]!.slots[2];
  assert.equal(retail.figure, "#2");
  assert.equal(retail.label, priorities[1]!.title);
  for (const feed of Object.values(feeds)) {
    const action = feed.slots[2];
    const rank = /^#(\d+)$/.exec(action.figure)?.[1];
    if (rank) assert.equal(action.label, priorities[Number(rank) - 1]!.title, feed.bubbleId);
  }
  // Roadmap: read column by column, the order is the rank (no prerequisite reorders these five).
  const roadmap = PLAN_PHASES.flatMap((phase) => phaseItems(plan, phase.id)).map((item) => item.id);
  assert.deepEqual(roadmap.slice(0, 5), top);
  assert.ok(roadmap.indexOf("signal:rival:acoustics") > roadmap.indexOf("finding:exact_official_product"));
  assert.ok(PLAN_PHASES.every((phase) => phaseItems(plan, phase.id).length <= Math.floor(roadmap.length / 2)));
  // The outcome is tracked last and has no column; Priorities leaves it out.
  assert.equal(plan.at(-1)!.id, "finding:unbranded_discovery");
  assert.ok(!priorities.some((item) => item.id === "finding:unbranded_discovery"));
  assert.ok(plan.filter(inPriorities).every((item) => item.inputs.tier === "action"));
});

test("the views read the plan: no view keeps its own order", () => {
  assert.match(read("components/v3/FenderBrandCanvas.tsx"), /useRoadmapPlan\(retail, bundle, staffFocus\(\), findability\)/);
  assert.match(read("lib/fender-canvas/build-canvas-spec.tsx"), /buildLiveCommandCenter\(bundle, retail, aiSearch, options\.plan \?\? null\)/);
  assert.match(read("components/v3/live/deck/useDeckModel.ts"), /useRoadmapPlan\(retail, bundle\)/);
  assert.doesNotMatch(read("lib/fender-canvas/roadmap-plan.ts"), /\.\.\.critical,|\.\.\.confirm,/);
});

test("no client-name branching in the rank module", () => {
  const source = read("lib/fender-canvas/priority-rank.ts");
  assert.doesNotMatch(source, /["'`](fender|ledlenser|fmic|squier)["'`]/i);
});

test("every ranked item carries a task title, and the Briefing can read the list as plain data", () => {
  const plan = livePlan();
  const list = priorityList(plan);
  assert.deepEqual(list.map((item) => item.id), plan.map((item) => item.id));
  const byId = new Map(list.map((item) => [item.id, item]));
  assert.equal(byId.get("finding:exact_official_product")!.actionTitle, `Publish one ${brandSite()} page for each exact product`);
  assert.equal(byId.get("finding:buy_box")!.actionTitle, "Correct each offer so the Buy Box returns");
  assert.equal(byId.get("signal:out_of_stock")!.actionTitle, "Restock or correct the out-of-stock listings");
  assert.equal(byId.get("signal:rival:acoustics")!.actionTitle, "Act on signal:rival:acoustics");
  assert.equal(gapKindOf("signal:rival:acoustics"), "rival");
  assert.equal(gapKindOf("finding:buy_box"), "buy_box");
  assert.equal(gapKindOf("estimate:aplus"), "aplus");
  assert.equal(gapKindOf("actuation:P1:confirm"), "actuation_confirm");
  assert.equal(gapKindOf("focus:question:best-amp"), "question");
  assert.equal(gapKindOf("own:wording"), "own_wording");
  for (const item of list) {
    assert.doesNotMatch(item.actionTitle, /\.$|: \d/, item.id);
    assert.notEqual(item.actionTitle, item.label, item.id);
  }
  const top = topPriorities(plan, 3);
  assert.deepEqual(top.map((item) => item.rank), [1, 2, 3]);
  // Priorities, the deck, and the map cards show the same task titles.
  const priorities = buildLiveCommandCenter({} as CanvasBundle, { phase: "loading" }, { phase: "loading" }, plan).items;
  assert.deepEqual(priorities.slice(0, 3).map((item) => item.title), top.map((item) => item.actionTitle));
  const deck = deckFixes({ brandSite: brandSite(), plan } as unknown as DeckInput);
  assert.deepEqual(deck.slice(0, 3).map((fix) => fix.action), top.map((item) => item.actionTitle));
});

function question(slug: string, wins: number, resolved: number, gap: number): FocusAction {
  return {
    id: `focus:question:${slug}`,
    focus: "question",
    tier: "priority",
    label: `"${slug}"`,
    numerator: wins,
    denominator: resolved,
    fact: "f",
    action: `Word the ${brandSite()} product pages to answer this question.`,
    open: { spokeId: "aeo", tab: "Run Details" },
    evidence: null,
    categories: ["electric"],
    siteType: null,
    pages: [],
    trend: null,
    gap,
    partial: null,
  };
}

function crowdedPlan(): PlanItem[] {
  const questions = groupQuestions([
    question("best-amp", 0, 112, 40),
    question("best-pedal", 2, 90, 38),
    question("best-strat", 5, 120, 36),
    question("best-tele", 6, 100, 34),
    question("best-bass", 8, 80, 30),
  ]);
  return buildPlan({
    findings: [
      finding("buy_box", "danger", 60, 1170),
      finding("map_leakage", "danger", 121, 633),
      finding("splintered_bundles", "warning", 75, 451),
      finding("exact_official_product", "danger", 82, 1041),
      finding("unbranded_discovery", "danger", 300, 1000),
    ],
    signals: [
      signal("signal:out_of_stock", "ecommerce", 400, 1170, "ecommerce"),
      signal("signal:missing_specs", "ecommerce", 524, 1080, "specs"),
      signal("signal:rival:acoustics", "answers", 611, 4978, "competitors"),
      signal("signal:rival:bass", "answers", 300, 4978, "competitors"),
      signal("signal:rival:amps", "answers", 200, 4978, "competitors"),
      signal("signal:fact_contradictions", "answers", 4, 2301, "aeo"),
    ],
    sources: [],
    focus: questions,
    extra: [bulletsPlanItem({ listings: 900, fullBullets: 600, short: 300, pct: 66.7 })!],
    reach: { answers: 5000, listings: 1170 },
  });
}

test("repeated actions: the weakest questions with one action are one item that lists them", () => {
  const plan = crowdedPlan();
  const questions = plan.filter((item) => item.id.startsWith("focus:question"));
  assert.equal(questions.length, 1, "five questions with the same action are one item");
  const group = questions[0]!;
  assert.equal(group.id, "focus:questions:priority");
  assert.equal(group.title, `Word the ${brandSite()} product pages to answer these questions`);
  assert.equal(group.label, "The 5 weakest questions");
  // Each member shows its own answers behind the best question, so they add up to the item's one count.
  assert.deepEqual(group.members!.map((member) => member.ratio), ["45 of 112", "34 of 90", "43 of 120", "34 of 100", "24 of 80"]);
  assert.match(group.fact, /"best-amp" \(0 of 112\), "best-pedal" \(2 of 90\),/);
  // Reach: the answers each question is short of the best, added, out of all 5,000 resolved AI answers.
  assert.equal(group.inputs.affected, 45 + 34 + 43 + 34 + 24);
  assert.equal(group.inputs.reach, 5000);
  assert.ok(group.rank > plan.find((item) => item.id === "finding:exact_official_product")!.rank);
  // One question alone keeps its own id and wording.
  const single = groupQuestions([question("best-amp", 0, 112, 40)]);
  assert.deepEqual(single.map((item) => item.id), ["focus:question:best-amp"]);
});

test("Priorities shows the first 10 of the central order, and slide 9 its first five distinct actions", () => {
  const plan = crowdedPlan();
  const priorities = buildLiveCommandCenter({} as CanvasBundle, { phase: "loading" }, { phase: "loading" }, plan).items;
  assert.equal(PRIORITIES_CAP, 10);
  assert.ok(plan.filter(inPriorities).length > PRIORITIES_CAP, "the fixture has more than ten actions");
  assert.equal(priorities.length, PRIORITIES_CAP);
  assert.deepEqual(priorities.map((item) => item.title), plan.filter(inPriorities).slice(0, 10).map((item) => item.title));
  // The map cards read every ranked item, so a card past ten keeps its rank.
  assert.equal(priorityItems(plan).length, plan.filter(inPriorities).length);
  const deck = deckFixes({ brandSite: brandSite(), plan } as unknown as DeckInput);
  assert.equal(deck.length, 5);
  assert.equal(new Set(deck.map((fix) => fix.action)).size, 5, "five distinct actions");
  assert.deepEqual(deck.map((fix) => fix.action), priorities.slice(0, 5).map((item) => item.title));
  assert.deepEqual(deck.map((fix) => fix.rank), [1, 2, 3, 4, 5]);
  // The top item is never a single question on a small base.
  assert.doesNotMatch(plan[0]!.id, /^focus:question/);
});

test("the Amazon bullets item is one ranked candidate on the monitored listings", () => {
  const plan = crowdedPlan();
  const bullets = plan.find((item) => item.id === BULLETS_ROW_ID)!;
  assert.equal(bullets.title, "Fill all five bullets on each Amazon listing");
  assert.equal(bullets.ratio, "300 of 900");
  assert.equal(bullets.reason, "Touches 300 of 1,170 monitored listings (25.6%). Effort M, catalog and site content.");
  assert.equal(gapKindOf(BULLETS_ROW_ID), "amazon_bullets");
  assert.equal(bulletsPlanItem({ listings: 900, fullBullets: 900, short: 0, pct: 100 }), null, "no item when every listing has five bullets");
  assert.equal(bulletsPlanItem(null), null);
});

test("Roadmap counts carry thousands separators", () => {
  for (const file of ["lib/fender-canvas/roadmap-plan.ts", "lib/fender-canvas/roadmap-focus.ts", "lib/fender-canvas/roadmap-plan-read.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /\$\{(unread|rows\.length|stored\.length|needs|priorAnswers|now\.read\.answersWithCitation|page\.answers)\}/, file);
  }
});
