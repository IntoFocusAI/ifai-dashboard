// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimate-lines.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ENTERPRISE_POTENTIAL_ESTIMATE, PHASE_ONE_LIFT_ESTIMATE } from "../lib/fender-canvas/analyst-estimates.ts";
import { formatEstimate } from "../lib/fender-canvas/format.ts";
import { bindCopy, buildTemplateVars } from "../lib/fender-canvas/template-vars.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url);
const spec = JSON.parse(readFileSync(new URL("data/fender-v3-spec.json", root), "utf8"));

/** A live retail headline the old analyst lines used to wear. */
const LIVE_HEADLINE = "Suppressed Listings: 47 listings.";

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function listItems(html: string): string[] {
  return [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => plain(match[1] ?? ""));
}

function bound(template: string): string {
  return bindCopy(template, {
    retail_headline: LIVE_HEADLINE,
    phase_one_lift: PHASE_ONE_LIFT_ESTIMATE,
    enterprise_potential: ENTERPRISE_POTENTIAL_ESTIMATE,
    catalog_skus: "3,598",
    map_violation_skus: "555",
  });
}

test("the Phase 1 and enterprise ROI lines do not wear the live retail headline", () => {
  const roi = bound(spec.spokes.suggestions.tabTemplates[1] as string);
  const block = (attr: string) => roi.split(attr)[1]?.split("</ul>")[0] ?? "";
  const pilot = roi.split('data-estimate-card="phase_one"')[1]?.split('data-estimate-card="enterprise"')[0] ?? "";
  const enterprise = roi.split('data-estimate-card="enterprise"')[1] ?? "";
  const pilotLines = listItems(block('data-estimate-lines="phase_one"'));
  const enterpriseLines = listItems(block('data-estimate-lines="enterprise"'));
  assert.equal(pilotLines.length, 4);
  assert.equal(enterpriseLines.length, 4);

  assert.equal(
    pilotLines[0],
    "Earlier analyst estimate, not calculated from the current listing count: +$380,000 / yr",
  );
  assert.equal(
    enterpriseLines[0],
    "Earlier analyst estimate, not calculated from the current listing count: +$25,000,000 / yr",
  );
  for (const line of [pilotLines[0], enterpriseLines[0]]) {
    assert.equal(line?.startsWith("Suppressed Listings"), false);
    assert.equal(line?.includes(LIVE_HEADLINE), false);
    assert.equal(line?.includes("47 listings"), false);
  }
  assert.equal(enterpriseLines.some((line) => line.includes("Reverb")), false);
  assert.match(enterpriseLines.join(" "), /Amazon and Walmart/);
  assert.match(enterpriseLines.join(" "), /\+\$3,500,000 \/ yr/);
  assert.match(pilot, /tone-success">\+\$680K est\. <span/);
  assert.match(enterprise, /tone-success">\+\$38M to \$62M est\. <span/);
  assert.match(enterprise, /\+\$50M midpoint/);
});

test("Opportunity does not paste the live headline into the Phase 1 estimate", () => {
  const sizing = bound(spec.spokes.hub.tabTemplates[2] as string);
  assert.equal(sizing.includes("follows the live retail headline"), false);
  assert.equal(sizing.includes(LIVE_HEADLINE), false);
  assert.equal(sizing.includes("{retail_headline}"), false);
  assert.match(sizing, /\+\$680K est\. <span[^>]*>\/ yr/);
  assert.match(sizing, /\+\$38M to \$62M est\./);
  assert.match(sizing, /\(\$50M midpoint\)/);
  assert.match(sizing, /\+\$50M/);
  const card = sizing.split("Phase 1 (estimate)")[1]?.split("Full Enterprise Scale")[0] ?? "";
  assert.match(card, /Analyst estimate\. Not calculated from the current listing count\./);
  assert.equal(card.includes("Suppressed Listings"), false);
  assert.match(
    sizing,
    /Phase 1 Quick-Win Lift \(\+\$680K est\. \/ yr\):<\/strong> Analyst estimate\. Not calculated from the current listing count\./,
  );
});

test("the Phase 1 and enterprise estimates read the same on every tab", () => {
  assert.equal(PHASE_ONE_LIFT_ESTIMATE, "+$680K est.");
  assert.equal(ENTERPRISE_POTENTIAL_ESTIMATE, "+$38M to $62M est.");
  assert.equal(formatEstimate(PHASE_ONE_LIFT_ESTIMATE), PHASE_ONE_LIFT_ESTIMATE, "formatting twice adds nothing");
  const empty = { m: {} as CanvasMetricsRow, cats: [], engines: [], sov: [], divisions: [], missing: [], fresh: [] } as CanvasBundle;
  const vars = buildTemplateVars(empty);
  assert.equal(vars.phase_one_lift, PHASE_ONE_LIFT_ESTIMATE);
  assert.equal(vars.enterprise_potential, ENTERPRISE_POTENTIAL_ESTIMATE);

  const surfaces = {
    Briefing: spec.spokes.hub.tabTemplates[0],
    Opportunity: spec.spokes.hub.tabTemplates[2],
    "Action Items description": spec.spokes.suggestions.desc,
    "Urgent Interventions": spec.spokes.suggestions.tabTemplates[0],
    "Revenue Estimates": spec.spokes.suggestions.tabTemplates[1],
  } as Record<string, string>;
  for (const [name, template] of Object.entries(surfaces)) {
    const copy = plain(bindCopy(template, vars));
    assert.doesNotMatch(copy, /\$680,000|\$50,000,000/, `${name} uses the short estimate`);
    assert.doesNotMatch(copy, /\$680K(?! est\.)|\$38M to \$62M(?! est\.)/, `${name} labels each estimate where it is shown`);
    assert.doesNotMatch(copy, /est\.\.|estimate est\./, `${name} reads cleanly around the label`);
  }
  assert.match(plain(bindCopy(surfaces["Revenue Estimates"], vars)), /\+\$680K est\./);
  assert.match(plain(bindCopy(surfaces["Revenue Estimates"], vars)), /\+\$38M to \$62M est\./);
});

test("client copy does not discuss IntoFocus fees or retainers", () => {
  const raw = readFileSync(new URL("data/fender-v3-spec.json", root), "utf8");
  assert.equal(/retainer/i.test(raw), false);
  assert.equal(raw.includes("$20,000/month"), false);
  assert.equal(raw.includes("$240,000"), false);
  assert.equal(raw.includes("20K/mo"), false);
  assert.equal(raw.includes("208x"), false);
  assert.equal(raw.includes("2.8x"), false);
  assert.equal(raw.includes("Service Fee"), false);
});

test("Urgent Interventions lists findings via urgent_interventions, not example action cards", () => {
  const template = spec.spokes.suggestions.tabTemplates[0] as string;
  assert.match(template, /\{urgent_interventions\}/);
  assert.equal(/Austin Bazaar|Bundle MAP|comparison matrix|buy button/i.test(template), false);
  const helper = readFileSync(new URL("lib/fender-canvas/urgent-interventions-html.ts", root), "utf8");
  assert.match(helper, /briefingFindingsLead/);
  assert.match(helper, /data-ifai-open/);
  assert.match(readFileSync(new URL("lib/fender-canvas/briefing-retail-lead.ts", root), "utf8"), /Buy Box withheld/);
});
