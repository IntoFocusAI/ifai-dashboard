// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/action-items-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ACTION_ITEMS_LEAD_LABEL,
  actionItemsLead,
  actionItemsLeadHtml,
} from "../lib/fender-canvas/action-items-lead.ts";
import {
  BRIEFING_COUNT_MISSING,
  type BriefingFinding,
  type BriefingFindingId,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import { urgentInterventionsHtml } from "../lib/fender-canvas/urgent-interventions-html.ts";

const root = new URL("..", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

function stored(
  id: BriefingFindingId,
  label: string,
  tone: BriefingFinding["tone"],
  numerator: number,
  denominator: number,
): BriefingFinding {
  return {
    id,
    spokeId: "ecommerce",
    tab: "Retail Overview",
    label,
    percent: `${((100 * numerator) / denominator).toFixed(1)}%`,
    ratio: `${numerator} of ${denominator}`,
    color: "var(--danger-red)",
    tone,
    pie: null,
    tip: null,
    explainer: "",
    numerator,
    denominator,
  };
}

function missing(id: BriefingFindingId, label: string): BriefingFinding {
  return {
    ...stored(id, label, "warning", 0, 1),
    percent: BRIEFING_COUNT_MISSING,
    ratio: null,
    numerator: null,
    denominator: null,
  };
}

const FIVE: BriefingFinding[] = [
  stored("buy_box", "Buy Box withheld", "danger", 57, 1108),
  stored("map_leakage", "MAP leakage", "danger", 143, 633),
  stored("splintered_bundles", "Splintered bundles", "danger", 75, 451),
  stored("exact_official_product", "Exact official product pages", "danger", 82, 1040),
  stored("unbranded_discovery", "Unbranded discovery", "warning", 1064, 1788),
];

test("lead counts critical findings as N of M with a percentage and a status disc", () => {
  const lead = actionItemsLead(FIVE);
  assert.equal(lead.label, ACTION_ITEMS_LEAD_LABEL);
  assert.equal(lead.percent, "80.0%");
  assert.equal(lead.ratio, "4 of 5");
  assert.equal(lead.numerator, 4);
  assert.equal(lead.denominator, 5);
  assert.equal(lead.figureTip, null);
  assert.equal(lead.color, "var(--danger-red)");
  assert.deepEqual(
    lead.pie?.slices.map((slice) => [slice.label, slice.count]),
    [
      ["Critical", 4],
      ["At risk", 1],
    ],
  );
  assert.equal(lead.pie?.total, 5);
  assert.match(lead.tip ?? "", /4 critical: Buy Box withheld, MAP leakage, Splintered bundles, and Exact official product pages\./);
  assert.match(lead.tip ?? "", /1 at risk: Unbranded discovery\./);
});

test("a finding without a stored reading leaves the count and marks the ratio with an asterisk", () => {
  const lead = actionItemsLead([...FIVE.slice(0, 4), missing("unbranded_discovery", "Unbranded discovery")]);
  assert.equal(lead.percent, "100.0%");
  assert.equal(lead.ratio, "4 of 4*");
  assert.equal(lead.missing, 1);
  assert.match(lead.figureTip ?? "", /1 of 5 current findings have no stored reading/);
});

test("no stored reading shows Not available* with no disc", () => {
  const lead = actionItemsLead(FIVE.map((f) => missing(f.id, f.label)));
  assert.equal(lead.percent, BRIEFING_COUNT_MISSING);
  assert.equal(lead.ratio, null);
  assert.equal(lead.pie, null);
  assert.ok(lead.figureTip);
});

test("no critical finding colors the lead by the worst remaining tone", () => {
  const calm = FIVE.map((f) => ({ ...f, tone: "success" as const }));
  assert.equal(actionItemsLead(calm).color, "var(--success-green)");
  assert.equal(actionItemsLead(calm).percent, "0.0%");
  const amber = [{ ...FIVE[0]!, tone: "warning" as const }, ...calm.slice(1)];
  assert.equal(actionItemsLead(amber).color, "var(--warning-amber)");
});

test("lead HTML matches ShareHeroCard: defined label, figure, N of M, disc, custom tooltips only", () => {
  const html = actionItemsLeadHtml(actionItemsLead(FIVE));
  assert.match(html, /class="content-box findability-lead-card" data-action-items-lead="critical_findings"/);
  assert.match(html, /class="ifai-term" data-ifai-tooltip-title="Critical findings" data-ifai-tooltip-desc="A current finding is critical/);
  assert.match(html, /data-hero-percent=""[^>]*>80\.0%</);
  assert.match(html, /data-hero-ratio="">4 of 5</);
  assert.match(html, /citation-pie-disc citation-pie-disc-retail[^"]*" style="background: conic-gradient\(#ef4444 0deg 288deg, #fbbf24 288deg 360deg\);"/);
  assert.ok(html.indexOf("data-hero-percent") < html.indexOf("metric-card-sub"));
  assert.doesNotMatch(html, /\stitle=/);
  assert.doesNotMatch(html, /\$|\bfees?\b|retainer|owner|DIY|Done-with-You|Done-for-You/i);
  assert.doesNotMatch(html, /\u2014/);
});

test("Urgent Interventions opens on the lead, then cards that lead with their figure", () => {
  const html = urgentInterventionsHtml({ phase: "loading" }, { phase: "loading" }, { phase: "loading" });
  const leadAt = html.indexOf("data-action-items-lead=");
  const firstCard = html.indexOf("data-urgent-finding=");
  assert.ok(leadAt >= 0 && leadAt < firstCard);
  assert.equal((html.match(/data-urgent-finding-percent=/g) ?? []).length, 5);
  assert.equal((html.match(/data-urgent-finding-action=/g) ?? []).length, 5);
});

test("Current findings renders the lead ahead of the five cards; Summary Briefing does not", () => {
  const panel = read("components/v3/live/CurrentFindingsPanel.tsx");
  assert.ok(panel.indexOf("<ActionItemsLead") >= 0);
  assert.ok(panel.indexOf("<ActionItemsLead") < panel.indexOf("data-current-findings="));
  const lead = read("components/v3/live/ActionItemsLead.tsx");
  assert.match(lead, /<ShareHeroCard/);
  assert.doesNotMatch(lead, /\stitle=/);
  for (const summary of [
    "components/v3/live/BriefingRetailHero.tsx",
    "components/v3/live/BriefingFindingCard.tsx",
    "components/v3/live/RoadmapFindingsPanel.tsx",
  ]) {
    assert.doesNotMatch(read(summary), /ActionItemsLead|actionItemsLead/, summary);
  }
});
