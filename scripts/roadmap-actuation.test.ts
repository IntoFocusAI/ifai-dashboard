// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/roadmap-actuation.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AiCallRow, AiCitationRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import type { BriefingFinding, BriefingFindingId } from "../lib/fender-canvas/briefing-retail-lead.ts";
import type { ClientBasis } from "../lib/fender-canvas/actuation-records.ts";
import { addDays } from "../lib/fender-canvas/actuation-score.ts";
import {
  actuationActions,
  ACTUATION_TARGET_LIMIT,
  suggestedTargets,
  withOwnedAnswersGap,
} from "../lib/fender-canvas/roadmap-actuation.ts";
import type { OwnPageAction } from "../lib/fender-canvas/roadmap-own-pages.ts";
import { buildPlan, phaseItems } from "../lib/fender-canvas/roadmap-plan.ts";
import { fixListCells } from "../lib/fender-canvas/roadmap-plan-read.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");

const ASOF = "2026-11-18";

function call(id: string): AiCallRow {
  return {
    id,
    audit_run_id: "run",
    sim_id: 1,
    engine: "chatgpt",
    model: null,
    category: "electric",
    prompt: "Which guitar should I buy?",
    prompt_key: null,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender",
    material_hallucination: null,
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: null,
  };
}

function cite(callId: string, url: string): AiCitationRow {
  return {
    audit_run_id: "run",
    sim_id: 1,
    simulation_id: callId,
    prompt_key: null,
    prompt_kind: "commercial",
    category: "electric",
    engine: "chatgpt",
    position: 1,
    url,
    domain: new URL(url).hostname,
    title: null,
  };
}

/**
 * 40 shopping answers with sources. reddit.com in 6, then six more community sites in 1 each
 * (each 2.5%, under the 10% source threshold); guitarworld.com in 3; a retailer in 10.
 */
function snapshot(): AiSearchSnapshot {
  const calls = Array.from({ length: 40 }, (_, i) => call(`c${i + 1}`));
  const citations: AiCitationRow[] = calls.map((c) => cite(c.id, `https://www.sweetwater.com/p/${c.id}`));
  for (let i = 0; i < 6; i += 1) citations.push(cite(calls[i]!.id, `https://www.reddit.com/r/guitars/${i}`));
  const forums = ["talkbass.com", "thegearpage.net", "ultimate-guitar.com", "harmonycentral.com", "gearspace.com", "acousticguitarforum.com"];
  forums.forEach((domain, i) => citations.push(cite(calls[10 + i]!.id, `https://www.${domain}/t/${i}`)));
  for (let i = 0; i < 3; i += 1) citations.push(cite(calls[20 + i]!.id, `https://www.guitarworld.com/guide-${i}`));
  return { run: { audit_run_id: "run" } as AiSearchSnapshot["run"], calls, probes: [], citations };
}

const NONE: ClientBasis = { programs: [], items: { E2: 0, E3: 0 } };

function inPlace(factor: "P1" | "P2", verifiedOn: string) {
  return {
    factor,
    hasOwner: true,
    hasEvidence: true,
    verifiedOn,
    targetDomainCount: 3,
    cadencePer30Days: factor === "P1" ? 4 : null,
    targetCount: factor === "P2" ? 6 : null,
  };
}

test("target lists: the top five community and publication sites AI cites, even under the 10% threshold", () => {
  const targets = suggestedTargets(snapshot());
  assert.equal(targets.community.length, ACTUATION_TARGET_LIMIT);
  assert.deepEqual(targets.community[0], { domain: "reddit.com", answers: 6, total: 40 });
  assert.ok(targets.community.slice(1).every((site) => site.answers === 1), "sites at 2.5% are listed");
  assert.deepEqual(
    targets.community.slice(1).map((site) => site.domain),
    [...targets.community.slice(1).map((site) => site.domain)].sort(),
    "ties sort by name",
  );
  assert.deepEqual(targets.publication, [{ domain: "guitarworld.com", answers: 3, total: 40 }]);
  assert.ok(!targets.community.some((site) => site.domain === "sweetwater.com"), "a retailer is never a target");
});

test("target lists: none while the window is not read or has no answers with sources", () => {
  assert.deepEqual(suggestedTargets(null), { community: [], publication: [] });
  const empty = { ...snapshot(), citations: [] };
  assert.deepEqual(suggestedTargets(empty), { community: [], publication: [] });
});

test("no records read: no Actuation item, never a made-up one", () => {
  assert.deepEqual(actuationActions({ basis: null, asOf: ASOF, targets: suggestedTargets(snapshot()) }), []);
  assert.deepEqual(actuationActions({ basis: undefined, asOf: ASOF }), []);
});

test("confirm: each program not in place asks to confirm it in Days 1 to 30, with its suggested targets", () => {
  const items = actuationActions({ basis: NONE, asOf: ASOF, targets: suggestedTargets(snapshot()) });
  assert.deepEqual(items.map((item) => [item.id, item.phase]), [
    ["actuation:P1:confirm", "days_1_30"],
    ["actuation:P2:confirm", "days_1_30"],
  ]);
  const [p1, p2] = items;
  assert.equal(p1!.percent, "0 of 20 points");
  assert.equal(p1!.fact, "");
  assert.match(p1!.action, /^Confirm your community response program to IntoFocus \(worth 20 AI Actuation points\): who owns it, which communities, and how many responses every 30 days\.$/);
  assert.equal(p1!.targets?.label, "Suggested communities");
  assert.equal(p1!.targets?.sites.length, 5);
  assert.equal(p2!.targets?.sites[0]?.domain, "guitarworld.com");
  assert.match(p2!.action, /PR and reviewer outreach program/);
  // Without the window read the item still shows, with no list.
  const bare = actuationActions({ basis: NONE, asOf: ASOF });
  assert.equal(bare.length, 2);
  assert.equal(bare[0]!.targets, null);
  for (const item of items) assert.doesNotMatch(`${item.fact} ${item.action}`, /—|n't|!/);
});

test("activity: a program in place under its target asks to post and send links; at target, nothing", () => {
  const verified = addDays(ASOF, -20);
  const basis: ClientBasis = { programs: [inPlace("P1", verified), inPlace("P2", verified)], items: { E2: 5, E3: 2 } };
  const items = actuationActions({ basis, asOf: ASOF, targets: suggestedTargets(snapshot()) });
  assert.deepEqual(items.map((item) => [item.id, item.phase, item.ratio]), [
    ["actuation:E2:activity", "days_31_60", "5 of 12"],
    ["actuation:E3:activity", "days_61_90", "2 of 6"],
  ]);
  assert.equal(items[0]!.fact, "5 of 12 community responses verified in the last 90 days.");
  assert.match(items[0]!.action, /until 12 are verified\.$/);
  assert.equal(items[0]!.targets, null, "confirmed programs have their own targets on record");
  const met = actuationActions({ basis: { ...basis, items: { E2: 12, E3: 6 } }, asOf: ASOF });
  assert.deepEqual(met, []);
});

test("renew: a program in its last 14 days asks to renew in Days 1 to 30; at 15 days left, not yet", () => {
  const fourteen = addDays(ASOF, -(90 - 14));
  const items = actuationActions({ basis: { programs: [inPlace("P1", fourteen)], items: { E2: 12, E3: 0 } }, asOf: ASOF });
  assert.deepEqual(items.map((item) => [item.id, item.phase, item.percent]), [
    ["actuation:P1:renew", "days_1_30", "14 days left"],
    ["actuation:P2:confirm", "days_1_30", "0 of 20 points"],
  ]);
  assert.match(items[0]!.action, /before Dec 2, 2026 so it keeps its 20 points\.$/);
  const fifteen = addDays(ASOF, -(90 - 15));
  const later = actuationActions({ basis: { programs: [inPlace("P1", fifteen)], items: { E2: 12, E3: 0 } }, asOf: ASOF });
  assert.deepEqual(later.map((item) => item.id), ["actuation:P2:confirm"]);
  // A lapsed program reads as not in place: confirm again, not renew.
  const lapsed = actuationActions({ basis: { programs: [inPlace("P1", addDays(ASOF, -95))], items: { E2: 0, E3: 0 } }, asOf: ASOF });
  assert.equal(lapsed[0]!.id, "actuation:P1:confirm");
});

const OWN: OwnPageAction = {
  id: "own:pages",
  urgent: true,
  phase: "days_31_60",
  label: "Fender pages and listings: A+ content",
  percent: "40.0%",
  ratio: "4 of 10",
  tone: "warning",
  fact: "A+ content reads 40.0% (Fair).",
  action: "Work through the product pages.",
  open: { spokeId: "specs", tab: "Amazon A+ Matrix" },
  share: 1,
};

test("E1 joins the existing brand-pages row when under its 15% target, and never adds a row", () => {
  const joined = withOwnedAnswersGap(OWN, { withOwned: 3, resolved: 60 });
  assert.equal(joined!.id, "own:pages");
  assert.match(joined!.fact, /^A\+ content reads 40\.0% \(Fair\)\. \S+ pages are cited in 5\.0% of unbranded shopping answers \(3 of 60\), against the AI Actuation target of 15%\.$/);
  assert.equal(withOwnedAnswersGap(OWN, { withOwned: 9, resolved: 60 }), OWN, "at target, unchanged");
  assert.equal(withOwnedAnswersGap(OWN, null), OWN, "no E1 reading, unchanged");
  assert.equal(withOwnedAnswersGap(OWN, { withOwned: 0, resolved: 0 }), OWN);
  assert.equal(withOwnedAnswersGap(null, { withOwned: 0, resolved: 60 }), null, "no row, none added");
});

test("the plan: Actuation items join the one ranking and add at most two per program", () => {
  const actuation = actuationActions({ basis: NONE, asOf: ASOF, targets: suggestedTargets(snapshot()) });
  const plan = buildPlan({ findings: [], signals: [], sources: [], actuation });
  assert.deepEqual(plan.map((item) => [item.rank, item.id, item.kind]), [
    [1, "actuation:P1:confirm", "actuation"],
    [2, "actuation:P2:confirm", "actuation"],
  ]);
  // Two items: one column each, by rank (placeByRank).
  assert.deepEqual(phaseItems(plan, "days_1_30").map((item) => item.id), ["actuation:P1:confirm"]);
  assert.deepEqual(phaseItems(plan, "days_31_60").map((item) => item.id), ["actuation:P2:confirm"]);
  assert.equal(plan[0]!.open.tab, "Citation Ecosystem");
  const cells = fixListCells(plan[0]!, new Date("2026-11-18T12:00:00Z"));
  assert.match(cells[1]!, /Suggested communities: reddit\.com \(6 of 40 answers\), /);
  assert.deepEqual(buildPlan({ findings: [], signals: [], sources: [] }), [], "no records, no items");
});

function finding(id: BriefingFindingId, tone: BriefingFinding["tone"], n: number, d: number): BriefingFinding {
  return {
    id,
    spokeId: "ecommerce",
    tab: "MAP Leakage",
    label: id,
    percent: `${((100 * n) / d).toFixed(1)}%`,
    ratio: `${n} of ${d}`,
    color: "var(--danger-red)",
    tone,
    pie: null,
    tip: null,
    explainer: `${id} explainer`,
    numerator: n,
    denominator: d,
    partial: null,
    loading: false,
  };
}

test("the Confirm items have no count, so they follow every counted item that needs action (central rank, 23 Nov 2026)", () => {
  const findings = [
    finding("buy_box", "danger", 57, 1088),
    finding("map_leakage", "danger", 121, 633),
    finding("splintered_bundles", "danger", 75, 451),
    finding("exact_official_product", "danger", 82, 1041),
    finding("unbranded_discovery", "warning", 30, 60),
  ];
  const signals = Array.from({ length: 12 }, (_, i) => ({
    id: `signal:out_of_stock_${i}`, group: "ecommerce" as const, label: `Out of stock ${i}`, share: 0.2, numerator: 2, denominator: 10,
    fact: "f", action: "a", open: { spokeId: "ecommerce", tab: "Out of Stock" }, partial: null,
  }));
  const actuation = actuationActions({ basis: NONE, asOf: ASOF, targets: suggestedTargets(snapshot()) });
  const plan = buildPlan({ findings, signals, sources: [], actuation });
  const ids = plan.map((item) => item.id);
  const counted = plan.filter((item) => item.inputs.tier === "action" && item.share != null).length;
  assert.deepEqual(ids.slice(counted, counted + 2), ["actuation:P1:confirm", "actuation:P2:confirm"]);
  assert.ok(plan.slice(0, counted).every((item) => item.share != null));
  assert.equal(ids.at(-1), "finding:unbranded_discovery", "the outcome is tracked last");
  assert.deepEqual(plan.map((item) => item.rank), plan.map((_, i) => i + 1));
});

test("an activity item counts the verified links short of its target; links have no common base, so it follows like confirm and renew", () => {
  const basis: ClientBasis = { programs: [inPlace("P1", addDays(ASOF, -80))], items: { E2: 5, E3: 0 } };
  const plan = buildPlan({ findings: [], signals: [], sources: [], actuation: actuationActions({ basis, asOf: ASOF }) });
  assert.deepEqual(plan.map((item) => item.id), ["actuation:P1:renew", "actuation:P2:confirm", "actuation:E2:activity"]);
  const activity = plan.find((item) => item.id === "actuation:E2:activity")!;
  assert.equal(activity.inputs.unit, "links");
  assert.equal(activity.inputs.affected, activity.inputs.base! - 5);
  assert.equal(activity.share, null);
});

test("the plan read takes the records from the bundle and the targets from the date-pill window", () => {
  const src = read("lib/fender-canvas/roadmap-plan-read.ts");
  assert.match(src, /basis: bundle\?\.actuation/);
  assert.match(src, /suggestedTargets\(current\)/);
  assert.match(src, /withOwnedAnswersGap\(own\.action/);
  const staff = read("app/(canvas)/dashboard/actuation-records/page.tsx");
  assert.match(staff, /loadActuationTargets\(client\)/);
});
