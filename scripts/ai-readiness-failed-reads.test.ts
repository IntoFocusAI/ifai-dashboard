// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-readiness-failed-reads.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EMPTY_METRICS_ROW, failedMetricsRow, readFailure } from "../lib/fender-canvas/canvas-reads.ts";
import {
  brandSitePageFoundHero,
  PAGE_FOUND_UNAVAILABLE,
  PAGE_FOUND_UNAVAILABLE_TIP,
} from "../lib/fender-canvas/page-found-hero.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("a failed canvas_metrics read names that read on the Brand-Site Specs page-found hero", () => {
  const hero = brandSitePageFoundHero(failedMetricsRow(readFailure("m", { message: "forced canvas_metrics failure" })));
  assert.equal(hero.percent, PAGE_FOUND_UNAVAILABLE);
  assert.equal(hero.ratio, null);
  assert.equal(hero.pie, null);
  assert.equal(hero.denominator, null);
  assert.equal(
    hero.figureTip,
    "The catalog metrics read (canvas_metrics) did not load: forced canvas_metrics failure.",
  );
  assert.equal(hero.explainer, "The checked-SKU counts did not load.");
  assert.doesNotMatch(hero.definition, /canvas_metrics|did not load/);

  const unread = brandSitePageFoundHero(failedMetricsRow(readFailure("m", null)));
  assert.equal(unread.figureTip, "The catalog metrics read (canvas_metrics) did not load.");
});

test("an unreported count is not a failed read", () => {
  const hero = brandSitePageFoundHero({ ...EMPTY_METRICS_ROW });
  assert.equal(hero.percent, PAGE_FOUND_UNAVAILABLE);
  assert.equal(hero.figureTip, PAGE_FOUND_UNAVAILABLE_TIP);
  assert.equal(brandSitePageFoundHero(null).figureTip, PAGE_FOUND_UNAVAILABLE_TIP);
});

test("Top missing Amazon fields stays on a failed read and names it; shares name a failed metrics read", () => {
  const panel = read("components/v3/live/FenderSpecPanel.tsx");
  const catalog = read("components/v3/live/CatalogReadinessSpec.tsx");
  assert.match(catalog, /missingFailure=\{bundle\.unavailable\?\.missing \?\? null\}/);
  assert.match(catalog, /metricsFailure=\{bundle\.unavailable\?\.m \?\? null\}/);
  assert.match(catalog, /specChecked=\{bundle\.m\.spec_checked\}/);

  const failedBox = panel.slice(panel.indexOf("if (missingFailure) {"), panel.indexOf("if (amazonOnly.length === 0) return null;"));
  assert.ok(failedBox.length > 0, "the failed-read box comes before the empty-list return");
  assert.match(failedBox, /data-read-unavailable-box=\{missingFailure\.source\}/);
  assert.match(failedBox, /<ReadNotAvailableMark failure=\{missingFailure\} \/>/);
  assert.match(failedBox, /\{MISSING_FIELDS_TITLE\}/);
  assert.match(panel, /<ReadNotAvailableMark failure=\{metricsFailure\} \/>/);
  assert.match(panel, /metricsFailure=\{metricsFailure\}/);
  assert.doesNotMatch(panel, /(?<![\w-])title=/);
  const lines = panel.replace(/\n$/, "").split("\n").length;
  assert.ok(lines <= 400, `FenderSpecPanel.tsx is ${lines} lines`);
});

test("the page-found table claims no count mismatch when the headline has no counts", () => {
  const table = read("components/v3/live/PageFoundTable.tsx");
  assert.match(table, /evidence && hero\.denominator != null \? evidenceMatchesHero\(evidence, hero\) : true/);
});
