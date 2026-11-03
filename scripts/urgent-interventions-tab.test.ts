// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/urgent-interventions-tab.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BRIEFING_COUNT_MISSING,
  briefingFindingsLead,
} from "../lib/fender-canvas/briefing-retail-lead.ts";
import { urgentInterventionsHtml } from "../lib/fender-canvas/urgent-interventions-html.ts";
import { bindCopy } from "../lib/fender-canvas/template-vars.ts";

const root = new URL("..", import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), "utf8");
}

function objectBlock(source: string, key: string): string {
  const start = source.search(new RegExp(`\\b${key}:\\s*\\{`));
  assert.ok(start >= 0, `${key}: { not found`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`${key}: { is never closed`);
}

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
  assert.match(template, /phase_one_lift/);
  assert.match(template, /enterprise_potential/);

  const bound = bindCopy(template, {
    phase_one_lift: "+$680K",
    enterprise_potential: "+$38M to $62M",
    urgent_interventions: "<div class=\"action-card\">placeholder</div>",
  });
  assert.match(bound, /action-card/);
  assert.doesNotMatch(bound, /Austin Bazaar|\{urgent_interventions\}/);
});

test("urgentInterventionsHtml renders five findings with N of M and not-stored actions when unread", () => {
  const html = urgentInterventionsHtml(
    { phase: "loading" },
    { phase: "loading" },
    { phase: "loading" },
  );
  const lead = briefingFindingsLead(
    { phase: "loading" },
    { phase: "loading" },
    { phase: "loading" },
  );

  assert.equal(lead.findings.length, 5);
  assert.deepEqual(
    lead.findings.map((f) => f.id),
    [...FINDING_IDS],
  );

  for (let i = 0; i < FINDING_LABELS.length; i++) {
    const finding = lead.findings[i]!;
    assert.match(html, new RegExp(FINDING_LABELS[i]!));
    assert.match(html, new RegExp(`data-urgent-finding="${FINDING_IDS[i]}"`));
    assert.match(html, new RegExp(`data-ifai-open="${finding.spokeId}"`));
    assert.match(html, new RegExp(`data-ifai-tab="${finding.tab}"`));
    assert.match(html, new RegExp(BRIEFING_COUNT_MISSING));
    assert.match(html, new RegExp(MISSING_ACTIONS[i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.equal((html.match(/data-urgent-finding-action=/g) ?? []).length, 5);
  assert.equal((html.match(/action-details/g) ?? []).length, 5);
  assert.equal((html.match(/Open details/g) ?? []).length, 5);
  assert.doesNotMatch(html, /\$|lost.?revenue|since last time|what changed|fee|retainer|Austin Bazaar/i);
  assert.doesNotMatch(html, /\u2014/);
  assert.doesNotMatch(html, /\bAEO\b|JSON-LD|Schema\.org|\bSOV\b|\bASIN\b/);
  assert.doesNotMatch(html, /class="ifai-term"|data-ifai-tooltip-/);
  assert.equal((html.match(/data-urgent-finding=/g) ?? []).length, 5);

  for (const label of FINDING_LABELS) {
    const cardStart = html.indexOf(`>${label}<`);
    assert.ok(cardStart >= 0, label);
    const afterLabel = html.slice(cardStart);
    const actionIdx = afterLabel.indexOf("data-urgent-finding-action");
    const openIdx = afterLabel.indexOf("Open details");
    assert.ok(actionIdx >= 0 && openIdx > actionIdx, `${label}: action before Open details`);
  }
});

test("urgentInterventionsHtml keeps the five operator action lines for stored readings", () => {
  const helper = read("lib/fender-canvas/urgent-interventions-html.ts");
  for (const line of STORED_ACTIONS) {
    assert.match(helper, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const line of MISSING_ACTIONS) {
    assert.match(helper, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(helper, /\bAEO\b|JSON-LD|Schema\.org|\bSOV\b|\bASIN\b/);
  assert.doesNotMatch(helper, /\u2014/);
  assert.doesNotMatch(helper, /className=["']ifai-term|dataset\.ifaiTooltip|data-ifai-tooltip-/);
  assert.match(helper, /annotateGlossary/);
});

test("build-live-spokes wires urgent_interventions and leaves CurrentFindingsPanel on tab 2", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.match(spokes, /urgentInterventionsHtml/);
  assert.match(spokes, /urgent_interventions:\s*urgentInterventionsHtml\(retail,\s*findability,\s*ai\)/);
  assert.doesNotMatch(spokes, /ai_action_card|aiActionCardHtml/);
  assert.match(spokes, /suggestions:\s*\{[\s\S]*2:\s*\([^)]*\)\s*=>\s*<CurrentFindingsPanel/);
  assert.doesNotMatch(objectBlock(spokes, "suggestions"), /\b0:/);
});
