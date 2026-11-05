// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/roadmap-findings-tab.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BRIEFING_COUNT_MISSING,
  briefingFindingsLead,
  type BriefingFinding,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import {
  buildRoadmapPlan,
  ROADMAP_ACTIONS,
  ROADMAP_OWNER_SENTENCE,
} from "../lib/fender-canvas/roadmap-plan.ts";

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

const FINDING_LABELS = [
  "Buy Box withheld",
  "MAP leakage",
  "Splintered bundles",
  "Exact official product pages",
  "Unbranded discovery",
] as const;

function finding(
  partial: Partial<BriefingFinding> & Pick<BriefingFinding, "id" | "label" | "tone">,
): BriefingFinding {
  return {
    spokeId: "ecommerce",
    tab: "MAP",
    percent: "12.5%",
    ratio: "4 of 32",
    color: "var(--danger-red)",
    pie: null,
    tip: null,
    explainer: `${partial.label} explainer.`,
    numerator: 4,
    denominator: 32,
    ...partial,
  };
}

function inclusiveDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return (endUtc - startUtc) / 86400000 + 1;
}

test("Strategy Roadmap first tab no longer ships the example 30-60-90 phase cards", () => {
  const tabs = spec.spokes.roadmap.tabs;
  // The KPI and resourcing tabs had no content, so they are gone rather than blank.
  assert.deepEqual(tabs, ["30-60-90 Day Milestones"]);

  const body = spec.spokes.roadmap.tabTemplates[0] ?? "";
  assert.equal(body.trim(), "");
  assert.doesNotMatch(body, /Phase 1|Phase 2|Phase 3|Open details|Days 1 to 30|30-60-90 Day Milestones/i);
  assert.doesNotMatch(body, /since last time|what changed|\$680|\$38M/i);
  assert.equal(spec.spokes.roadmap.tabTemplates.length, 1);
  assert.doesNotMatch(JSON.stringify(spec), /Executive KPI Target Matrix|Flexible Resourcing/);
});

test("Roadmap first tab renders a dated plan from briefingFindingsLead", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const panel = read("components/v3/live/RoadmapFindingsPanel.tsx");
  const plan = read("lib/fender-canvas/roadmap-plan.ts");
  assert.match(spokes, /RoadmapFindingsPanel/);
  assert.match(spokes, /roadmap:\s*\{[\s\S]*0:\s*\([^)]*\)\s*=>\s*<RoadmapFindingsPanel/);
  assert.match(panel, /briefingFindingsLead/);
  assert.match(panel, /buildRoadmapPlan/);
  assert.match(panel, /ROADMAP_OWNER_SENTENCE/);
  assert.match(panel, /data-roadmap-action/);
  assert.match(panel, /align-items:\s*flex-start/);
  assert.match(panel, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(panel, /BriefingFindingCard|CitationPieDisc|retail-finding|retail-overview-hero/);
  assert.doesNotMatch(panel, /data-ifai-open|data-ifai-tab/);
  assert.doesNotMatch(panel, /home screen|Open details|Phase 1|since last time|what changed/i);
  assert.doesNotMatch(panel, /lostRevenue|LostRevenue|BRIEFING_LOST_REVENUE|\$680|\$38M/i);
  assert.doesNotMatch(panel, /fee|retainer|IntoFocus/i);
  assert.doesNotMatch(panel, /\u2014/);
  assert.doesNotMatch(panel, /\stitle=/);
  const ownerAt = panel.lastIndexOf("{ROADMAP_OWNER_SENTENCE}");
  const planAt = panel.indexOf("data-roadmap-plan");
  assert.ok(planAt > 0 && ownerAt > planAt, "the owner sentence sits under the phases");
  assert.match(plan, /Days 1 to 30/);
  assert.match(plan, /Days 31 to 60/);
  assert.match(plan, /Days 61 to 90/);
  assert.equal(
    ROADMAP_OWNER_SENTENCE,
    "Shared plan. The activity follows the current findings. It does not set a new owner.",
  );
  assert.deepEqual(ROADMAP_ACTIONS, {
    buy_box: "Correct each offer so a shopper can add the product to the cart.",
    map_leakage: "Raise advertised prices back to the agreed floor.",
    splintered_bundles: "Nest each bundle under its official parent listing.",
    exact_official_product: "Publish one fender.com page for each exact product that lacks one.",
    unbranded_discovery:
      "Confirm assistants name Fender when the shopper does not. That result moves when the offers, prices, bundles, and exact pages are fixed.",
  });
  assert.doesNotMatch(plan, /Phase 1|\$680|\$38M|fee|retainer|IntoFocus/i);
  assert.doesNotMatch(plan, /\u2014/);
  assert.doesNotMatch(plan, /tone === "danger"|findingHasStoredReading/);
  for (const label of FINDING_LABELS) {
    assert.match(read("lib/fender-canvas/briefing-retail-lead.ts"), new RegExp(label));
  }
  assert.ok(panel.split("\n").length <= 400, "RoadmapFindingsPanel stays at or under 400 lines");
});

test("the plan dates three 30-day windows from the day the page is opened", () => {
  const opened = new Date(2026, 10, 5);
  const plan = buildRoadmapPlan([], opened);
  assert.deepEqual(
    plan.map((phase) => phase.heading),
    ["Days 1 to 30, the offer", "Days 31 to 60, the catalog", "Days 61 to 90, the AI result"],
  );
  assert.deepEqual(
    plan.map((phase) => phase.rangeLabel),
    ["Nov 5, 2026 to Dec 4, 2026", "Dec 5, 2026 to Jan 3, 2027", "Jan 4, 2027 to Feb 2, 2027"],
  );
  for (const phase of plan) assert.equal(inclusiveDays(phase.start, phase.end), 30);
  assert.equal(inclusiveDays(plan[0]!.end, plan[1]!.start), 2);
  assert.equal(inclusiveDays(plan[1]!.end, plan[2]!.start), 2);

  const leap = buildRoadmapPlan([], new Date(2024, 1, 1));
  assert.equal(leap[0]!.rangeLabel, "Feb 1, 2024 to Mar 1, 2024");
  assert.equal(inclusiveDays(leap[0]!.start, leap[0]!.end), 30);
});

test("findings keep their phase and sentence when the figure is Not available*", () => {
  const unread = briefingFindingsLead({ phase: "loading" }, { phase: "loading" }, { phase: "loading" });
  const plan = buildRoadmapPlan(unread.findings, new Date(2026, 0, 15));
  assert.deepEqual(
    plan.map((phase) => phase.steps.map((step) => step.finding.id)),
    [
      ["buy_box", "map_leakage"],
      ["splintered_bundles", "exact_official_product"],
      ["unbranded_discovery"],
    ],
  );
  assert.equal(plan[0]!.rangeLabel, "Jan 15, 2026 to Feb 13, 2026");
  for (const step of plan.flatMap((phase) => phase.steps)) {
    assert.equal(step.finding.percent, BRIEFING_COUNT_MISSING);
    assert.equal(step.finding.ratio, null);
    assert.equal(step.action, ROADMAP_ACTIONS[step.finding.id]);
    assert.doesNotMatch(step.action, /\d|Not available/);
  }

  const mixed = buildRoadmapPlan(
    [
      finding({ id: "unbranded_discovery", label: "Unbranded discovery", tone: "danger", percent: "10.0%", ratio: "1 of 10", numerator: 1, denominator: 10 }),
      finding({ id: "buy_box", label: "Buy Box withheld", tone: "success", percent: "0.0%", ratio: "0 of 20", numerator: 0, denominator: 20 }),
      finding({ id: "exact_official_product", label: "Exact official product pages", tone: "danger", percent: BRIEFING_COUNT_MISSING, ratio: null, numerator: null, denominator: null }),
      finding({ id: "map_leakage", label: "MAP leakage", tone: "warning", percent: "15.0%", ratio: "3 of 20", numerator: 3, denominator: 20 }),
      finding({ id: "splintered_bundles", label: "Splintered bundles", tone: "success", percent: "4.0%", ratio: "1 of 25", numerator: 1, denominator: 25 }),
    ],
    new Date(2026, 10, 5),
  );
  assert.deepEqual(
    mixed.map((phase) => phase.steps.map((step) => [step.finding.id, step.finding.percent, step.action])),
    [
      [
        ["buy_box", "0.0%", ROADMAP_ACTIONS.buy_box],
        ["map_leakage", "15.0%", ROADMAP_ACTIONS.map_leakage],
      ],
      [
        ["splintered_bundles", "4.0%", ROADMAP_ACTIONS.splintered_bundles],
        ["exact_official_product", BRIEFING_COUNT_MISSING, ROADMAP_ACTIONS.exact_official_product],
      ],
      [["unbranded_discovery", "10.0%", ROADMAP_ACTIONS.unbranded_discovery]],
    ],
  );
});

test("Action Items has no Current findings tab, and Summary Briefing stays wired as before", () => {
  assert.deepEqual(spec.spokes.suggestions.tabs, ["Urgent Interventions", "Revenue Estimates"]);
  const hero = read("components/v3/live/BriefingRetailHero.tsx");
  assert.match(hero, /briefingFindingsLead/);
});
