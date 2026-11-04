// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/action-items-fix-list.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIX_ESTIMATE_LABEL,
  FIX_LIST_PRIORITY_RULE,
  FIX_LIST_TITLE,
  fixListHtml,
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

test("rows show N of M with the share and a status word, and link to the evidence tab", () => {
  const html = fixListHtml(rankFixList(LIVE.map(input)));
  assert.equal((html.match(/<tr class="ifai-row-link"/g) ?? []).length, 5);
  assert.match(html, /data-fix-percent="">7\.9%<\/strong> <span class="findability-lead-ratio" data-fix-ratio="">82 of 1041<\/span>/);
  assert.match(html, /tag-badge tag-danger" data-fix-status-label="">Critical</);
  assert.match(html, /tag-badge tag-warning" data-fix-status-label="">At risk</);
  assert.match(html, /<button type="button" class="ifai-open-hint"[^>]*data-ifai-open="specs" data-ifai-tab="Findability"[^>]*>Open Findability →<\/button>/);
  const rows = [...html.matchAll(/data-fix-row="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ["exact_official_product", "map_leakage", "splintered_bundles", "buy_box", "unbranded_discovery"]);
  for (const row of html.split("<tr class=\"ifai-row-link\"").slice(1)) {
    assert.ok(row.indexOf("data-fix-rank") < row.indexOf("data-fix-action"), "rank, then what to fix");
    assert.ok(row.indexOf("data-fix-action") < row.indexOf("data-fix-finding"), "what to fix, then the finding");
    assert.ok(row.indexOf("data-fix-finding") < row.indexOf("data-fix-open"), "the finding, then the evidence link");
  }
});

test("the priority rule sits in the custom tooltip on the list title, never a native title", () => {
  const html = fixListHtml(rankFixList(LIVE.map(input)));
  assert.match(html, new RegExp(`class="ifai-term" data-ifai-tooltip-title="${FIX_LIST_TITLE}"`));
  assert.ok(html.includes(`data-ifai-tooltip-desc="${FIX_LIST_PRIORITY_RULE}"`));
  assert.match(FIX_LIST_PRIORITY_RULE, /Critical findings come first, then at risk, then on track/);
  assert.match(html, /tabindex="0"/);
  assert.doesNotMatch(html, /\stitle="/);
  assert.doesNotMatch(html, /\u2014/);
});

test("no dollar appears unless an existing estimate is passed, and then it is labeled analyst estimate", () => {
  const plain = fixListHtml(rankFixList(LIVE.map(input)));
  assert.doesNotMatch(plain, /\$|data-fix-estimate|analyst estimate/);

  const withEstimate = fixListHtml(rankFixList(LIVE.map(input), { map_leakage: "+$1K est." }));
  assert.equal((withEstimate.match(/data-fix-estimate=/g) ?? []).length, 1);
  assert.match(withEstimate, new RegExp(`<strong>\\+\\$1K est\\.</strong> ${FIX_ESTIMATE_LABEL}`));
});
