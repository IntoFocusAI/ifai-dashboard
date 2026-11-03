// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/minimal-view.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { aiMetrics } from "../lib/ai-search/canvas-surfaces.ts";
import { historyFixtureSnapshots } from "../lib/ai-search/history-fixtures.ts";
import type { AiSearchRead } from "../lib/ai-search/types.ts";
import { EMPTY_METRIC_SLOTS, reviveMetricSlots } from "../lib/canvas-sdk/metric-slots.ts";
import { reviveViewMode } from "../lib/canvas-sdk/useCanvasViewMode.ts";
import type { CanvasNode } from "../lib/canvas-sdk/types.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { buildMinimalMetrics, NOT_AVAILABLE } from "../lib/fender-canvas/minimal-metrics.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import {
  mapLeakageFinding,
  selectRetailHeadline,
  suppressedListingsFinding,
  unnestedBundlesFinding,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { RETAIL_PANEL_TABS, type RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const spec = JSON.parse(read("data/fender-v3-spec.json")) as { spokes: Record<string, { tabs: string[] }> };

/** The substring rule CanvasShell uses to open a tab. */
function openedTab(spokeId: string, subTab: string | undefined): string | null {
  const tabs = spokeId === "ecommerce" ? [...RETAIL_PANEL_TABS] : spec.spokes[spokeId]?.tabs ?? [];
  if (!subTab) return null;
  return tabs.find((tab) => tab.toLowerCase().includes(subTab.toLowerCase())) ?? null;
}

function bundle(): CanvasBundle {
  return {
    m: { catalog_skus: 3598, spec_checked: 925, spec_fender_found: 123, spec_fender_found_pct: 13.3 } as CanvasMetricsRow,
    cats: [],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: [],
  };
}

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function buyBoxRow(asin: string, withheld: boolean) {
  return {
    asin,
    offer_price: 949.99,
    featured_offer_state: withheld ? "withheld" : "present",
    featured_offer_withheld: withheld,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 84999,
    featured_offer_observed_price_cents: withheld ? 94999 : 84999,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: withheld ? null : "ATVPDKIKX0DER",
  } as Parameters<typeof suppressedListingsFinding>[0][number];
}

function retailReady(): RetailCanvasRead {
  const findings = {
    suppressedListings: suppressedListingsFinding([buyBoxRow("B0A", true), buyBoxRow("B0B", false), buyBoxRow("B0C", false)]),
    mapLeakage: mapLeakageFinding([
      { map_price: 100, offer_price: 80, amz_leakage: -20, wmt_leakage: null, mf_leakage: null },
      { map_price: 100, offer_price: 100, amz_leakage: 0, wmt_leakage: null, mf_leakage: null },
    ]),
    unnestedBundles: unnestedBundlesFinding([
      {
        asin: "B000000001",
        model_name: "Player II Stratocaster",
        title: "Fender Player II Stratocaster",
        bundle_name: "Starter kit",
        parent_asin: null,
        product_url: "https://www.amazon.com/dp/B000000001",
        is_bundle: true,
      },
    ]),
    amazonSpecGaps: {
      status: "unavailable" as const,
      issueCount: null,
      missingMessage: "Amazon spec-field readings have not been stored.",
      detail: null,
    },
  };
  return { phase: "ready", snapshot: { ...findings, headline: selectRetailHeadline(findings) } };
}

function findabilityRow(asin: string, state: string) {
  return {
    asin,
    title: asin,
    category: null,
    product_kind: null,
    latest_state: state,
    latest_canonical_url: `https://brand.example/${asin}`,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: 200,
    latest_attempt_at: null,
    jsonld_status: "not_checked",
    counts_as_confirmed: true,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: false,
    counts_as_blocked: false,
    counts_as_timeout: false,
    counts_as_parse_failure: false,
    counts_as_unsupported: false,
  };
}

const findability = {
  phase: "ready",
  dealerBundleLoaded: true,
  rows: [findabilityRow("B00EXACT", "exact_official_product"), findabilityRow("B00FAMILY", "official_family_page")],
} as FindabilityRead;

function aiReady(): AiSearchRead {
  const snapshots = historyFixtureSnapshots();
  const published = snapshots.find((snapshot) => snapshot.run.is_published) ?? snapshots[snapshots.length - 1];
  return { phase: "ready", snapshot: published };
}

/** The same inputs FenderBrandCanvas hands to buildFenderCanvasSpec. */
function build(retail: RetailCanvasRead, ai: AiSearchRead, find: FindabilityRead = findability) {
  const live = buildLiveMetrics(bundle(), retail, find);
  const metrics = Object.assign({}, live, aiMetrics(ai)) as typeof live;
  const nodes = buildLiveNodes(bundle(), metrics, retail, ai, find);
  const slots = buildMinimalMetrics(nodes, {
    bundle: bundle(),
    retail,
    ai,
    findability: find,
    phaseOneDetail: metrics.phaseOneLift.detail,
  });
  return { nodes, slots };
}

function nodeById(nodes: CanvasNode[], id: string) {
  const node = nodes.find((item) => item.id === id);
  assert.ok(node, `map node ${id}`);
  return node;
}

test("Balanced is the default view and anything else stored reads as Balanced", () => {
  assert.equal(reviveViewMode("minimal"), "minimal");
  for (const raw of [undefined, null, "", "balanced", "deep-dive", 1, {}, ["minimal"]]) {
    assert.equal(reviveViewMode(raw), "balanced", JSON.stringify(raw));
  }
});

test("a first visit opens six empty slots", () => {
  assert.deepEqual(EMPTY_METRIC_SLOTS, [null, null, null]);
  assert.deepEqual(reviveMetricSlots(undefined), [null, null, null]);
  assert.deepEqual(reviveMetricSlots("spoke-retail"), [null, null, null]);
  assert.deepEqual(reviveMetricSlots(["spoke-retail", 4, ""]), ["spoke-retail", null, null]);
  const source = read("lib/canvas-sdk/LargeMetricSlots.tsx") + read("lib/canvas-sdk/MinimalView.tsx");
  assert.match(source, /EMPTY_METRIC_SLOTS/);
  const specSource = read("lib/fender-canvas/build-canvas-spec.tsx");
  for (const key of ["canvas-view", "minimal-small", "minimal-large"]) {
    assert.match(specSource, new RegExp(`ifai:fender:${key}:v1:\\$\\{scope\\}`), `${key} is a new per-viewer key`);
  }
  assert.match(specSource, /minimalViewKeys\(options\.metricStorageSuffix \?\? "anonymous"\)/);
});

test("every slot reads the same figure as its map bubble and opens a real tab", () => {
  const { nodes, slots } = build(retailReady(), aiReady());
  assert.ok(slots.length >= 12, `expected a full catalog, got ${slots.length}`);
  for (const slot of slots) {
    const node = nodeById(nodes, slot.id);
    assert.equal(slot.value, node.heroValue?.value, `${slot.id} value`);
    assert.equal(slot.spokeId, node.spokeId, `${slot.id} spoke`);
    assert.equal(slot.tone, node.status, `${slot.id} tone`);
    const tab = openedTab(slot.spokeId, slot.subTab);
    assert.ok(tab, `${slot.id} subTab "${slot.subTab}" opens no tab`);
    assert.equal(tab.toLowerCase(), slot.subTab!.toLowerCase(), `${slot.id} opens "${tab}"`);
  }
  const ids = slots.map((slot) => slot.id);
  assert.equal(new Set(ids).size, ids.length, "one entry per bubble");
  assert.equal(ids.includes("hub"), false);
  assert.equal(ids.includes("spoke-roadmap"), false);
});

test("each live figure says N of M and the larger slots carry the tab's disc", () => {
  const { slots } = build(retailReady(), aiReady());
  const ready = [
    "spoke-retail", "sat-buybox", "sat-map", "sat-asin", "spoke-aeo", "sat-prompts", "sat-citations",
    "sat-drift", "sat-findability", "spoke-competitors", "sat-taylor", "sat-amps",
  ];
  for (const slot of slots) {
    if (slot.provenance === "estimate") continue;
    if (!ready.includes(slot.id)) {
      assert.equal(slot.value, NOT_AVAILABLE, `${slot.id} has no input in this fixture`);
      assert.ok(slot.reading.missing, `${slot.id} explains the missing input`);
      continue;
    }
    const counted = /\d[\d,]* of \d[\d,]*/;
    assert.ok(counted.test(slot.value) || counted.test(slot.reading.ratio ?? ""), `${slot.id} has no N of M`);
    assert.equal(slot.reading.missing, null, `${slot.id} should be ready`);
  }
  const withDisc = new Set(slots.filter((slot) => slot.reading.pie).map((slot) => slot.id));
  for (const id of ["spoke-retail", "sat-map", "sat-asin", "sat-findability", "sat-drift", "sat-prompts"]) {
    assert.ok(withDisc.has(id), `${id} carries its tab disc`);
  }
  for (const slot of slots) {
    const pie = slot.reading.pie;
    if (!pie) continue;
    assert.equal(pie.slices.reduce((sum, slice) => sum + slice.count, 0), pie.total, `${slot.id} disc adds up`);
  }
  const retail = slots.find((slot) => slot.id === "spoke-retail");
  assert.equal(retail?.reading.ratio, "1 of 3 current Buy Box readings");
  const taylor = slots.find((slot) => slot.id === "sat-taylor");
  assert.ok(taylor && /^\d+ of \d+$/.test(taylor.value));
  assert.equal(taylor.reading.ratio, "resolved unbranded discovery answers", "the count is not repeated under the value");
});

test("a missing input reads Not available* or the bubble's waiting word, with a reason for the tooltip", () => {
  const { nodes, slots } = build({ phase: "loading" }, { phase: "error", message: "down" });
  for (const id of ["spoke-retail", "sat-map", "spoke-aeo", "sat-drift"]) {
    const slot = slots.find((item) => item.id === id);
    assert.ok(slot, id);
    assert.equal(slot.value, nodeById(nodes, id).heroValue?.value, `${id} still matches the map`);
    assert.ok(slot.reading.missing, `${id} explains the missing input`);
    assert.equal(slot.reading.ratio, null);
    assert.equal(slot.reading.pie, null);
    assert.doesNotMatch(slot.value, /^0(\.0)?%$/, `${id} never invents a zero`);
  }
  const specs = slots.find((slot) => slot.id === "sat-schema");
  if (specs && /not available/i.test(specs.value)) assert.equal(specs.value, NOT_AVAILABLE);
  const source = read("lib/canvas-sdk/LargeMetricSlots.tsx") + read("lib/canvas-sdk/MetricWidgets.tsx");
  assert.match(source, /data-ifai-tooltip-desc/);
  assert.match(source, /ifai-term/);
});

test("Phase 1 stays an analyst estimate and nothing mentions fees", () => {
  const { slots } = build(retailReady(), aiReady());
  const phaseOne = slots.find((slot) => slot.id === "spoke-fixes");
  assert.ok(phaseOne);
  assert.equal(phaseOne.provenance, "estimate");
  assert.match(phaseOne.detail, /^Analyst estimate\./);
  assert.equal(phaseOne.subTab, "Revenue Estimates");
  const copy = slots.flatMap((slot) => [slot.label, slot.detail, slot.reading.ratio ?? "", slot.reading.missing ?? ""]).join("\n");
  assert.doesNotMatch(copy, /\bfees?\b|retainer|monthly charge|service-fee|\bROI\b/i);
  assert.doesNotMatch(copy, /\u2014/, "no em dash in client copy");
});

test("the switch offers only Minimal and Balanced and the shell wiring stays minimal", () => {
  const files = [
    "lib/canvas-sdk/ViewModeSwitch.tsx",
    "lib/canvas-sdk/MinimalView.tsx",
    "lib/canvas-sdk/LargeMetricSlots.tsx",
    "lib/canvas-sdk/MetricPicker.tsx",
    "lib/canvas-sdk/MetricWidgets.tsx",
    "lib/fender-canvas/minimal-metrics.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /deep dive|deep-dive|ask intofocus/i, file);
    assert.doesNotMatch(source, /\u2014/, `${file} has no em dash`);
    if (file.endsWith(".tsx")) assert.ok(source.split("\n").length <= 400, `${file} stays at or under 400 lines`);
  }
  const toggle = read("lib/canvas-sdk/ViewModeSwitch.tsx");
  assert.deepEqual([...toggle.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Minimal", "Balanced"]);

  const shell = read("lib/canvas-sdk/CanvasShell.tsx");
  assert.match(shell, /<ViewModeSwitch views=\{views\} \/>\s*\{spec\.headerSlot\}/);
  assert.match(shell, /<MinimalView views=\{views\} spokes=\{spec\.spokes\} onOpenMetric=\{focusNode\} \/>/);
  assert.match(shell, /<HubSlots feeds=\{spec\.hubSlots\} bubbleId=\{inspectedBubbleId\} onOpen=\{focusNode\} \/>/);
  assert.ok(shell.split("\n").length <= 1593, "CanvasShell does not grow");
});
