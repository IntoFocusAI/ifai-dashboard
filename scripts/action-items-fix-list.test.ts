// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/action-items-fix-list.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  FIX_ESTIMATE_LABEL,
  FIX_LIST_PRIORITY_RULE,
  FIX_LIST_TITLE,
  rankFixList,
  type FixListInput,
} from "../lib/fender-canvas/action-items-fix-list.ts";
import type { BriefingFinding, BriefingFindingId } from "../lib/fender-canvas/briefing-retail-lead.ts";

function finding(
  id: BriefingFindingId,
  tone: BriefingFinding["tone"],
  numerator: number | null,
  denominator: number | null,
): BriefingFinding {
  const stored = numerator != null && denominator != null;
  return {
    id,
    spokeId: id === "exact_official_product" ? "specs" : id === "unbranded_discovery" ? "aeo" : "ecommerce",
    tab: id === "exact_official_product" ? "Findability" : id === "unbranded_discovery" ? "Run Details" : "MAP",
    label: id,
    percent: stored ? `${((100 * numerator!) / denominator!).toFixed(1)}%` : "Not available*",
    ratio: stored ? `${numerator} of ${denominator}` : null,
    color: "var(--danger-red)",
    tone,
    pie: null,
    tip: null,
    explainer: "",
    numerator,
    denominator,
    partial: null,
    loading: false,
  };
}

function input(f: BriefingFinding): FixListInput {
  return { finding: f, action: `Fix ${f.id}.`, stored: f.numerator != null };
}

/** Live readings on 4 Nov 2026: four critical findings and one at risk. */
const LIVE = [
  finding("buy_box", "danger", 57, 1088),
  finding("map_leakage", "danger", 121, 633),
  finding("splintered_bundles", "danger", 75, 451),
  finding("exact_official_product", "danger", 82, 1041),
  finding("unbranded_discovery", "warning", 30, 60),
];

test("critical first, then at risk; within a status the larger share affected leads", () => {
  const rows = rankFixList(LIVE.map(input));
  assert.deepEqual(
    rows.map((row) => row.finding.id),
    ["exact_official_product", "map_leakage", "splintered_bundles", "buy_box", "unbranded_discovery"],
  );
  assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    rows.map((row) => row.statusLabel),
    ["Critical", "Critical", "Critical", "Critical", "At risk"],
  );
  assert.ok(Math.abs(rows[0]!.affectedShare! - (1 - 82 / 1041)) < 1e-9, "exact pages: share without an exact page");
});

test("on track comes after at risk, and a finding with no reading goes last", () => {
  const rows = rankFixList(
    [
      finding("buy_box", "success", 1, 100),
      finding("map_leakage", "warning", 5, 100),
      finding("splintered_bundles", "warning", null, null),
      finding("exact_official_product", "danger", 90, 100),
    ].map(input),
  );
  assert.deepEqual(
    rows.map((row) => [row.finding.id, row.status]),
    [
      ["exact_official_product", "critical"],
      ["map_leakage", "at_risk"],
      ["buy_box", "on_track"],
      ["splintered_bundles", "no_reading"],
    ],
  );
});

test("the priority rule names the order, including the decision 21 actions after the findings", () => {
  assert.equal(FIX_LIST_TITLE, "Fixes in priority order");
  assert.match(FIX_LIST_PRIORITY_RULE, /Critical findings come first, then at risk, then on track/);
  assert.match(FIX_LIST_PRIORITY_RULE, /out-of-stock listings and missing Amazon spec fields, then the brand.s own pages and listings when one of their factors is below Good, then the source, competitor, and fact-check actions/);
  assert.match(FIX_LIST_PRIORITY_RULE, /weakest engine and the weakest unbranded discovery questions that trail the best by 10 points or more, and the cited sites whose share moved by 10% or more/);
  assert.match(FIX_LIST_PRIORITY_RULE, /counted over the last 30 days with at least 30 answers behind the figure\. Wording the brand.s pages to match shopper questions comes next\. Watch lines come last/);
  assert.doesNotMatch(FIX_LIST_PRIORITY_RULE, /\u2014/);
});

test("an estimate passed to the ranking is kept for its row", () => {
  const rows = rankFixList(LIVE.map(input), { map_leakage: "+$1K est." });
  assert.equal(rows.find((row) => row.finding.id === "map_leakage")?.estimate, "+$1K est.");
  assert.equal(rows.filter((row) => row.estimate).length, 1);
  assert.equal(FIX_ESTIMATE_LABEL, "analyst estimate");
});

test("the fix list module renders no HTML and no weight over 600", () => {
  const source = readFileSync(new URL("../lib/fender-canvas/action-items-fix-list.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /<table|<tr|font-weight:\s*7\d\d/);
  const table = readFileSync(new URL("../components/v3/live/ActionItemsFixTable.tsx", import.meta.url), "utf8");
  assert.match(table, /<ResizableTable/);
  assert.doesNotMatch(table, /fontWeight:\s*[789]00|font-weight:\s*[789]00/);
});
