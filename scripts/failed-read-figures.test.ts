import assert from "node:assert/strict";
import { test } from "node:test";
import { metricTermAttrs } from "../lib/canvas-sdk/metric-term.ts";
import { EMPTY_METRICS_ROW, READ_NOT_AVAILABLE, readFailure } from "../lib/fender-canvas/canvas-reads.ts";
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
    if (key === "m") out.m = EMPTY_METRICS_ROW;
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

test("the command center drops the division sentence instead of printing Pending data", () => {
  const failed = buildLiveCommandCenter(bundle(["m"])).summary;
  assert.doesNotMatch(failed, /Pending data|divisions/);

  const fromDivisions = buildLiveCommandCenter({
    ...bundle(["m"]),
    divisions: [{ division: "Electric" }, { division: "Acoustic" }] as CanvasBundle["divisions"],
  }).summary;
  assert.match(fromDivisions, /The catalog read covers 2 divisions\./);
  assert.match(buildLiveCommandCenter(bundle()).summary, /The catalog read covers 13 divisions\./);
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
