// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/action-items-tabs.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { tabIndexFromSlug } from "../lib/canvas-sdk/canvas-url-state.ts";

const root = new URL("..", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

const spec = JSON.parse(read("data/fender-v3-spec.json")) as {
  spokes: {
    suggestions: { tabs: string[]; tabTemplates: string[] };
  };
};

test("Action Items has two tabs: the fix list and Revenue Estimates", () => {
  const tabs = spec.spokes.suggestions.tabs;
  assert.deepEqual(tabs, ["Urgent Interventions", "Revenue Estimates"]);
  assert.equal(spec.spokes.suggestions.tabTemplates.length, tabs.length);
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

test("an old Current findings link lands on Urgent Interventions, and nothing links to it", () => {
  const tabs = spec.spokes.suggestions.tabs;
  assert.equal(tabs[tabIndexFromSlug(tabs, "current-findings")], "Urgent Interventions");
  assert.equal(tabs[tabIndexFromSlug(tabs, "Current-Findings")], "Urgent Interventions");
  assert.equal(tabs[tabIndexFromSlug(tabs, "revenue-estimates")], "Revenue Estimates");

  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.doesNotMatch(spokes, /CurrentFindingsPanel/);
  const sources = [
    "components/v3/fender-metrics.ts",
    "lib/fender-canvas/metrics-from-live.ts",
    "lib/fender-canvas/minimal-metrics-summary.ts",
    "lib/fender-canvas/hub-slots.ts",
    "lib/fender-canvas/build-canvas-spec.tsx",
    "lib/fender-canvas/nodes-from-live.ts",
    "lib/fender-canvas/tour-from-live.ts",
  ];
  for (const source of sources) {
    assert.doesNotMatch(read(source), /Current findings|current-findings/, source);
  }
  assert.doesNotMatch(JSON.stringify(spec.spokes.suggestions), /Current findings/);
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
