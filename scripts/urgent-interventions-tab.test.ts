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

test("urgentInterventionsHtml renders five ranked rows with not-stored actions when unread", () => {
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
    assert.match(html, new RegExp(`data-fix-row="${FINDING_IDS[i]}"`));
    assert.match(html, new RegExp(`data-ifai-open="${finding.spokeId}" data-ifai-tab="${finding.tab}"`));
    assert.match(html, new RegExp(BRIEFING_COUNT_MISSING));
    assert.match(html, new RegExp(MISSING_ACTIONS[i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.equal((html.match(/data-fix-row=/g) ?? []).length, 5);
  assert.equal((html.match(/data-fix-action=/g) ?? []).length, 5);
  assert.equal((html.match(/data-fix-status-label="">No reading</g) ?? []).length, 5);
  assert.doesNotMatch(html, /\$|lost.?revenue|since last time|what changed|fee|retainer|Austin Bazaar/i);
  assert.doesNotMatch(html, /\u2014/);
  assert.doesNotMatch(html, /\bAEO\b|JSON-LD|Schema\.org|\bSOV\b|\bASIN\b/);
  assert.doesNotMatch(html, /data-action-items-lead|citation-pie-disc|>Critical findings</);
  assert.doesNotMatch(html, /\stitle="/);

  const body = html.slice(html.indexOf("<tbody>"));
  assert.doesNotMatch(body, /class="ifai-term"|data-ifai-tooltip-/, "glossary terms in rows come from annotateGlossary");
});

test("urgentInterventionsHtml keeps the five operator action lines for stored readings", () => {
  // Brand words are read at call time; Fender is the default client.
  const helper = read("lib/fender-canvas/urgent-interventions-html.ts")
    .replaceAll("${brandSite()}", "fender.com")
    .replaceAll("${brandName()}", "Fender");
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

test("build-live-spokes wires urgent_interventions and gives Action Items no React override", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.match(spokes, /urgentInterventionsHtml/);
  assert.match(spokes, /urgent_interventions:\s*urgentInterventionsHtml\(retail,\s*findability,\s*ai\)/);
  assert.doesNotMatch(spokes, /ai_action_card|aiActionCardHtml|CurrentFindingsPanel/);
  const overrides = spokes.slice(spokes.indexOf("const TAB_OVERRIDES"), spokes.indexOf("function wrapSpoke"));
  assert.match(overrides, /\broadmap:\s*\{/);
  assert.doesNotMatch(overrides, /\bsuggestions:/);
});
