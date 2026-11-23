// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/priority-rank.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deckFixes } from "../lib/deck/deck-model.ts";
import type { DeckInput } from "../lib/deck/deck-types.ts";
import type { BriefingFinding, BriefingFindingId } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { buildLiveCommandCenter, inPriorities, priorityId } from "../lib/fender-canvas/command-center-from-live.ts";
import { buildHubSlots } from "../lib/fender-canvas/hub-slots.ts";
import {
  compareRankInputs,
  placeByRank,
  rankPriorities,
  rankReason,
  rankShare,
  sharePoints,
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

test("normalization: answers and listings compare as shares of their own base, never as raw counts", () => {
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
});

test("tie-break: same whole point, then larger monthly dollars, then the quicker fix, then input order", () => {
  assert.equal(sharePoints(0.052), 5);
  assert.equal(sharePoints(0.0449), 4);
  assert.deepEqual(
    ranked([
      ["slow", { affected: 52, base: 1000, unit: "listings", effort: "L" }],
      ["quick", { affected: 50, base: 1000, unit: "answers", effort: "S" }],
      ["dollars", { affected: 5, base: 100, unit: "listings", effort: "L", monthly: 1200 }],
      ["more-dollars", { affected: 5, base: 100, unit: "listings", effort: "L", monthly: 4000 }],
      ["bigger", { affected: 6, base: 100, unit: "listings", effort: "L" }],
      ["same-as-quick", { affected: 5, base: 100, unit: "answers", effort: "S" }],
    ]),
    ["bigger", "more-dollars", "dollars", "quick", "same-as-quick", "slow"],
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
  assert.equal(row!.reason, "Touches 524 of 1,080 listings (48.5%). $12.3K a month, analyst estimate. Effort M, catalog and site content.");
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
  assert.deepEqual(top, [
    "finding:exact_official_product",
    "signal:missing_specs",
    "signal:out_of_stock",
    "finding:map_leakage",
    "finding:splintered_bundles",
  ]);
  // Priorities (the command center) and the Briefing's first move.
  const priorities = buildLiveCommandCenter({} as CanvasBundle, { phase: "loading" }, { phase: "loading" }, plan).items;
  assert.deepEqual(priorities.slice(0, 5).map((item) => item.id), top.map(priorityId));
  assert.equal(firstMove(plan)?.id, top[0]);
  assert.equal(priorities[0]!.id, priorityId(firstMove(plan)!.id));
  assert.match(priorities[0]!.why, /^Touches 959 of 1,041 listings/);
  // Urgent Interventions: the table shows the plan, with the Buy Box row split in place, same ranks.
  const split = { withheld: 60, price: 50, other: 10, priceAsins: new Set<string>(), otherAsins: new Set<string>() };
  const table = planWithBuyBoxCauses(plan, split);
  assert.deepEqual(table.slice(0, 5).map((item) => [item.rank, item.id]), plan.slice(0, 5).map((item) => [item.rank, item.id]));
  const buyBoxRank = plan.find((item) => item.id === "finding:buy_box")!.rank;
  assert.deepEqual(table.filter((item) => item.id.startsWith("finding:buy_box")).map((item) => item.rank), [buyBoxRank, buyBoxRank]);
  // Deck slide 9.
  const deck = deckFixes({ brandSite: "brand.test", plan } as unknown as DeckInput);
  assert.deepEqual(deck.map((fix) => fix.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(deck.map((fix) => fix.ratio), plan.slice(0, 5).map((item) => item.ratio));
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
  assert.equal(retail.figure, "#3");
  assert.equal(retail.label, priorities[2]!.title);
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
