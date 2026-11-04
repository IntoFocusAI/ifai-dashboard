// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimate-method.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ENTERPRISE_POTENTIAL_ESTIMATE, PHASE_ONE_LIFT_ESTIMATE } from "../lib/fender-canvas/analyst-estimates.ts";
import { bindCopy } from "../lib/fender-canvas/template-vars.ts";

const root = new URL("..", import.meta.url);
const spec = JSON.parse(readFileSync(new URL("data/fender-v3-spec.json", root), "utf8"));

const TABS = {
  Opportunity: spec.spokes.hub.tabTemplates[2] as string,
  "Revenue Estimates": spec.spokes.suggestions.tabTemplates[1] as string,
};

const STEPS = [
  "figure",
  "source",
  "scope",
  "lines",
  "inputs",
  "listings",
  "sales_source",
  "suppression",
  "range",
];

function method(template: string): string {
  const start = template.indexOf('<div class="content-box" data-estimate-method=""');
  assert.ok(start >= 0, "method section present");
  return template.slice(start, template.indexOf("</table>", start));
}

function bound(template: string): string {
  return bindCopy(template, {
    phase_one_lift: PHASE_ONE_LIFT_ESTIMATE,
    enterprise_potential: ENTERPRISE_POTENTIAL_ESTIMATE,
  });
}

function dollars(text: string): number[] {
  return [...text.matchAll(/\+\$([\d,]+) \/ yr/g)].map((m) => Number(m[1]!.replace(/,/g, "")));
}

test("Opportunity and Revenue Estimates: figures, then how we arrived at them, then the callout; no bar chart", () => {
  for (const [name, template] of Object.entries(TABS)) {
    assert.doesNotMatch(template, /\{estimate_bars\}|data-estimate-bars|estimate-bar-/, name);
    const figure = template.indexOf("{phase_one_lift}");
    const how = template.indexOf("data-estimate-method");
    const callout = template.indexOf("data-estimate-explainer");
    assert.ok(figure >= 0 && figure < how && how < callout, `${name}: figures lead, method next, callout last`);
    assert.match(template, /<div class="content-box-title">How we arrived at these estimates<\/div>/);
  }
});

test("both tabs carry the same method section, step by step", () => {
  const [opportunity, revenue] = Object.values(TABS).map(method);
  assert.equal(opportunity, revenue);
  assert.deepEqual(
    [...opportunity!.matchAll(/data-estimate-step="([a-z_]+)"/g)].map((m) => m[1]),
    STEPS,
  );
});

test("each estimate is labeled analyst estimate, and its four lines add up to the figure shown", () => {
  const html = bound(method(TABS["Revenue Estimates"]));
  assert.equal((html.match(/data-estimate-label="">analyst estimate</g) ?? []).length, 2);
  assert.match(html, /\+\$680K est\. \/ yr/);
  assert.match(html, /\+\$38M to \$62M est\. \/ yr<\/strong>, \$50M midpoint/);

  const phase = html.split('data-estimate-lines="phase_one"')[1]!.split("</ul>")[0]!;
  const enterprise = html.split('data-estimate-lines="enterprise"')[1]!.split("</ul>")[0]!;
  assert.equal(dollars(phase).reduce((a, b) => a + b, 0), 680_000);
  assert.equal(dollars(enterprise).reduce((a, b) => a + b, 0), 50_000_000);
});

test("steps the repo does not state read Not available* with a custom tooltip", () => {
  const html = method(TABS.Opportunity);
  const missing = [...html.matchAll(/<span class="ifai-term" data-estimate-missing=""([^>]*)>([^<]*)<\/span>/g)];
  assert.equal(missing.length, 9);
  for (const [, attrs, text] of missing) {
    assert.equal(text, "Not available*");
    assert.match(attrs!, /data-ifai-tooltip-title="Not available\*" data-ifai-tooltip-desc="[^"]+" tabindex="0" aria-label="Not available\*: /);
  }
  assert.match(html, /80% Buy Box suppression assumption is not applied to this estimate yet/);
  assert.doesNotMatch(html, /\stitle="/);
});

test("the method section adds no formula, population, or fee the repo does not state", () => {
  const html = method(TABS.Opportunity);
  assert.doesNotMatch(html, /\u2014/);
  assert.doesNotMatch(html, /14 pilot|3,430|3,159|monitored|SKUs|ASINs/i);
  const text = html.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /\d ?[x×]\b|multipl|\bROI\b|retainer|\bfees?\b|per month/i);
  const shown = new Set(dollars(html));
  for (const value of [380_000, 190_000, 65_000, 45_000, 25_000_000, 16_500_000, 5_000_000, 3_500_000]) {
    assert.ok(shown.has(value), `${value} is one of the stated lines`);
  }
  assert.equal(shown.size, 8, "no dollar beyond the eight stated lines");
});
