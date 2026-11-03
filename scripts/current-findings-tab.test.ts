// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/current-findings-tab.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("..", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

const spec = JSON.parse(read("data/fender-v3-spec.json")) as {
  spokes: {
    suggestions: { tabs: string[]; tabTemplates: string[] };
  };
};

test("Action Items replaces Interactive ROI with Current findings", () => {
  const tabs = spec.spokes.suggestions.tabs;
  assert.deepEqual(tabs, ["Urgent Interventions", "Revenue Estimates", "Current findings"]);
  assert.equal(tabs.some((tab) => /Interactive ROI/i.test(tab)), false);

  const joined = JSON.stringify(spec.spokes.suggestions);
  assert.equal(/Interactive ROI/i.test(joined), false);
  assert.equal(joined.includes("roi-mode-control"), false);
  assert.equal(joined.includes("toggleRoiMode"), false);
  assert.equal(joined.includes("segmented-btn"), false);

  const revenue = spec.spokes.suggestions.tabTemplates[1] ?? "";
  assert.match(revenue, /\{phase_one_lift\}/);
  assert.match(revenue, /\{enterprise_potential\}/);
  assert.match(revenue, /\$50M midpoint/);
  assert.doesNotMatch(revenue, /Monthly potential lost brand revenue|since last time|what changed/i);
});

test("Current findings reuses briefingFindingsLead and omits the lost-revenue placeholder", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const panel = read("components/v3/live/CurrentFindingsPanel.tsx");
  assert.match(spokes, /CurrentFindingsPanel/);
  assert.match(spokes, /suggestions:\s*\{[\s\S]*2:\s*\([^)]*\)\s*=>\s*<CurrentFindingsPanel/);
  assert.match(panel, /briefingFindingsLead/);
  assert.match(panel, /BriefingFindingCard/);
  assert.match(panel, /Current findings/);
  assert.doesNotMatch(panel, /lostRevenue|LostRevenue|BRIEFING_LOST_REVENUE|since last time|what changed/i);
  assert.doesNotMatch(panel, /\u2014/);
  for (const label of [
    "Buy Box withheld",
    "MAP leakage",
    "Splintered bundles",
    "Exact official product pages",
    "Unbranded discovery",
  ]) {
    assert.match(read("lib/fender-canvas/briefing-retail-lead.ts"), new RegExp(label));
  }
});

test("links that opened Interactive ROI now open Revenue Estimates", () => {
  const metrics = read("components/v3/fender-metrics.ts");
  const live = read("lib/fender-canvas/metrics-from-live.ts");
  const slots = read("lib/fender-canvas/hub-slots.ts");
  const canvas = read("lib/fender-canvas/build-canvas-spec.tsx");
  const destinations = read("scripts/metric-widget-destinations.test.ts");

  for (const source of [metrics, live, slots]) {
    assert.doesNotMatch(source, /Interactive ROI Model/);
    assert.match(source, /subTab:\s*"Revenue Estimates"/);
  }
  assert.match(canvas, /subTab:\s*"Revenue Estimates"/);
  assert.doesNotMatch(canvas, /subTab:\s*"roi"/);
  assert.match(destinations, /"phase-one-lift": "Revenue Estimates"/);
  assert.match(destinations, /"enterprise-potential": "Revenue Estimates"/);
  assert.doesNotMatch(destinations, /"phase-one-lift": "Interactive ROI Model"/);
});
