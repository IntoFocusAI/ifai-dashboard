// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/roadmap-findings-tab.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BRIEFING_COUNT_MISSING,
  briefingFindingsLead,
  type BriefingFinding,
  type BriefingFindingId,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import {
  buildRoadmapPlan,
  findingHasStoredReading,
  ROADMAP_OWNER_SENTENCE,
  roadmapPhaseForFinding,
  type RoadmapPhaseId,
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

const FINDING_IDS = [
  "buy_box",
  "map_leakage",
  "splintered_bundles",
  "exact_official_product",
  "unbranded_discovery",
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

function unread(id: BriefingFindingId, label: string): BriefingFinding {
  return finding({
    id,
    label,
    tone: "warning",
    percent: BRIEFING_COUNT_MISSING,
    ratio: null,
    numerator: null,
    denominator: null,
    explainer: `${label} reading not stored.`,
  });
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
  assert.doesNotMatch(panel, /BriefingFindingCard/);
  assert.doesNotMatch(panel, /data-ifai-open|data-ifai-tab/);
  assert.doesNotMatch(panel, /home screen|Open details|Phase 1|since last time|what changed/i);
  assert.doesNotMatch(panel, /lostRevenue|LostRevenue|BRIEFING_LOST_REVENUE|\$680|\$38M/i);
  assert.doesNotMatch(panel, /fee|retainer|IntoFocus/i);
  assert.doesNotMatch(panel, /\u2014/);
  assert.doesNotMatch(panel, /\stitle=/);
  assert.match(plan, /Days 1 to 30/);
  assert.match(plan, /Days 31 to 60/);
  assert.match(plan, /Days 61 to 90/);
  assert.equal(
    ROADMAP_OWNER_SENTENCE,
    "Shared plan. The activity follows the current findings. It does not set a new owner.",
  );
  assert.doesNotMatch(plan, /Phase 1|\$680|\$38M|fee|retainer|IntoFocus/i);
  assert.doesNotMatch(plan, /\u2014/);
  for (const label of FINDING_LABELS) {
    assert.match(read("lib/fender-canvas/briefing-retail-lead.ts"), new RegExp(label));
  }
  assert.ok(panel.split("\n").length <= 400, "RoadmapFindingsPanel stays at or under 400 lines");
});

test("the plan dates three 30-day windows from the day the page is opened", () => {
  const opened = new Date(2026, 10, 5);
  const plan = buildRoadmapPlan([], opened);
  assert.deepEqual(
    plan.map((phase) => phase.id),
    ["days-1-30", "days-31-60", "days-61-90"],
  );
  assert.deepEqual(
    plan.map((phase) => phase.label),
    ["Days 1 to 30", "Days 31 to 60", "Days 61 to 90"],
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

test("danger and unread findings lead, warning follows, success closes the plan", () => {
  const rows = [
    finding({ id: "buy_box", label: "Buy Box withheld", tone: "danger", percent: "40.0%", ratio: "8 of 20", numerator: 8, denominator: 20 }),
    finding({ id: "map_leakage", label: "MAP leakage", tone: "warning", percent: "15.0%", ratio: "3 of 20", numerator: 3, denominator: 20 }),
    unread("splintered_bundles", "Splintered bundles"),
    finding({ id: "exact_official_product", label: "Exact official product pages", tone: "success", percent: "80.0%", ratio: "16 of 20", numerator: 16, denominator: 20 }),
    finding({
      id: "unbranded_discovery",
      label: "Unbranded discovery",
      tone: "success",
      percent: BRIEFING_COUNT_MISSING,
      ratio: null,
      numerator: null,
      denominator: null,
    }),
  ];

  assert.equal(roadmapPhaseForFinding(rows[0]!), "days-1-30");
  assert.equal(roadmapPhaseForFinding(rows[1]!), "days-31-60");
  assert.equal(findingHasStoredReading(rows[2]!), false);
  assert.equal(roadmapPhaseForFinding(rows[2]!), "days-1-30");
  assert.equal(roadmapPhaseForFinding(rows[3]!), "days-61-90");
  assert.equal(roadmapPhaseForFinding(rows[4]!), "days-1-30");

  const plan = buildRoadmapPlan(rows, new Date(2026, 10, 5));
  const placed = Object.fromEntries(plan.map((phase) => [phase.id, phase.findings.map((item) => item.id)])) as Record<
    RoadmapPhaseId,
    string[]
  >;
  assert.deepEqual(placed["days-1-30"], ["buy_box", "splintered_bundles", "unbranded_discovery"]);
  assert.deepEqual(placed["days-31-60"], ["map_leakage"]);
  assert.deepEqual(placed["days-61-90"], ["exact_official_product"]);
  assert.equal(plan.flatMap((phase) => phase.findings).length, rows.length);
  assert.equal(plan[0]!.findings[0]!.percent, "40.0%");
  assert.equal(plan[0]!.findings[0]!.ratio, "8 of 20");
  assert.equal(plan[1]!.findings[0]!.explainer, "MAP leakage explainer.");
  assert.doesNotMatch(JSON.stringify(plan.map((phase) => phase.rangeLabel)), /\$|Phase 1/);
});

test("unread briefing findings all sit in the first 30 days and keep their labels", () => {
  const lead = briefingFindingsLead({ phase: "loading" }, { phase: "loading" }, { phase: "loading" });
  assert.deepEqual(
    lead.findings.map((item) => item.label),
    [...FINDING_LABELS],
  );
  assert.deepEqual(
    lead.findings.map((item) => item.id),
    [...FINDING_IDS],
  );
  const plan = buildRoadmapPlan(lead.findings, new Date(2026, 0, 15));
  assert.deepEqual(
    plan[0]!.findings.map((item) => item.id),
    [...FINDING_IDS],
  );
  assert.equal(plan[1]!.findings.length, 0);
  assert.equal(plan[2]!.findings.length, 0);
  for (const item of lead.findings) {
    assert.equal(item.percent, BRIEFING_COUNT_MISSING);
    assert.equal(item.ratio, null);
    assert.equal(findingHasStoredReading(item), false);
  }
  assert.equal(plan[0]!.rangeLabel, "Jan 15, 2026 to Feb 13, 2026");
});

test("Action Items has no Current findings tab, and Summary Briefing stays wired as before", () => {
  assert.deepEqual(spec.spokes.suggestions.tabs, ["Urgent Interventions", "Revenue Estimates"]);
  const hero = read("components/v3/live/BriefingRetailHero.tsx");
  assert.match(hero, /briefingFindingsLead/);
});
