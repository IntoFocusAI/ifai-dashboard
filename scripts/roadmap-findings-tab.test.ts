// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/roadmap-findings-tab.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("..", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

const spec = JSON.parse(read("data/fender-v3-spec.json")) as {
  spokes: {
    roadmap: { tabs: string[]; tabTemplates: string[] };
    suggestions: { tabs: string[] };
  };
};

test("Roadmap first tab no longer ships the example 30-60-90 phase cards", () => {
  const tabs = spec.spokes.roadmap.tabs;
  // The KPI and resourcing tabs had no content, so they are gone rather than blank.
  assert.deepEqual(tabs, ["30-60-90 Days"]);

  const body = spec.spokes.roadmap.tabTemplates[0] ?? "";
  assert.equal(body.trim(), "");
  assert.doesNotMatch(body, /Phase 1|Phase 2|Phase 3|Open details|Days 1 to 30|30-60-90 Days/i);
  assert.doesNotMatch(body, /since last time|what changed|\$680|\$38M/i);
  assert.equal(spec.spokes.roadmap.tabTemplates.length, 1);
  assert.doesNotMatch(JSON.stringify(spec), /Executive KPI Target Matrix|Flexible Resourcing/);
});

test("Roadmap 30-60-90 Days renders the shared plan in three dated phases (S-02, S-04)", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const panel = read("components/v3/live/RoadmapFindingsPanel.tsx");
  const data = read("components/v3/live/RoadmapPlanData.ts");
  assert.match(spokes, /roadmap:\s*\{[\s\S]*0:\s*\([^)]*\)\s*=>\s*<RoadmapFindingsPanel/);
  assert.match(data, /briefingFindingsLead/);
  assert.match(panel, /useRoadmapPlan\(read\)/);
  assert.match(panel, /PLAN_PHASES\.map/);
  assert.match(panel, /IntoFocus's recommended plan for/);
  assert.doesNotMatch(panel, /Open details|since last time|what changed/i);
  assert.doesNotMatch(panel + data, /lostRevenue|LostRevenue|BRIEFING_LOST_REVENUE|\$680|\$38M|fee|retainer/i);
  assert.doesNotMatch(panel, /\u2014/);
  for (const label of [
    "Buy Box withheld",
    "MAP leakage",
    "Splintered Listings",
    "Exact official product pages",
    "Unbranded Discovery",
  ]) {
    assert.match(read("lib/fender-canvas/briefing-retail-lead.ts"), new RegExp(label));
  }
});

test("Action Items has no Current findings tab, and Summary Briefing stays wired as before", () => {
  assert.deepEqual(spec.spokes.suggestions.tabs, ["Urgent Interventions", "Revenue Estimates"]);
  const hero = read("components/v3/live/BriefingRetailHero.tsx");
  assert.match(hero, /briefingFindingsLead/);
});
