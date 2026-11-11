// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/roadmap-plan.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AiCallRow, AiCitationRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import type { BriefingFinding, BriefingFindingId } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { roadmapBubbleFace, roadmapMetric } from "../lib/fender-canvas/roadmap-bubble.ts";
import {
  buildPlan,
  emptyPlanLine,
  phaseItems,
  planFindingsFigure,
  PLAN_PHASES,
} from "../lib/fender-canvas/roadmap-plan.ts";
import { signalActions } from "../lib/fender-canvas/roadmap-signals.ts";
import { siteType, sourceActions } from "../lib/fender-canvas/roadmap-sources.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");

function finding(id: BriefingFindingId, tone: BriefingFinding["tone"], numerator: number | null, denominator: number | null): BriefingFinding {
  const stored = numerator != null && denominator != null;
  return {
    id,
    spokeId: id === "exact_official_product" ? "specs" : id === "unbranded_discovery" ? "aeo" : "ecommerce",
    tab: id === "exact_official_product" ? "Findability" : id === "unbranded_discovery" ? "Run Details" : "MAP Leakage",
    label: id,
    percent: stored ? `${((100 * numerator!) / denominator!).toFixed(1)}%` : "Not available*",
    ratio: stored ? `${numerator} of ${denominator}` : null,
    color: "var(--danger-red)",
    tone,
    pie: null,
    tip: null,
    explainer: `${id} explainer`,
    numerator,
    denominator,
    partial: null,
    loading: false,
  };
}

const LIVE = [
  finding("buy_box", "danger", 57, 1088),
  finding("map_leakage", "danger", 121, 633),
  finding("splintered_bundles", "danger", 75, 451),
  finding("exact_official_product", "danger", 82, 1041),
  finding("unbranded_discovery", "warning", 30, 60),
];

const ON_TRACK = LIVE.map((f) => ({ ...f, tone: "success" as const }));

function call(id: string, category: string): AiCallRow {
  return {
    id,
    audit_run_id: "run",
    sim_id: Number(id.replace(/\D/g, "")) || 1,
    engine: "chatgpt",
    model: null,
    category,
    prompt: "What should I buy?",
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
    category: null,
    engine: "chatgpt",
    position: 1,
    url,
    domain: new URL(url).hostname,
    title: null,
  };
}

/** Ten shopping answers with sources; `cited` of them cite guitarworld.com. Run "r3" also cites reddit.com once. */
function run(id: string, cited: number): AiSearchSnapshot {
  const calls = Array.from({ length: 10 }, (_, i) => call(`${id}-c${i + 1}`, i % 2 ? "acoustics" : "electric"));
  const citations = calls.map((c, i) =>
    cite(c.id, i < cited ? `https://www.guitarworld.com/guide-${i % 3}` : `https://example-shop.test/p${i}`),
  );
  if (id === "r3") citations.push(cite(calls[9]!.id, "https://www.reddit.com/r/guitars/1"));
  return { run: { audit_run_id: id } as AiSearchSnapshot["run"], calls, probes: [], citations };
}

test("site types come from the source lists; unlisted sites read Unclassified", () => {
  assert.equal(siteType("guitarworld.com"), "publication");
  assert.equal(siteType("reddit.com"), "community");
  assert.equal(siteType("guitarcenter.com"), "retailer");
  assert.equal(siteType("fender.com"), "brand_owned");
  assert.equal(siteType("example-shop.test"), "unclassified");
});

test("a source action needs 10% of shopping answers with sources in 2 of the last 3 runs", () => {
  const actions = sourceActions([run("r3", 3), run("r2", 0), run("r1", 2)]);
  assert.deepEqual(actions.map((a) => a.domain), ["guitarworld.com"]);
  const [gw] = actions;
  assert.equal(gw!.answers, 3);
  assert.equal(gw!.answersWithSources, 10);
  assert.equal(gw!.runsOver, 2);
  assert.equal(gw!.runsRead, 3);
  assert.match(gw!.fact, /^guitarworld\.com is cited in 30\.0% of shopping answers with sources \(3 of 10\), at 10% or more in 2 of the last 3 published runs\. Cited most in Electric/);
  assert.match(gw!.action, /buying guides/);
  assert.equal(gw!.pages.length, 3, "the cited pages open from the action");
  // reddit.com reaches 10% in one run only, so it has no action.
  assert.equal(sourceActions([run("a", 0), run("b", 0), run("c", 0)]).some((a) => a.domain === "guitarworld.com"), false);
  assert.equal(sourceActions([run("only", 5)]).length, 0, "one run read cannot meet 2 of 3");
  for (const action of actions) {
    assert.doesNotMatch(`${action.fact} ${action.action}`, /—|n't|will (raise|increase|improve)/);
  }
});

test("other signals: rival-led categories and fact-check contradictions come from the map read", () => {
  const ai = { phase: "ready" as const, snapshot: run("r", 0) };
  const signals = signalActions({ retail: { phase: "loading" }, ai, stock: { phase: "ready", rows: [], populationCount: 10 } });
  assert.deepEqual(signals, [], "no rival leads, no contradictions, no out-of-stock rows");
  const stock = signalActions({
    retail: { phase: "loading" },
    ai: { phase: "loading" },
    stock: { phase: "ready", rows: [{} as never, {} as never], populationCount: 8 },
  });
  assert.equal(stock[0]!.id, "signal:out_of_stock");
  assert.equal(stock[0]!.fact, "2 of 8 listings were out of stock at least one day in the last 12 months.");
});

test("the five findings keep their order; ecommerce signals follow; answer actions rank by share", () => {
  const plan = buildPlan({
    findings: LIVE,
    signals: [
      { id: "signal:fact_contradictions", group: "answers", label: "Contradictions", share: 0.05, numerator: 1, denominator: 20, fact: "f", action: "a", open: { spokeId: "aeo", tab: "Product Fact Checks" }, partial: null },
      { id: "signal:out_of_stock", group: "ecommerce", label: "Out of stock", share: 0.2, numerator: 2, denominator: 10, fact: "f", action: "a", open: { spokeId: "ecommerce", tab: "Out of Stock" }, partial: null },
    ],
    sources: sourceActions([run("r3", 3), run("r2", 2), run("r1", 0)]),
  });
  assert.deepEqual(plan.map((item) => item.id), [
    "finding:exact_official_product",
    "finding:map_leakage",
    "finding:splintered_bundles",
    "finding:buy_box",
    "finding:unbranded_discovery",
    "signal:out_of_stock",
    "source:guitarworld.com",
    "signal:fact_contradictions",
  ]);
  assert.deepEqual(plan.map((item) => item.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(phaseItems(plan, "days_1_30").map((item) => item.id), [
    "finding:map_leakage",
    "finding:splintered_bundles",
    "finding:buy_box",
    "signal:out_of_stock",
  ]);
  assert.deepEqual(phaseItems(plan, "days_31_60").map((item) => item.id), [
    "finding:exact_official_product",
    "signal:fact_contradictions",
  ]);
  assert.deepEqual(phaseItems(plan, "days_61_90").map((item) => item.id), ["source:guitarworld.com"]);
  assert.deepEqual(PLAN_PHASES.map((phase) => phase.label), ["Days 1 to 30", "Days 31 to 60", "Days 61 to 90"]);
  assert.equal(emptyPlanLine(plan), null);
});

test("N-04: an explicit empty state when nothing needs action", () => {
  const plan = buildPlan({ findings: ON_TRACK, signals: [], sources: [] });
  assert.equal(phaseItems(plan, "days_1_30").length, 0);
  assert.match(emptyPlanLine(plan)!, /^Nothing needs action now\./);
  const unread = buildPlan({ findings: [...ON_TRACK.slice(0, 4), finding("unbranded_discovery", "warning", null, null)], signals: [], sources: [] });
  assert.match(emptyPlanLine(unread)!, /1 of 5 readings are not stored/);
});

test("the Roadmap figure: findings that need action, of those with a stored reading", () => {
  const figure = planFindingsFigure(LIVE);
  assert.equal(figure.phase === "ready" && figure.value, "5 of 5");
  const partial = planFindingsFigure([...ON_TRACK.slice(0, 4), finding("unbranded_discovery", "warning", null, null)]);
  assert.equal(partial.phase === "ready" && partial.value, "0 of 4");
  assert.ok(partial.phase === "ready" && partial.partial, "a missing reading marks the figure partial");
  assert.equal(planFindingsFigure([{ ...LIVE[0]!, loading: true }]).phase, "loading");
});

test("the Roadmap bubble is static: 30-60-90, neutral, no figure, for every read state", () => {
  const face = roadmapBubbleFace();
  assert.deepEqual(face.heroValue, { value: "30-60-90", label: "" });
  assert.equal(face.status, "neutral");
  assert.equal(face.subTab, "30-60-90 Days");
  assert.equal(roadmapMetric().value, "30-60-90");
});

test("the Roadmap tab and bubble use the map population, the owner sentence, and no fixed plan", () => {
  const panel = read("components/v3/live/RoadmapFindingsPanel.tsx");
  const data = read("components/v3/live/RoadmapPlanData.ts");
  assert.match(panel, /IntoFocus's recommended plan for \$\{brandName\(\)\}/);
  assert.match(data, /useSummaryAiRead\(\)/);
  assert.doesNotMatch(data + panel, /useAiSearch\(\)/, "the Roadmap does not read the date-pill AI data");
  for (const file of ["components/v3/fender-static-nodes.ts", "components/v3/fender-metrics.ts", "lib/fender-canvas/nodes-from-live.ts", "lib/fender-canvas/metrics-from-live.ts"]) {
    assert.doesNotMatch(read(file), /"90 Days"|3 phases/, file);
  }
  const bubble = read("lib/fender-canvas/roadmap-bubble.ts");
  assert.match(bubble, /status: "neutral"/);
  for (const file of ["components/v3/live/roadmap-plan.css"]) {
    const css = read(file);
    for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 11, `${file} ${m[0]}`);
    for (const m of css.matchAll(/font-weight:\s*(\d+)/g)) assert.ok(Number(m[1]) <= 600, `${file} ${m[0]}`);
  }
});
