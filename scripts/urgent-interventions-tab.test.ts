// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/urgent-interventions-tab.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BRIEFING_COUNT_MISSING,
  briefingFindingsLead,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import { buildPlan } from "../lib/fender-canvas/roadmap-plan.ts";
import { findingAction } from "../lib/fender-canvas/urgent-interventions-rows.ts";
import { bindCopy } from "../lib/fender-canvas/template-vars.ts";

const root = new URL("..", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

const FINDING_LABELS = [
  "Buy Box withheld",
  "MAP leakage",
  "Splintered Listings",
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

const STORED_ACTIONS = [
  "These listings have no one-click offer. Correct each offer so a shopper can add the product to the cart.",
  "These offers are advertised below the lowest price a partner agreed to show. Raise those prices back to that floor.",
  "These bundles are their own listings, so their reviews stay split. Nest each bundle under the official parent listing so the reviews sit on one page.",
  "Publish one fender.com page for each exact product that does not have one. A page for the whole line covers more than one model, so an assistant can attach the wrong specs.",
  "When someone asks what to buy without naming Fender, assistants name Fender this often. Fix the withheld offers, the prices under the floor, the split bundles, and the missing exact pages, which are what an assistant can repeat.",
] as const;

const MISSING_ACTIONS = [
  "The Buy Box reading is not stored.",
  "The MAP reading is not stored.",
  "The catalog reading is not stored.",
  "The official-page reading is not stored.",
  "The AI Search reading is not stored.",
] as const;

test("Urgent Interventions template drops spoke-template example cards", () => {
  const spec = JSON.parse(read("data/fender-v3-spec.json")) as {
    spokes: { suggestions: { tabs: string[]; tabTemplates: string[] } };
  };
  assert.equal(spec.spokes.suggestions.tabs[0], "Urgent Interventions");
  const template = spec.spokes.suggestions.tabTemplates[0] ?? "";
  assert.match(template, /\{urgent_interventions\}/);
  assert.doesNotMatch(template, /Austin Bazaar|GearTree|A\+|comparison matrix|tabular spec|Bundle MAP|ai_action_card/i);
  assert.doesNotMatch(template, /\u2014/);
  assert.equal(template.trim(), "{urgent_interventions}", "the tab opens directly on the fix list");

  const bound = bindCopy(template, {
    urgent_interventions: "<div data-fix-list=\"\">placeholder</div>",
  });
  assert.match(bound, /data-fix-list/);
  assert.doesNotMatch(bound, /Austin Bazaar|\{urgent_interventions\}|Pending data/);
});

test("the plan renders five ranked findings with not-stored actions when unread", () => {
  const lead = briefingFindingsLead({ phase: "error", message: "x" }, { phase: "error", message: "x" }, { phase: "error", message: "x" });
  assert.equal(lead.findings.length, 5);
  const plan = buildPlan({ findings: lead.findings, signals: [], sources: [] });
  assert.equal(plan.length, 5);
  for (const [i, id] of FINDING_IDS.entries()) {
    const item = plan.find((entry) => entry.id === `finding:${id}`);
    assert.ok(item, id);
    assert.equal(item.label, FINDING_LABELS[i]);
    assert.equal(item.percent, BRIEFING_COUNT_MISSING);
    assert.equal(item.action, MISSING_ACTIONS[i]);
    assert.equal(item.statusLabel, "No reading");
  }
  for (const item of plan) {
    assert.doesNotMatch(`${item.action} ${item.fact}`, /\$|lost.?revenue|since last time|what changed|fee|retainer|Austin Bazaar/i);
    assert.doesNotMatch(item.action, /—|\bAEO\b|JSON-LD|Schema\.org|\bSOV\b|\bASIN\b/);
  }
});

test("the five operator action lines stay for stored readings", () => {
  const lead = briefingFindingsLead({ phase: "loading" }, { phase: "loading" }, { phase: "loading" });
  const helper = read("lib/fender-canvas/urgent-interventions-rows.ts")
    .replaceAll("${brandSite()}", "fender.com")
    .replaceAll("${brandName()}", "Fender");
  for (const line of STORED_ACTIONS) {
    assert.match(helper, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const [i, finding] of lead.findings.entries()) {
    assert.equal(findingAction(finding), MISSING_ACTIONS[i]);
  }
  assert.doesNotMatch(helper, /\bAEO\b|JSON-LD|Schema\.org|\bSOV\b|\bASIN\b|—/);
  // Glossary terms in the rows come from DefinedCopy, as annotateGlossary marks the HTML tabs.
  assert.match(read("components/v3/live/RoadmapPlanParts.tsx"), /<DefinedCopy text=\{item\.action\} \/>/);
});

test("Action Items renders the React fix list on the map's AI population", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.doesNotMatch(spokes, /urgentInterventionsHtml|ai_action_card|aiActionCardHtml|CurrentFindingsPanel/);
  const overrides = spokes.slice(spokes.indexOf("const TAB_OVERRIDES"), spokes.indexOf("function wrapSpoke"));
  assert.match(overrides, /suggestions:\s*\{\s*0:\s*\([^)]*\)\s*=>\s*<ActionItemsPanel read=\{retail\} \/>/);
  assert.match(overrides, /\broadmap:\s*\{/);
  const panel = read("components/v3/live/ActionItemsPanel.tsx");
  assert.match(panel, /useRoadmapPlan\(read\)/);
  assert.match(panel, /data-fix-empty/);
  assert.match(read("components/v3/live/RoadmapPlanData.ts"), /useSummaryAiRead\(\)/);
});
