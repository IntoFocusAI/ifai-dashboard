// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-readiness-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  AMAZON_COMPLETENESS_BANDS,
  FENDER_COMPLETENESS_BANDS,
  PAGE_FOUND_BANDS,
  amazonCompletenessHero,
  amazonSpecsHeroes,
  averageAcrossRatio,
  averagePercentPie,
  fenderCompletenessTone,
  missingAdditionalPropertyHero,
  pageFoundHero,
  pageFoundTone,
  presentAmazonCompletenessFieldShare,
  shareCountPie,
  sumAmazonFieldTotals,
  toneColor,
} from "../lib/fender-canvas/ai-readiness-lead.ts";
import { formatPct, formatRatio } from "../lib/fender-canvas/format.ts";
import { MISSING_FIELD_SHARE_UNAVAILABLE } from "../lib/fender-canvas/spec-missing-fields.ts";
import type { CanvasMetricsRow } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function metrics(partial: Partial<CanvasMetricsRow>): CanvasMetricsRow {
  return {
    catalog_skus: null,
    catalog_bundles: null,
    seller_harvested: null,
    seller_harvested_pct: null,
    division_count: null,
    bb_total: null,
    bb_1p: null,
    bb_3p: null,
    bb_unharvested: null,
    bb_no_offer: null,
    bb_1p_pct: null,
    bb_3p_pct: null,
    bb_unharvested_pct: null,
    active_offer_coverage_pct: null,
    amz_below_map: null,
    amz_avg_drift: null,
    wmt_checked: null,
    wmt_leaks: null,
    mf_checked: null,
    mf_leaks: null,
    offamz_avg_leak: null,
    map_violation_skus: null,
    bundle_reviews: null,
    spec_checked: 925,
    spec_avg_amazon_pct: 91.6,
    spec_fender_found: 123,
    spec_fender_found_pct: 13.3,
    spec_avg_fender_pct: 40,
    spec_missing_additional_property: 123,
    spec_missing_field_types: null,
    sim_total: null,
    sim_runs: null,
    sim_resolved: null,
    sim_wins: null,
    sim_win_pct: null,
    sim_unclear: null,
    sim_errors: null,
    sim_hallucinations: null,
    sim_hallucination_risk: null,
    weakest_category: null,
    weakest_win_pct: null,
    weakest_top_competitor: null,
    weakest_competitor_pct: null,
    weakest_sov_gap_pts: null,
    strongest_category: null,
    strongest_win_pct: null,
    strongest_wins: null,
    strongest_resolved: null,
    ...partial,
  } as CanvasMetricsRow;
}

test("page-found hero uses the stored percent, found of checked, and that pie", () => {
  const hero = pageFoundHero(metrics({}));
  assert.equal(hero.percent, formatPct(13.3));
  assert.equal(hero.ratio, formatRatio(123, 925));
  assert.equal(hero.color, "var(--danger-red)");
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 925);
  assert.deepEqual(
    hero.pie.slices.map((slice) => [slice.label, slice.count]),
    [
      ["Page found", 123],
      ["Rest of this population", 802],
    ],
  );
});

test("page-found bands: under 85 red, 85 and 95 yellow, above 95 green", () => {
  assert.equal(PAGE_FOUND_BANDS.redBelow, 85);
  assert.equal(PAGE_FOUND_BANDS.greenAbove, 95);
  assert.equal(pageFoundTone(84.9), "danger");
  assert.equal(pageFoundTone(85), "warning");
  assert.equal(pageFoundTone(95), "warning");
  assert.equal(pageFoundTone(95.1), "success");
  assert.equal(toneColor(pageFoundTone(84.9)), "var(--danger-red)");
  assert.equal(toneColor(pageFoundTone(85)), "var(--warning-amber)");
  assert.equal(toneColor(pageFoundTone(95)), "var(--warning-amber)");
  assert.equal(toneColor(pageFoundTone(95.1)), "var(--success-green)");
});

test("fender completeness bands: under 95 red, 95 and 98 yellow, above 98 green", () => {
  assert.equal(FENDER_COMPLETENESS_BANDS.redBelow, 95);
  assert.equal(FENDER_COMPLETENESS_BANDS.greenAbove, 98);
  assert.equal(fenderCompletenessTone(94.9), "danger");
  assert.equal(fenderCompletenessTone(95), "warning");
  assert.equal(fenderCompletenessTone(98), "warning");
  assert.equal(fenderCompletenessTone(98.1), "success");
  assert.equal(toneColor(fenderCompletenessTone(94.9)), "var(--danger-red)");
  assert.equal(toneColor(fenderCompletenessTone(95)), "var(--warning-amber)");
  assert.equal(toneColor(fenderCompletenessTone(98)), "var(--warning-amber)");
  assert.equal(toneColor(fenderCompletenessTone(98.1)), "var(--success-green)");
});

test("Amazon Specs keeps Amazon completeness and does not invent listings at 100%", () => {
  const heroes = amazonSpecsHeroes(
    metrics({
      spec_amazon_fields_found: 11_050,
      spec_amazon_fields_expected: 12_025,
    }),
  );
  assert.equal(heroes.length, 1);
  const amazon = heroes[0];
  assert.equal(amazon.id, "amazon_completeness");
  assert.equal(amazon.percent, formatPct(91.6));
  assert.equal(amazon.ratio, `${formatRatio(11_050, 12_025)} (${formatPct(91.6)})`);
  assert.match(amazon.ratio ?? "", /^\d/);
  assert.doesNotMatch(amazon.ratio ?? "", /^Across\b/);
  assert.match(amazon.definition, /Amazon listings of the 925 checked SKUs/i);
  assert.match(amazon.definition, /average per listing, not the share of listings with every field filled/i);
  assert.ok(amazon.pie);
  assert.equal(amazon.pie.total, 100);
  const filled = amazon.pie.slices.find((slice) => slice.key === "matched");
  assert.ok(filled);
  assert.equal(filled.count, 91.6);
  assert.equal(AMAZON_COMPLETENESS_BANDS.dangerBelow, 85);
  assert.equal(AMAZON_COMPLETENESS_BANDS.warnBelow, 92);
  assert.equal(amazon.color, "var(--warning-amber)");
});

test("Amazon completeness share uses stored field totals, not avg times listing count", () => {
  // avg 50% × 10 listings × 13 expected fields = 65. Stored found is 40.
  const invented = Math.round((50 / 100) * 10 * 13);
  assert.equal(invented, 65);
  const share = presentAmazonCompletenessFieldShare(40, 130, 50);
  assert.equal(share.kind, "share");
  if (share.kind !== "share") return;
  assert.equal(share.ratio, formatRatio(40, 130));
  assert.equal(share.label, `${formatRatio(40, 130)} (${formatPct(50)})`);
  assert.notEqual(share.ratio, formatRatio(invented, 130));

  const hero = amazonCompletenessHero(
    metrics({
      spec_checked: 10,
      spec_avg_amazon_pct: 50,
      spec_amazon_fields_found: 40,
      spec_amazon_fields_expected: 130,
    }),
  );
  assert.equal(hero.ratio, `${formatRatio(40, 130)} (${formatPct(50)})`);
  assert.doesNotMatch(hero.ratio ?? "", /Across/);
  assert.match(hero.definition, /Amazon listings of the 10 checked SKUs/i);
});

test("Amazon completeness share is Not available* when field totals are missing", () => {
  const share = presentAmazonCompletenessFieldShare(null, null, 89.6);
  assert.equal(share.kind, "unavailable");
  assert.equal(share.label, MISSING_FIELD_SHARE_UNAVAILABLE);

  const hero = amazonCompletenessHero(metrics({ spec_avg_amazon_pct: 89.6 }));
  assert.equal(hero.percent, formatPct(89.6));
  assert.equal(hero.ratio, MISSING_FIELD_SHARE_UNAVAILABLE);
  assert.doesNotMatch(hero.ratio ?? "", /Across/);
});

test("sumAmazonFieldTotals adds checked rows and ignores unchecked ones", () => {
  const totals = sumAmazonFieldTotals([
    { amazon_checked: true, amazon_fields_found: 10, amazon_fields_expected: 13 },
    { amazon_checked: false, amazon_fields_found: 13, amazon_fields_expected: 13 },
    { amazon_checked: true, amazon_fields_found: 5, amazon_fields_expected: 13 },
    { amazon_checked: true, amazon_fields_found: null, amazon_fields_expected: 13 },
  ]);
  assert.deepEqual(totals, { found: 15, expected: 26 });
});

test("page-found and fender completeness helpers stay available for the bubble and Findability", () => {
  const page = pageFoundHero(metrics({}));
  assert.equal(page.id, "page_found");
  const fender = missingAdditionalPropertyHero(
    metrics({ spec_fender_found: 8, spec_missing_additional_property: 5 }),
  );
  assert.equal(fender.percent, formatPct((100 * 5) / 8));
  assert.equal(fender.ratio, formatRatio(5, 8));
  assert.equal(fenderCompletenessTone(94.9), "danger");
});

test("Amazon Specs does not ship page-found or brand-site heroes", () => {
  const heroes = amazonSpecsHeroes(metrics({}));
  assert.deepEqual(
    heroes.map((hero) => hero.id),
    ["amazon_completeness"],
  );
  assert.equal(averageAcrossRatio(925, "checked SKUs"), "Across 925 checked SKUs");
  assert.equal(shareCountPie("x", "t", "a", 1, 0), null);
  assert.equal(averagePercentPie("x", "t", null), null);
});

test("the lead UI ships heroes without the older-spec-read paragraph or Show/Hide", () => {
  const lead = read("components/v3/live/AiReadinessLead.tsx");
  assert.match(lead, /data-ai-readiness-lead/);
  assert.match(lead, /data-ai-readiness-hero=/);
  assert.match(lead, /CitationPieDisc/);
  assert.match(lead, /findability-lead-card/);
  assert.doesNotMatch(lead, /data-spec-filter/);
  assert.doesNotMatch(lead, /spec-found-pill/);
  assert.doesNotMatch(lead, /missingPageControl|MissingPageControl|filterControl/);
  assert.doesNotMatch(lead, /ai-readiness-lead-note/);
  assert.doesNotMatch(lead, /older spec read/);
  assert.doesNotMatch(lead, /Official-page outcomes are on the Findability tab/);
  assert.doesNotMatch(lead, /family page there/);
  assert.match(lead, /ifai-term/);
  assert.match(lead, /data-ifai-tooltip-title/);
  assert.match(lead, /data-ifai-tooltip-desc/);
  assert.doesNotMatch(lead, /(?<![\w-])title=/);
  assert.doesNotMatch(lead, /\u2014/);
  assert.doesNotMatch(lead, />\s*Metric\s*</);
  assert.doesNotMatch(lead, /SKUs checked/);

  const panel = read("components/v3/live/CatalogReadinessSpec.tsx");
  assert.match(panel, /AiReadinessLead/);
  assert.doesNotMatch(panel, /FenderSpecSummary/);
  assert.doesNotMatch(panel, /missingPagesOnly|missingPageControl/);
});
