import assert from "node:assert/strict";
import { test } from "node:test";
import { beginnerSovLine } from "../lib/fender-canvas/beginner-sov.ts";
import { buildLiveCommandCenter } from "../lib/fender-canvas/command-center-from-live.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { groupHallucinationCauses } from "../lib/fender-canvas/hallucination-causes.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { activeOfferClarity } from "../lib/fender-canvas/offer-clarity.ts";
import { MAP_PRICES_NOT_STORED } from "../lib/fender-canvas/portfolio-retail.ts";
import { headlineSentence, headlineSurface } from "../lib/fender-canvas/portfolio-retail-display.ts";
import { bundleReadLine, mapReadLine } from "../lib/fender-canvas/retail-copy.ts";
import { buildLiveTourSteps } from "../lib/fender-canvas/tour-from-live.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";

function bundle(): CanvasBundle {
  return {
    m: {
      catalog_skus: 3598,
      catalog_bundles: 941,
      seller_harvested: 1025,
      seller_harvested_pct: 28.5,
      division_count: 13,
      bb_total: 1025,
      bb_1p: 85,
      bb_3p: 851,
      bb_unharvested: 68,
      bb_no_offer: 21,
      bb_1p_pct: 8.3,
      bb_3p_pct: 83,
      bb_unharvested_pct: 6.6,
      active_offer_coverage_pct: 28.5,
      amz_below_map: 455,
      amz_avg_drift: -10,
      wmt_checked: 1,
      wmt_leaks: 1,
      mf_checked: 1,
      mf_leaks: 1,
      offamz_avg_leak: -5,
      map_violation_skus: 533,
      bundle_reviews: null,
      spec_checked: 913,
      spec_avg_amazon_pct: 91.8,
      spec_fender_found: 99,
      spec_fender_found_pct: 10.8,
      spec_avg_fender_pct: 87.5,
      spec_missing_additional_property: 99,
      spec_missing_field_types: 13,
      sim_total: 4287,
      sim_runs: 522,
      sim_resolved: 3885,
      sim_wins: 3209,
      sim_win_pct: 82.6,
      sim_unclear: 260,
      sim_errors: 142,
      sim_hallucinations: 222,
      sim_hallucination_risk: 630,
      weakest_category: "beginner",
      weakest_win_pct: 58.5,
      weakest_top_competitor: "Yamaha",
      weakest_competitor_pct: 38.7,
      weakest_sov_gap_pts: 19.9,
      strongest_category: "hallucinations",
      strongest_win_pct: 100,
      strongest_wins: 587,
      strongest_resolved: 587,
    },
    cats: [],
    engines: [],
    sov: [
      {
        category: "beginner",
        competitor: "Yamaha",
        wins: 2,
        category_resolved: 3,
        sov_pct: 66.7,
      },
      {
        category: "beginner",
        competitor: "Fender/Squier",
        wins: 1,
        category_resolved: 3,
        sov_pct: 33.3,
      },
    ],
    divisions: Array.from({ length: 13 }, (_, index) => ({
      division: `Division ${index + 1}`,
      monitored_skus: 10,
      buybox_pct: null,
      splinter_bundles: null,
      schema_sync_pct: null,
      primary_threat: null,
      strategic_action: null,
    })),
    missing: [],
    fresh: [],
  };
}

test("beginner share of voice uses the stored competitor percents", () => {
  const line = beginnerSovLine(bundle().sov);
  assert.equal(line, "Yamaha 66.7% vs Fender/Squier 33.3%");
});

function retailReady(): RetailCanvasRead {
  return {
    phase: "ready",
    snapshot: {
      headline: null,
      suppressedListings: {
        status: "available_with_issues",
        issueCount: 48,
        missingMessage: null,
        detail: null,
      },
      mapLeakage: {
        status: "available_with_issues",
        issueCount: 555,
        missingMessage: null,
        detail: null,
      },
      unnestedBundles: {
        status: "available_with_issues",
        issueCount: 12,
        missingMessage: null,
        detail: null,
      },
      amazonSpecGaps: {
        status: "unavailable",
        issueCount: null,
        missingMessage: "Amazon spec-field readings have not been stored.",
        detail: null,
      },
    },
  };
}

test("A+ Matrix reads listing content and never borrows Amazon attribute completeness", () => {
  const retail = retailReady();
  const metrics = buildLiveMetrics(bundle(), retail);
  const nodes = buildLiveNodes(bundle(), metrics, retail);
  const satellite = nodes.find((node) => node.id === "sat-tables");
  const readiness = nodes.find((node) => node.id === "spoke-specs");
  assert.ok(satellite);
  assert.ok(readiness);
  assert.equal(satellite.title, "Amazon A+ Matrix");
  assert.deepEqual(satellite.heroValue, { value: "Not available*", label: "Five bullets filled" });
  assert.equal(satellite.tooltip.desc, "");
  const satelliteText = [
    satellite.meta,
    satellite.tooltip.title,
    satellite.tooltip.desc,
    satellite.heroValue?.value,
    satellite.heroValue?.label,
    ...satellite.stats,
  ]
    .filter(Boolean)
    .join(" ");
  assert.match(satelliteText, /Not available/);
  assert.doesNotMatch(satelliteText, /91\.8%/);

  assert.deepEqual(readiness.heroValue, { value: "10.8%", label: "fender.com page found" });
  assert.equal(readiness.status, "danger");
  assert.equal(metrics.machineReadableSpecs.label, "fender.com Spec Block");
  assert.equal(metrics.machineReadableSpecs.value, "Not available*");
  assert.doesNotMatch(metrics.machineReadableSpecs.detail ?? "", /Amazon/);

  const item = buildLiveCommandCenter(bundle(), retail).items.find((row) => row.id === "aplus-tables");
  assert.ok(item);
  const itemText = [item.title, item.why, item.impact].filter(Boolean).join(" ");
  assert.match(itemText, /listing-content read could not be loaded/);
  assert.doesNotMatch(itemText, /91\.8%|%/);
  assert.doesNotMatch(itemText, /Fender/);
});

test("command center uses the retail headline and drops unsourced claims", () => {
  const retail = retailReady();
  const spec = buildLiveCommandCenter(bundle(), retail);
  const text = [spec.desc, spec.summary, ...spec.items.flatMap((item) => [item.title, item.why, item.impact])]
    .filter(Boolean)
    .join("\n");
  const headline = headlineSentence(headlineSurface(retail));
  const map = spec.items.find((item) => item.id === "map-leakage");

  assert.doesNotMatch(text, /3,598/);
  assert.doesNotMatch(text, /electric SKUs|monitored electric SKUs/i);
  assert.ok(text.includes(headline));
  assert.doesNotMatch(text, /\bdivisions?\b/i);
  // AI Search lines come from the published run only, never the pooled canvas_metrics sim_* fields.
  assert.doesNotMatch(text, /222|630|hallucination|Yamaha 66\.7%/i);
  assert.doesNotMatch(text, /8\.3%/);
  assert.doesNotMatch(text, /3,430|993|7\.4%|16\.7%|Fourteen|14 catalog|2,420|fingerboard|dual humbucker/i);
  assert.doesNotMatch(text, /discounted bundles are dragging/i);
  assert.deepEqual(
    spec.items.map((item) => item.id),
    ["buybox-suppression", "schema-coverage", "map-leakage", "aplus-tables"],
  );
  assert.equal(map?.title, "555 listings are below MAP in this listing read");
  assert.equal(map?.subTab, "MAP");
  assert.match(map?.why ?? "", /Open the MAP tab/);
  assert.doesNotMatch(map?.why ?? "", /not a final count/);
});

test("command center MAP item repeats the MAP tab's partial reading", () => {
  const retail = retailReady();
  if (retail.phase !== "ready") throw new Error("expected a ready retail read");
  const missingMessage =
    "MAP leakage is stored for 3 of 4 listings. 12 stored listings are below MAP. 1 listing has a price and no stored MAP comparison, so it is missing from this count and is not counted as zero. This is not a final count.";
  retail.snapshot.mapLeakage = {
    status: "incomplete",
    issueCount: 12,
    missingMessage,
    detail: null,
  };
  const map = buildLiveCommandCenter(bundle(), retail).items.find((item) => item.id === "map-leakage");
  assert.equal(map?.title, "12 listings are below MAP in this listing read");
  assert.equal(map?.why, missingMessage);
  assert.doesNotMatch(`${map?.title} ${map?.why}`, /discounted bundle/i);
});

test("hub offer arithmetic does not pair the 1P count with the harvested percentage", () => {
  const text = activeOfferClarity({
    ...bundle().m,
    bb_1p: 67,
    bb_3p: 871,
    bb_unharvested: 66,
    bb_no_offer: 25,
    catalog_skus: 3598,
    seller_harvested_pct: 28.6,
  });
  assert.match(text, /1,004 listings have an active Amazon offer/);
  assert.match(text, /67 of 1,004 \(6\.7%\)/);
  assert.match(text, /871 of 1,004 \(86\.8%\)/);
  assert.match(text, /66 of 1,004 offers have no stored seller name \(6\.6%\)/);
  assert.match(text, /25 listings have no Amazon offer/);
  assert.match(text, /not part of the active-offer count/);
  assert.doesNotMatch(text, /28\.6%/);
  assert.doesNotMatch(text, /67 of 3,598/);
  assert.match(text, /Buy Box/);
});

test("the MAP violations widget follows the listing read", () => {
  const ready = buildLiveMetrics(bundle(), retailReady()).flaggedAsins;
  assert.equal(ready.label, "MAP violations");
  assert.equal(ready.value, "555");
  assert.equal(ready.subTab, "MAP");
  assert.doesNotMatch(ready.detail, /48/);

  const failed = buildLiveMetrics(bundle(), { phase: "error" }).flaggedAsins;
  assert.equal(failed.value, "Unavailable");
  assert.doesNotMatch(failed.value, /533/);
  assert.match(failed.detail, /did not succeed/);
});

test("missing MAP prices do not become a below-MAP count or an average gap", () => {
  const retail = retailReady();
  if (retail.phase !== "ready") throw new Error("expected a ready retail read");
  retail.snapshot.mapLeakage = {
    status: "unavailable",
    issueCount: null,
    missingMessage: MAP_PRICES_NOT_STORED,
    detail: null,
  };
  const mapItem = buildLiveCommandCenter(bundle(), retail).items.find((row) => row.id === "map-leakage");
  const itemText = [mapItem?.title, mapItem?.why, mapItem?.impact].filter(Boolean).join(" ");
  assert.equal(mapItem?.title, MAP_PRICES_NOT_STORED);
  assert.match(itemText, /Fender MAP prices have not been stored/);
  assert.doesNotMatch(itemText, /below MAP|average gap|\$|\d/);

  const satellite = buildLiveNodes(bundle(), buildLiveMetrics(bundle(), retail), retail).find(
    (node) => node.id === "sat-map",
  );
  const satelliteText = [
    satellite?.title,
    satellite?.meta,
    satellite?.tooltip.desc,
    satellite?.heroValue?.value,
    satellite?.heroValue?.label,
    ...(satellite?.stats ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  assert.match(satelliteText, /Fender MAP prices have not been stored/);
  assert.equal(satellite?.tooltip.desc, "");
  assert.equal(satellite?.heroValue?.label, "MAP leakage");
  assert.doesNotMatch(satelliteText, /below MAP|gap|\$|\d/);

  const drift = buildLiveMetrics(bundle(), retail).amazonMapDrift;
  assert.equal(drift.value, "Not stored");
  assert.equal(drift.detail, MAP_PRICES_NOT_STORED);
  assert.equal(mapReadLine(retail), MAP_PRICES_NOT_STORED);
});

test("the guided tour uses the same retail headline as the ticker", () => {
  const retail = retailReady();
  const headline = headlineSentence(headlineSurface(retail));
  const steps = buildLiveTourSteps(bundle(), retail);
  const hub = steps.find((step) => step.nodeId === "hub");
  const roadmap = steps.find((step) => step.nodeId === "roadmap");
  assert.ok(hub?.displays.includes(headline));
  assert.ok(roadmap?.displays.includes(headline));
  const text = [...(hub?.displays ?? []), ...(roadmap?.displays ?? []), roadmap?.value ?? ""].join(" ");
  assert.doesNotMatch(text, /Buy Box:|95% Buy Box|6\.5%/);
  assert.equal(mapReadLine(retail), "555 listings are below MAP in this listing read.");
  assert.equal(bundleReadLine(retail), "12 bundles have no usable parent ASIN in this listing read.");
  assert.match(mapReadLine({ phase: "error" }), /does not state a MAP count/);
});

test("hallucination groups are the stored root causes and their row counts", () => {
  const summary = groupHallucinationCauses([
    { root_cause: "Mustang Micro tube claim", engine: "perplexity", category: "hallucinations", prompt: "tubes?" },
    { root_cause: "Mustang Micro tube claim", engine: "gemini", category: "hallucinations", prompt: "tubes?" },
    { root_cause: "Tone Master tube claim", engine: "chatgpt", category: "amps", prompt: "bias?" },
    { root_cause: "Acoustasonic humbucker", engine: "perplexity", category: "acoustics", prompt: "pickups?" },
    { root_cause: "  ", engine: "chatgpt", category: "amps", prompt: "empty" },
  ]);

  assert.equal(summary.flagged, 5);
  assert.equal(summary.missingRootCause, 1);
  assert.deepEqual(
    summary.groups.map((group) => [group.rootCause, group.count]),
    [
      ["Mustang Micro tube claim", 2],
      ["Acoustasonic humbucker", 1],
      ["Tone Master tube claim", 1],
    ],
  );
  assert.equal(
    summary.groups.some((group) => /12-inch|fingerboard/i.test(group.rootCause)),
    false,
  );
});
