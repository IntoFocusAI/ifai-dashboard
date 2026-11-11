// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/suppressed-listings-metric.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { FENDER_METRICS } from "../components/v3/fender-metrics.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import type { RetailReading } from "../lib/fender-canvas/portfolio-retail.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

function bundle(): CanvasBundle {
  return {
    m: {
      catalog_skus: 10,
      catalog_bundles: 1,
      division_count: 1,
    },
    cats: [],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: [],
  } as unknown as CanvasBundle;
}

function reading(
  status: RetailReading<null>["status"],
  issueCount: number | null,
  missingMessage: string | null,
): RetailReading<null> {
  return { status, issueCount, missingMessage, detail: null };
}

function ready(suppressed: RetailReading<null>, map: RetailReading<null> = reading("available_with_issues", 4, null)): RetailCanvasRead {
  return {
    phase: "ready",
    snapshot: {
      headline: null,
      suppressedListings: suppressed,
      mapLeakage: map,
      unnestedBundles: reading("available_with_zero", 0, null),
      amazonSpecGaps: reading("unavailable", null, "Amazon spec-field readings have not been stored."),
    },
  };
}

test("Suppressed Listings keeps every read state and does not invent a zero", () => {
  const loading = buildLiveMetrics(bundle(), { phase: "loading" }).suppressedListings;
  assert.equal(loading.id, "suppressed-listings");
  assert.equal(loading.label, "Suppressed Listings");
  assert.equal(loading.subTab, "Suppressed Listings");
  assert.equal(loading.spokeId, "ecommerce");
  assert.equal(loading.value, "Loading");
  assert.notEqual(loading.value, "0");

  const failed = buildLiveMetrics(bundle(), { phase: "error" }).suppressedListings;
  assert.equal(failed.value, "Unavailable");
  assert.match(failed.detail, /did not succeed/);
  assert.notEqual(failed.value, "0");

  const missingMessage = "The Buy Box audit has not stored a reading for any monitored listing yet.";
  const unavailable = buildLiveMetrics(
    bundle(),
    ready(reading("unavailable", null, missingMessage)),
  ).suppressedListings;
  assert.equal(unavailable.value, "Unavailable");
  assert.equal(unavailable.detail, missingMessage);
  assert.doesNotMatch(unavailable.value, /\b0\b/);

  const incomplete = buildLiveMetrics(
    bundle(),
    ready(reading("incomplete", 12, "Coverage is still finishing.")),
  ).suppressedListings;
  assert.equal(incomplete.value, "12");
  assert.match(incomplete.detail, /not a final count/);
  assert.equal(incomplete.tone, "danger");

  const incompleteZero = buildLiveMetrics(
    bundle(),
    ready(reading("incomplete", 0, "Coverage is still finishing.")),
  ).suppressedListings;
  assert.equal(incompleteZero.value, "0");
  assert.match(incompleteZero.detail, /not a final count/);
  assert.equal(incompleteZero.tone, "warning");

  const storedZero = buildLiveMetrics(
    bundle(),
    ready(reading("available_with_zero", 0, null)),
  ).suppressedListings;
  assert.equal(storedZero.value, "0");
  assert.equal(storedZero.tone, "success");
  assert.match(storedZero.detail, /No suppressed listings/);
  assert.doesNotMatch(storedZero.detail, /not a final count|Unavailable|\$/);

  const positive = buildLiveMetrics(
    bundle(),
    ready(reading("available_with_issues", 42, null)),
  ).suppressedListings;
  assert.equal(positive.value, "42");
  assert.equal(positive.tone, "danger");
  assert.equal(positive.subTab, "Suppressed Listings");
  assert.doesNotMatch(`${positive.value} ${positive.detail}`, /\$|35%|month|quarter|annual/i);
});

test("MAP violations stay a separate metric", () => {
  const retail = ready(reading("available_with_issues", 42, null), reading("available_with_issues", 9, null));
  const metrics = buildLiveMetrics(bundle(), retail);
  assert.equal(metrics.flaggedAsins.id, "flagged-asins");
  assert.equal(metrics.flaggedAsins.label, "MAP violations");
  assert.equal(metrics.flaggedAsins.subTab, "MAP Leakage");
  assert.equal(metrics.flaggedAsins.value, "9");
  assert.notEqual(metrics.flaggedAsins.id, metrics.suppressedListings.id);
  assert.equal(metrics.suppressedListings.value, "42");

  assert.equal(FENDER_METRICS.flaggedAsins.label, "MAP violations");
  assert.equal(FENDER_METRICS.flaggedAsins.subTab, "MAP Leakage");
  assert.equal(FENDER_METRICS.suppressedListings.id, "suppressed-listings");
  assert.equal(FENDER_METRICS.suppressedListings.label, "Suppressed Listings");
  assert.equal(FENDER_METRICS.suppressedListings.subTab, "Suppressed Listings");
  assert.notEqual(FENDER_METRICS.suppressedListings.value, "0");
  assert.equal(
    FENDER_METRICS.suppressedListings.spokeId,
    metrics.suppressedListings.spokeId,
  );
});
