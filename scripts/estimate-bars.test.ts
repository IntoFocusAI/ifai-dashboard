// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimate-bars.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ENTERPRISE_POTENTIAL_ESTIMATE,
  PHASE_ONE_LIFT_ESTIMATE,
} from "../lib/fender-canvas/analyst-estimates.ts";
import { estimateAmounts, estimateBars, estimateBarsHtml } from "../lib/fender-canvas/estimate-bars.ts";
import { bindCopy } from "../lib/fender-canvas/template-vars.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");
const spec = JSON.parse(read("data/fender-v3-spec.json")) as {
  spokes: Record<string, { tabs: string[]; tabTemplates: string[] }>;
};

const TABS = {
  Opportunity: spec.spokes.hub!.tabTemplates[2]!,
  "Revenue Estimates": spec.spokes.suggestions!.tabTemplates[1]!,
};

test("bar lengths come from the two shown estimates on one scale", () => {
  assert.deepEqual(estimateAmounts(PHASE_ONE_LIFT_ESTIMATE), [680_000]);
  assert.deepEqual(estimateAmounts(ENTERPRISE_POTENTIAL_ESTIMATE), [38_000_000, 62_000_000]);
  const bars = estimateBars(PHASE_ONE_LIFT_ESTIMATE, ENTERPRISE_POTENTIAL_ESTIMATE)!;
  assert.deepEqual(
    bars.map((bar) => [bar.id, bar.figure]),
    [
      ["phase_one", "+$680K est."],
      ["enterprise", "+$38M to $62M est."],
    ],
  );
  assert.equal(bars[0]!.start, 0);
  assert.ok(Math.abs(bars[0]!.width - (100 * 0.68) / 62) < 1e-9);
  assert.ok(Math.abs(bars[1]!.start - (100 * 38) / 62) < 1e-9);
  assert.ok(Math.abs(bars[1]!.start + bars[1]!.width - 100) < 1e-9);
});

test("a figure with no dollar amount draws no chart", () => {
  assert.equal(estimateBars("Not available*", ENTERPRISE_POTENTIAL_ESTIMATE), null);
  assert.equal(estimateBarsHtml(PHASE_ONE_LIFT_ESTIMATE, "Pending data"), "");
});

test("the chart shows only the shown figures, each labeled analyst estimate", () => {
  const html = estimateBarsHtml(PHASE_ONE_LIFT_ESTIMATE, ENTERPRISE_POTENTIAL_ESTIMATE);
  assert.equal((html.match(/data-estimate-bar=/g) ?? []).length, 2);
  assert.equal((html.match(/data-estimate-label="">analyst estimate</g) ?? []).length, 2);
  assert.match(html, /data-estimate-figure="">\+\$680K est\.</);
  assert.match(html, /data-estimate-figure="">\+\$38M to \$62M est\.</);
  const visible = html.replace(/<[^>]+>/g, " ");
  assert.deepEqual(visible.match(/\$[\d.,]+[KMB]?/g), ["$680K", "$38M", "$62M"]);
  assert.match(html, /class="ifai-term" data-ifai-tooltip-title="Analyst estimates" data-ifai-tooltip-desc=/);
  assert.doesNotMatch(html, /\stitle=|\u2014|fee|retainer/i);
});

for (const [name, template] of Object.entries(TABS)) {
  test(`${name} opens on the chart, then the figures, with the explanation last`, () => {
    const chart = template.indexOf("{estimate_bars}");
    const figures = template.indexOf("{phase_one_lift}");
    const explainer = template.indexOf("ceo-callout");
    assert.ok(chart >= 0 && chart < figures, "chart before the figure cards");
    assert.ok(figures < explainer, "figure cards before the explanation");
    const bound = bindCopy(template, {
      phase_one_lift: PHASE_ONE_LIFT_ESTIMATE,
      enterprise_potential: ENTERPRISE_POTENTIAL_ESTIMATE,
      estimate_bars: estimateBarsHtml(PHASE_ONE_LIFT_ESTIMATE, ENTERPRISE_POTENTIAL_ESTIMATE),
    });
    assert.ok(bound.indexOf("data-estimate-bars") < bound.indexOf("ceo-callout"));
    assert.doesNotMatch(bound, /Pending data/);
  });
}

test("the spoke builder binds estimate_bars from the same two estimate vars", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.match(spokes, /estimate_bars:\s*estimateBarsHtml\(base\.phase_one_lift,\s*base\.enterprise_potential\)/);
});
