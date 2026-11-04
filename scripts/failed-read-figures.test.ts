import assert from "node:assert/strict";
import { test } from "node:test";
import { metricTermAttrs } from "../lib/canvas-sdk/metric-term.ts";
import {
  amazonSpecsHeroes,
  fenderCompletenessHero,
  missingAdditionalPropertyHero,
  pageFoundHero,
} from "../lib/fender-canvas/ai-readiness-lead.ts";
import {
  assembleCanvasBundle,
  BUNDLE_READ_KEYS,
  CANVAS_READS,
  EMPTY_METRICS_ROW,
  failedMetricsRow,
  metricsRowFailure,
  READ_NOT_AVAILABLE,
  readFailure,
  type CanvasReadResult,
} from "../lib/fender-canvas/canvas-reads.ts";
import { buildLiveCommandCenter } from "../lib/fender-canvas/command-center-from-live.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { buildMinimalMetrics } from "../lib/fender-canvas/minimal-metrics.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { MAP_PRICES_NOT_STORED } from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import { buildLiveTourSteps } from "../lib/fender-canvas/tour-from-live.ts";
import type { CanvasBundle, CanvasReadKey } from "../lib/fender-canvas/types.ts";

const METRICS = {
  ...EMPTY_METRICS_ROW,
  catalog_skus: 3598,
  division_count: 13,
  seller_harvested: 400,
  seller_harvested_pct: 11.1,
  bb_total: 1000,
  bb_1p: 85,
  bb_3p: 851,
  bb_unharvested: 20,
  bb_no_offer: 44,
  bb_1p_pct: 8.5,
  active_offer_coverage_pct: 28.5,
  amz_below_map: 55,
  amz_avg_drift: -12.5,
  bundle_reviews: 1200,
  spec_checked: 913,
  spec_fender_found: 99,
  spec_fender_found_pct: 10.8,
  sim_total: 4000,
  sim_resolved: 3885,
  sim_unclear: 80,
  sim_errors: 35,
  sim_win_pct: 82.6,
  sim_hallucinations: 4,
  sim_hallucination_risk: 40,
  weakest_category: "beginner",
  weakest_top_competitor: "Yamaha",
  weakest_sov_gap_pts: -12,
  strongest_category: "electric",
  strongest_win_pct: 90,
  strongest_wins: 90,
  strongest_resolved: 100,
};

function bundle(failed: CanvasReadKey[] = []): CanvasBundle {
  const loaded: CanvasBundle = {
    m: METRICS,
    cats: [{ category: "beginner", fender_win_pct: 58.5, top_competitor: "Yamaha", top_competitor_pct: 20 }],
    engines: [],
    sov: [
      { category: "beginner", competitor: "Yamaha", wins: 20, sov_pct: 66.7 },
      { category: "beginner", competitor: "Fender/Squier", wins: 10, sov_pct: 33.3 },
    ],
    divisions: [],
    missing: [{ field: "color", sku_count: 12, source: "amazon" }],
    fresh: [],
    specPages: null,
    listingContent: null,
  } as CanvasBundle;
  const out: CanvasBundle = { ...loaded, unavailable: {} };
  for (const key of failed) {
    out.unavailable![key] = readFailure(key, `forced ${key} failure`);
    if (key === "m") out.m = failedMetricsRow(out.unavailable![key]!);
    else if (key !== "specPages" && key !== "listingContent") Object.assign(out, { [key]: [] });
  }
  return out;
}

function minimal(b: CanvasBundle) {
  const metrics = buildLiveMetrics(b);
  return buildMinimalMetrics(buildLiveNodes(b, metrics), {
    bundle: b,
    retail: { phase: "loading" },
    ai: { phase: "loading" },
    findability: { phase: "loading" },
    authorizedPartners: null,
    stockLoss: { phase: "loading" },
    amazonFieldTotals: null,
    phaseOne: metrics.phaseOneLift,
    enterprise: metrics.enterprisePotential,
  });
}

const METRICS_TIP = /^The catalog metrics read \(canvas_metrics\) did not load: forced m failure\.$/;

const METRICS_ROW_FIGURES = [
  "activeOfferCoverage",
  "buyBoxRetention",
  "sellerDataCoverage",
  "strandedReviews",
  "amazonMapDrift",
  "overallAiWinRate",
  "resolvedSimulations",
  "confirmedHallucinations",
  "beginnerSovGap",
  "strongestCategorySov",
];

test("a failed metrics read turns every metrics-row figure into Not available* naming canvas_metrics", () => {
  const loaded = buildLiveMetrics(bundle());
  const failed = buildLiveMetrics(bundle(["m"]));
  for (const key of METRICS_ROW_FIGURES) {
    assert.match(loaded[key].value, /\d/, `${key} reads a number when the row loads`);
    assert.equal(failed[key].value, READ_NOT_AVAILABLE, key);
    assert.match(failed[key].detail, METRICS_TIP, key);
    assert.doesNotMatch(`${failed[key].value} ${failed[key].detail}`, /Pending data/, key);
  }
  assert.equal(failed.beginnerAiWinRate.value, loaded.beginnerAiWinRate.value, "the category read still loaded");
  assert.equal(failed.phaseOneLift.value, loaded.phaseOneLift.value, "analyst estimates do not come from the row");
});

test("Not stored MAP prices keep their own reading when the metrics read also fails", () => {
  const retail: RetailCanvasRead = {
    phase: "ready",
    snapshot: {
      headline: null,
      suppressedListings: { status: "unavailable", issueCount: null, missingMessage: null, detail: null },
      mapLeakage: { status: "unavailable", issueCount: null, missingMessage: MAP_PRICES_NOT_STORED, detail: null },
      unnestedBundles: { status: "unavailable", issueCount: null, missingMessage: null, detail: null },
      amazonSpecGaps: { status: "unavailable", issueCount: null, missingMessage: null, detail: null },
    },
  };
  const drift = buildLiveMetrics(bundle(["m"]), retail).amazonMapDrift;
  assert.equal(drift.value, "Not stored");
  assert.equal(drift.detail, MAP_PRICES_NOT_STORED);
});

test("a failed category read turns the beginner AI win rate into Not available* naming canvas_ai_category", () => {
  const metrics = buildLiveMetrics(bundle(["cats"]));
  assert.equal(metrics.beginnerAiWinRate.value, READ_NOT_AVAILABLE);
  assert.match(metrics.beginnerAiWinRate.detail, /\(canvas_ai_category\) did not load: forced cats failure\.$/);
  assert.equal(metrics.overallAiWinRate.value, "82.6%", "the metrics row still loaded");
});

test("a failed share-of-voice read leaves the beginner gap on the stored metrics row", () => {
  const loaded = buildLiveMetrics(bundle()).beginnerSovGap;
  const failed = buildLiveMetrics(bundle(["sov"])).beginnerSovGap;
  assert.equal(failed.value, loaded.value);
  assert.equal(failed.detail, "vs Yamaha in beginner");
  assert.doesNotMatch(failed.detail, /Pending data/);
});

test("the AI Readiness bubble reads Not available* with canvas_metrics in its hover tooltip", () => {
  const b = bundle(["m"]);
  const node = buildLiveNodes(b, buildLiveMetrics(b)).find((item) => item.id === "spoke-specs");
  assert.equal(node?.heroValue?.value, READ_NOT_AVAILABLE);
  assert.equal(node?.heroValue?.label, "fender.com page found");
  assert.equal(node?.status, "warning");
  assert.equal(node?.tooltip.title, READ_NOT_AVAILABLE);
  assert.match(node?.tooltip.desc ?? "", METRICS_TIP);

  const loaded = buildLiveNodes(bundle(), buildLiveMetrics(bundle())).find((item) => item.id === "spoke-specs");
  assert.equal(loaded?.heroValue?.label, "fender.com page found", "the bubble shows the same figure");
  assert.match(String(loaded?.heroValue?.value), /\d/);
  assert.equal(loaded?.tooltip.desc, "", "a loaded bubble keeps no hover box");
});

test("Minimal slots built from the metrics row read Not available* with canvas_metrics as the tooltip", () => {
  const ids = ["briefing-amazon-buy-box", "buy-box-retention", "seller-data-coverage", "stranded-reviews"];
  const loaded = new Map(minimal(bundle()).map((metric) => [metric.id, metric]));
  const failed = new Map(minimal(bundle(["m"])).map((metric) => [metric.id, metric]));
  for (const id of ids) {
    assert.match(loaded.get(id)!.value, /\d/, `${id} reads a number when the row loads`);
    const slot = failed.get(id)!;
    assert.equal(slot.value, READ_NOT_AVAILABLE, id);
    assert.match(slot.reading.missing ?? "", METRICS_TIP, id);
    const attrs = metricTermAttrs(slot.value, slot.reading.missing);
    assert.match(String(attrs["data-ifai-tooltip-desc"]), /canvas_metrics/, `${id} tooltip names the source`);
    assert.equal("title" in attrs, false, `${id} uses the custom tooltip, never a native title`);
  }
  assert.equal(failed.get("spoke-specs")?.value, READ_NOT_AVAILABLE, "the AI Readiness slot follows its bubble");
});

test("the command center prints no division count, loaded or failed", () => {
  const withDivisions = {
    ...bundle(),
    divisions: [{ division: "Electric" }, { division: "Acoustic" }] as CanvasBundle["divisions"],
  };
  for (const b of [bundle(), bundle(["m"]), withDivisions]) {
    assert.doesNotMatch(buildLiveCommandCenter(b).summary, /Pending data|divisions/);
  }
});

test("the tour names a failed missing-field read instead of counting zero rows", () => {
  const line = (b: CanvasBundle) =>
    buildLiveTourSteps(b)
      .find((step) => step.nodeId === "specs")!
      .displays.find((text) => /missing-field rows/.test(text));
  assert.equal(line(bundle()), "1 missing-field rows are on Amazon Specs");
  const failed = line(bundle(["missing"]));
  assert.equal(failed, "Amazon Specs missing-field rows: Not available* (canvas_spec_missing_fields did not load)");
  assert.doesNotMatch(failed ?? "", /\b0\b/);
});

test("the loader's failed metrics row carries its failure; a loaded or plain empty row does not", () => {
  const ok = (data: unknown): PromiseSettledResult<CanvasReadResult> => ({ status: "fulfilled", value: { data, error: null } });
  const reads = Object.fromEntries(BUNDLE_READ_KEYS.map((key) => [key, ok(key === "m" ? METRICS : [])])) as Parameters<
    typeof assembleCanvasBundle
  >[0];
  const pages = {
    specPages: { status: "fulfilled", value: null } as unknown as PromiseSettledResult<never>,
    listingContent: { status: "fulfilled", value: null } as unknown as PromiseSettledResult<never>,
  };
  const failed = assembleCanvasBundle(
    { ...reads, m: { status: "fulfilled", value: { data: null, error: { message: "forced" } } } },
    pages,
  );
  assert.deepEqual(failed.m, EMPTY_METRICS_ROW);
  assert.equal(metricsRowFailure(failed.m)?.source, CANVAS_READS.m.source);
  assert.equal(metricsRowFailure(assembleCanvasBundle(reads, pages).m), null);
  assert.equal(metricsRowFailure(EMPTY_METRICS_ROW), null);
});

test("AI Readiness heroes on a failed metrics row read Not available* and name canvas_metrics in the definition", () => {
  const failed = bundle(["m"]).m;
  const heroes = [
    pageFoundHero(failed),
    fenderCompletenessHero(failed),
    missingAdditionalPropertyHero(failed),
    ...amazonSpecsHeroes(failed, { found: 800, expected: 1000 }),
  ];
  for (const hero of heroes) {
    assert.equal(hero.percent, READ_NOT_AVAILABLE, hero.id);
    assert.match(hero.definition ?? "", /^The catalog metrics read \(canvas_metrics\) did not load: forced m failure\. /, hero.id);
    assert.equal(hero.ratio, null, `${hero.id} shows no N of M beside a figure it cannot show`);
    assert.equal(hero.pie, null, hero.id);
  }

  const loaded = amazonSpecsHeroes(METRICS, { found: 800, expected: 1000 })[0];
  assert.doesNotMatch(loaded.definition ?? "", /canvas_metrics/);
  assert.equal(pageFoundHero(METRICS).percent, "10.8%");
  assert.equal(pageFoundHero(EMPTY_METRICS_ROW).percent, "Pending data", "an unstored figure is not a failed read");
});

test("AI Readiness Minimal slots name the failed read that feeds them", () => {
  const slots = (b: CanvasBundle) => new Map(minimal(b).map((metric) => [metric.id, metric]));
  const cases: [CanvasReadKey, string, string[]][] = [
    ["m", "canvas_metrics", ["amazon-specs-completeness", "spoke-specs"]],
    ["specPages", "canvas_spec_readiness", ["sat-schema", "brand-site-product-basics"]],
    ["listingContent", "canvas_listing_content", ["sat-tables", "aplus-content", "aplus-video"]],
  ];
  const loaded = slots(bundle());
  for (const [key, source, ids] of cases) {
    const failed = slots(bundle([key]));
    for (const id of ids) {
      const slot = failed.get(id);
      assert.ok(slot, `${id} is offered`);
      assert.equal(slot.value, READ_NOT_AVAILABLE, id);
      assert.match(slot.reading.missing ?? "", new RegExp(`\\(${source}\\) did not load`), id);
      assert.doesNotMatch(loaded.get(id)?.reading.missing ?? "", new RegExp(source), `${id} names no failure when it loaded`);
    }
  }
});
