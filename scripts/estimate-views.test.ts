// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimate-views.test.ts
//
// H-09 (decision 105, 110, 112): Briefing, Opportunity and Revenue Estimates are generated for
// every client from its settings and data. Replaces the tests of the retired hand-written method
// table (estimate-lines, estimate-method).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getClientSettings } from "../lib/client/active-client.ts";
import { estimateEnterprise } from "../lib/estimates/enterprise.ts";
import { buildClientEstimates, joinEstimateListings, type ClientEstimatesRead } from "../lib/estimates/live-inputs.ts";
import {
  enterprisePotentialEstimate,
  ESTIMATE_LOADING,
  NO_ANALYST_ESTIMATE,
  phaseOneLiftEstimate,
} from "../lib/fender-canvas/analyst-estimates.ts";
import { loadEstimatesFixture } from "./fixtures/estimates/load.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const spec = JSON.parse(read("data/canvas-narrative.json"));

function near(actual: number | null | undefined, expected: number, tolerance: number, label: string): void {
  assert.ok(typeof actual === "number", `${label} is missing`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
}

function measured(client: "fender" | "ledlenser") {
  const fx = loadEstimatesFixture(client);
  return buildClientEstimates(fx.listings, { rankCategory: fx.rankCategory, dataAsOf: fx.readOn, salesSources: "measured_only", revenue: getClientSettings(client).revenue_inputs });
}

test("no per-client hand-written Briefing: the narrative template names no brand", () => {
  const raw = read("data/canvas-narrative.json");
  assert.equal(/Fender|fender\.com|Squier|FMIC|Ledlenser/.test(raw), false);
  assert.equal(/Fender|fender\.com|Squier|Ledlenser/.test(read("data/canvas-tour.json")), false);
  assert.deepEqual(spec.spokes.hub.tabs, ["Briefing", "Performance", "Opportunity"]);
  assert.deepEqual(spec.spokes.hub.tabTemplates, ["", "", ""]);
  assert.equal(spec.spokes.suggestions.tabs[1], "Revenue Estimates");
  assert.equal(spec.spokes.suggestions.tabTemplates[1], "");
  assert.equal(/Portfolio at a glance|\+\$680K|\$38M|\$50M midpoint/.test(raw), false);
});

test("Briefing, Opportunity and Revenue Estimates are the same components for every client", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.match(spokes, /<BriefingRetailHero bundle=\{bundle\} read=\{retail\} \/>\s*<BriefingAiLead bundle=\{bundle\} \/>/);
  assert.match(spokes, /2: \(bundle\) => <OpportunityEstimates read=\{bundle\.estimates\} \/>/);
  assert.match(spokes, /1: \(bundle\) => <OpportunityEstimates read=\{bundle\.estimates\} \/>/);
  assert.equal(/clientNarrative|HUB_BRIEFING_HTML/.test(spokes), false);
  const narrative = read("lib/fender-canvas/spoke-narrative.ts");
  assert.equal(/key === |isFenderClient|fender-v3-spec/.test(narrative), false);
});

test("the Briefing's first hero card is named AI Consensus Score", () => {
  const hero = read("components/v3/live/BriefingRetailHero.tsx");
  const first = hero.indexOf("<BriefingConsensusLead");
  assert.ok(first > 0 && first < hero.indexOf("<BriefingFindingCard"));
  assert.match(read("components/v3/live/BriefingConsensusLead.tsx"), />\s*AI Consensus Score\s*</);
});

test("Opportunity shows Phase 1, Enterprise and MAP beside, then each line, each opening its trail", () => {
  const src = read("components/v3/live/estimates/OpportunityEstimates.tsx");
  const order = ["Phase 1 Quick-Win Lift", "Full Enterprise Potential", "MAP Leakage", "How we arrived at these estimates"].map((s) => src.indexOf(s));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), `order ${order}`);
  assert.match(src, /EstimateTrailTrigger result=\{result\}/);
  assert.match(src, /notPreparedTip\(\)/);
  assert.equal(/retainer|service fee|fee multiple/i.test(src), false);
});

test("the short figures read Loading, the Phase 1 mid, or Not available*", () => {
  assert.equal(phaseOneLiftEstimate(null), ESTIMATE_LOADING);
  assert.equal(phaseOneLiftEstimate({ estimates: { phase: "loading" } }), ESTIMATE_LOADING);
  assert.equal(phaseOneLiftEstimate({ estimates: { phase: "error", message: "x" } }), NO_ANALYST_ESTIMATE);
  const est = measured("fender");
  const ready: ClientEstimatesRead = { phase: "ready", estimates: est };
  assert.match(phaseOneLiftEstimate({ estimates: ready }), /^\+\$1\.05M\*? est\.$/);
  assert.match(enterprisePotentialEstimate({ estimates: ready }), /^\+\$8\.\d{1,2}M\*? est\.$/);
});

test("Enterprise Potential, listing-fix part, reproduces the proposal's section 5 on the public placeholders", () => {
  const fender = measured("fender").enterprise;
  near(fender.range?.low, 2.0e6, 0.05e6, "Fender low");
  near(fender.range?.mid, 8.7e6, 0.05e6, "Fender mid");
  near(fender.range?.high, 24.7e6, 0.1e6, "Fender high");
  const ledlenser = measured("ledlenser").enterprise;
  near(ledlenser.range?.low, 0.5e6, 0.05e6, "Ledlenser low");
  near(ledlenser.range?.mid, 1.8e6, 0.05e6, "Ledlenser mid");
  near(ledlenser.range?.high, 4.9e6, 0.1e6, "Ledlenser high");
  for (const e of [fender, ledlenser]) {
    assert.equal(e.countsInTotal, false);
    assert.equal(e.label, "analyst estimate");
    assert.equal(e.trail.confidence, "low");
    assert.ok(e.trail.inputs.some((i) => i.key === "brand_revenue" && /placeholder/.test(i.label)));
    assert.ok(e.trail.sources.some((s) => s.id === "brand_revenue" && s.url));
  }
});

test("Enterprise Potential reads Not available* when the client has no revenue figure", () => {
  const est = measured("ledlenser");
  const none = estimateEnterprise(est.phase1, est.catalog, null);
  assert.equal(none.status, "not_available");
  assert.equal(none.range, null);
});

test("public revenue placeholders live in settings, not code", () => {
  const fender = getClientSettings("fender").revenue_inputs!;
  const ledlenser = getClientSettings("ledlenser").revenue_inputs!;
  assert.equal(fender.annual_sales_usd, 1e9);
  assert.equal(ledlenser.annual_sales_usd, 75e6);
  assert.equal(fender.basis, "public_placeholder");
  assert.equal(ledlenser.basis, "public_placeholder");
  assert.equal(/1000000000|75000000|1e9|75e6/.test(read("lib/estimates/enterprise.ts")), false);
});

test("the shared read joins the four views for every client the same way", () => {
  const fx = loadEstimatesFixture("ledlenser");
  const joined = joinEstimateListings({ sales: [], retail: [], spec: [], content: [] }, fx.rankCategory);
  assert.equal(joined.length, 0);
});

test("client copy does not discuss IntoFocus fees or retainers", () => {
  const raw = read("data/canvas-narrative.json") + read("components/v3/live/estimates/OpportunityEstimates.tsx") + read("components/v3/live/BriefingAiLead.tsx");
  for (const word of [/retainer/i, /\$20,000\/month/, /\$240,000/, /20K\/mo/, /208x/, /Service Fee/i]) assert.equal(word.test(raw), false, String(word));
});

test("Urgent Interventions lists findings via urgent_interventions, not example action cards", () => {
  const template = spec.spokes.suggestions.tabTemplates[0] as string;
  assert.match(template, /\{urgent_interventions\}/);
  assert.equal(/Austin Bazaar|Bundle MAP|comparison matrix|buy button/i.test(template), false);
});
