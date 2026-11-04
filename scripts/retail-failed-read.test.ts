// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/retail-failed-read.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { activeOffersLine, briefingFindingsLead } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { failedMetricsRow, readFailure } from "../lib/fender-canvas/canvas-reads.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { buildMinimalMetrics } from "../lib/fender-canvas/minimal-metrics.ts";
import { RETAIL_ENTRIES } from "../lib/fender-canvas/minimal-metrics-retail.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { activeOfferClarity } from "../lib/fender-canvas/offer-clarity.ts";
import {
  loadPortfolioRetailSnapshot,
  type CatalogBundleRow,
  type MapLeakageRow,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import { retailTemplateVars } from "../lib/fender-canvas/retail-copy.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";

const METRICS_FAILURE = readFailure("m", { message: 'forced "canvas_metrics" failure' });
const NAMED = /The catalog metrics read \(canvas_metrics\) did not load/;
const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function loadedBundle(): CanvasBundle {
  return {
    m: { bb_1p: 6, bb_3p: 30, bb_unharvested: 4, bb_no_offer: 10, catalog_bundles: 945 } as CanvasMetricsRow,
    cats: [],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: [],
  };
}

function failedBundle(): CanvasBundle {
  return { ...loadedBundle(), m: failedMetricsRow(METRICS_FAILURE), unavailable: { m: METRICS_FAILURE } };
}

function suppression(asin: string, withheld: boolean): SuppressionSupportRow {
  return {
    asin,
    offer_price: 200,
    featured_offer_state: withheld ? "withheld" : "present",
    featured_offer_withheld: withheld,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: withheld ? 20000 : 9000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

const mapRow = (leak: number): MapLeakageRow => ({ map_price: 100, offer_price: 100 + leak, amz_leakage: leak, wmt_leakage: null, mf_leakage: null });

function bundleRow(asin: string, parent: string | null): CatalogBundleRow {
  return { asin, model_name: asin, title: null, bundle_name: null, parent_asin: parent, product_url: null, is_bundle: true, featured_offer_state: "present" };
}

/** The retail snapshot as the browser loads it; `metricsFailed` fails its canvas_metrics catalog-count read. */
async function retail(metricsFailed: boolean): Promise<RetailCanvasRead> {
  const snapshot = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({ ok: true, rows: [suppression("B0A", true), suppression("B0B", false)], truncated: false }),
    mapRows: async () => ({ ok: true, rows: [mapRow(-10), mapRow(5), mapRow(0)], truncated: false }),
    catalogRows: async () => ({ ok: true, rows: [bundleRow("B000000001", null), bundleRow("B000000002", "B0PARENT01")], truncated: false }),
    catalogBundleCount: async () => (metricsFailed ? METRICS_FAILURE : 945),
    specRows: async () => ({ ok: true, rows: [{ asin: "B0S", title: "S", amazon_checked: true, amazon_missing_fields: null }], truncated: false }),
  });
  return { phase: "ready", snapshot };
}

const BAD = /Pending data|not stored|^0(\.0)?%?$/i;

test("Active offers reads Not available* naming canvas_metrics when that read failed", () => {
  const line = activeOffersLine(failedBundle());
  assert.match(line, /^<span class="ifai-term" /);
  assert.match(line, />Not available\*<\/span>$/);
  assert.match(line, /data-ifai-tooltip-title="Not available\*"/);
  assert.match(line, /data-ifai-tooltip-desc="The catalog metrics read \(canvas_metrics\) did not load: forced &quot;canvas_metrics&quot; failure\."/);
  assert.match(line, /data-read-unavailable="canvas_metrics"/);
  assert.match(line, /tabindex="0"/);
  assert.doesNotMatch(line, /\stitle=|offer split is not stored|Pending data|\b0 listings/);
  assert.equal(retailTemplateVars(failedBundle(), { phase: "loading" }).active_offer_clarity, line);
});

test("Active offers keeps the stored offer split when canvas_metrics loaded", () => {
  const b = loadedBundle();
  assert.equal(activeOffersLine(b), activeOfferClarity(b.m));
  assert.match(activeOffersLine(b), /^40 listings have an active Amazon offer\./);
});

test("Briefing retail lead with canvas_metrics failed: every figure keeps its retail-read value, never zero or Pending data", async () => {
  const healthy = briefingFindingsLead(await retail(false), { phase: "loading" }, { phase: "loading" });
  const failed = briefingFindingsLead(await retail(true), { phase: "loading" }, { phase: "loading" });
  for (const id of ["buy_box", "map_leakage", "splintered_bundles"] as const) {
    const before = healthy.findings.find((f) => f.id === id)!;
    const after = failed.findings.find((f) => f.id === id)!;
    assert.equal(after.percent, before.percent, id);
    assert.equal(after.ratio, before.ratio, id);
    assert.notEqual(after.percent, "Not available*", `${id} is built from canvas_retail_listings, not canvas_metrics`);
    assert.doesNotMatch(after.percent, BAD, id);
    assert.doesNotMatch(after.ratio ?? "", /Pending data/, id);
  }
  const bundles = failed.findings.find((f) => f.id === "splintered_bundles")!;
  assert.equal(bundles.ratio, "1 of 2 bundles with a live offer");
  assert.match(bundles.tip ?? "", NAMED);
  assert.match(bundles.tip ?? "", /The catalog's own bundle total is not shown\./);
  assert.doesNotMatch(bundles.tip ?? "", /out of \d+ the catalog flags/);
  const healthyTip = healthy.findings.find((f) => f.id === "splintered_bundles")!.tip ?? "";
  assert.match(healthyTip, /out of 945 the catalog flags/);
  assert.doesNotMatch(healthyTip, /did not load/);
});

function minimalSlots(b: CanvasBundle, read: RetailCanvasRead) {
  const metrics = buildLiveMetrics(b, read, { phase: "loading" });
  const nodes = buildLiveNodes(b, metrics, read, { phase: "loading" }, { phase: "loading" });
  return buildMinimalMetrics(nodes, {
    bundle: b,
    retail: read,
    ai: { phase: "loading" },
    findability: { phase: "loading" },
    authorizedPartners: null,
    stockLoss: { phase: "ready", rows: [], populationCount: 0 },
    amazonFieldTotals: null,
    phaseOne: metrics.phaseOneLift,
    enterprise: metrics.enterprisePotential,
  });
}

test("Minimal retail slots with canvas_metrics failed: each keeps its retail-read figure, and the bundle slot names the read", async () => {
  const healthy = minimalSlots(loadedBundle(), await retail(false));
  const failed = minimalSlots(failedBundle(), await retail(true));
  const ids = RETAIL_ENTRIES.map((entry) => entry.id).filter((id) => failed.some((slot) => slot.id === id));
  assert.ok(ids.includes("sat-asin") && ids.includes("spoke-retail") && ids.includes("sat-map"));
  for (const id of ids) {
    const before = healthy.find((slot) => slot.id === id)!;
    const after = failed.find((slot) => slot.id === id)!;
    assert.equal(after.value, before.value, id);
    assert.equal(after.reading.ratio, before.reading.ratio, id);
    assert.doesNotMatch(after.value, /Pending data/, id);
    assert.doesNotMatch(after.reading.ratio ?? "", /Pending data/, id);
    assert.doesNotMatch(after.reading.missing ?? "", /Pending data|offer split is not stored/, id);
  }
  const asin = failed.find((slot) => slot.id === "sat-asin")!;
  assert.equal(asin.reading.ratio, "1 of 2 bundles with a live offer");
  assert.match(asin.reading.tip ?? "", NAMED);
});
