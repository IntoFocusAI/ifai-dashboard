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
import { commerceInputsFromLive, consensusFromLive } from "../lib/fender-canvas/consensus-scores-from-live.ts";
import { commerceScore } from "../lib/fender-canvas/consensus-scores.ts";
import { formatPct, formatUsd } from "../lib/fender-canvas/format.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import {
  buildMinimalMetrics,
  MINIMAL_ENTRIES,
  NOT_AVAILABLE,
  type StockLossRead,
} from "../lib/fender-canvas/minimal-metrics.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import type { StockLossRow } from "../lib/fender-canvas/stock-loss.ts";
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

function stockRow(asin: string, lost365: number | null): StockLossRow {
  return {
    asin,
    title: asin,
    featured_offer_state: "present",
    offline_now: false,
    current_oos_days: 0,
    smartscout_snapshot_date: null,
    smartscout_monthly_revenue: null,
    smartscout_ttm_revenue: null,
    history_through: null,
    in_stock_days_30: null,
    oos_days_30: 1,
    oos_days_90: 2,
    observed_days_365: 365,
    in_stock_days_365: 300,
    oos_days_365: 5,
    no_buy_box_days_365: 0,
    revenue_source: lost365 == null ? null : "smartscout",
    baseline_method: lost365 == null ? null : "smartscout_ttm",
    in_stock_days_used: 300,
    baseline_daily_revenue: null,
    est_lost_revenue_oos_30: lost365,
    est_lost_revenue_oos_90: lost365,
    est_lost_revenue_oos_365: lost365,
    awaiting_inputs_reason: lost365 == null ? "no_sales_source" : null,
  };
}

const stockReady: StockLossRead = {
  phase: "ready",
  rows: [stockRow("B0S1", 1200.5), stockRow("B0S2", 300), stockRow("B0S3", null)],
  populationCount: 10,
};

type Extra = { stockLoss?: StockLossRead; authorizedPartners?: readonly string[] | null; b?: CanvasBundle };

/** The same inputs FenderBrandCanvas hands to buildFenderCanvasSpec. */
function build(retail: RetailCanvasRead, ai: AiSearchRead, find: FindabilityRead = findability, extra: Extra = {}) {
  const b = extra.b ?? bundle();
  const live = buildLiveMetrics(b, retail, find);
  const metrics = Object.assign({}, live, aiMetrics(ai)) as typeof live;
  const nodes = buildLiveNodes(b, metrics, retail, ai, find);
  const slots = buildMinimalMetrics(nodes, {
    bundle: b,
    retail,
    ai,
    findability: find,
    authorizedPartners: extra.authorizedPartners ?? null,
    stockLoss: extra.stockLoss ?? stockReady,
    amazonFieldTotals: null,
    phaseOne: metrics.phaseOneLift,
    enterprise: metrics.enterprisePotential,
  });
  return { nodes, slots };
}

function slotById(slots: ReturnType<typeof build>["slots"], id: string) {
  const slot = slots.find((item) => item.id === id);
  assert.ok(slot, `slot ${id}`);
  return slot;
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

const AREA_ORDER = ["hub", "ecommerce", "aeo", "specs", "competitors", "suggestions"];

test("the list offers most headline figures, grouped by area, and each opens a tab that shows it", () => {
  const { nodes, slots } = build(retailReady(), aiReady());
  assert.ok(slots.length >= 38, `expected most headline figures, got ${slots.length}`);
  const ids = slots.map((slot) => slot.id);
  assert.equal(new Set(ids).size, ids.length, "each option once");
  assert.equal(new Set(MINIMAL_ENTRIES.map((entry) => entry.id)).size, MINIMAL_ENTRIES.length, "entry ids are unique");
  const areas = slots.map((slot) => AREA_ORDER.indexOf(slot.spokeId));
  assert.ok(areas.every((area) => area >= 0), "every option sits in one of the six areas");
  assert.deepEqual([...areas].sort((a, b) => a - b), areas, "areas run Summary through Action Items");
  assert.deepEqual([...new Set(slots.map((slot) => slot.spokeId))], AREA_ORDER, "every area has options");
  for (const slot of slots) {
    const tab = openedTab(slot.spokeId, slot.subTab);
    assert.ok(tab, `${slot.id} subTab "${slot.subTab}" opens no tab`);
    assert.equal(tab.toLowerCase(), slot.subTab!.toLowerCase(), `${slot.id} opens "${tab}"`);
    const node = nodes.find((item) => item.id === slot.id);
    if (!node) continue;
    assert.equal(slot.value, node.heroValue?.value, `${slot.id} reads its bubble's figure`);
    assert.equal(slot.spokeId, node.spokeId, `${slot.id} spoke`);
    assert.equal(slot.tone, node.status, `${slot.id} tone`);
  }
  for (const id of ["hub", "spoke-roadmap", "spoke-specs"]) assert.equal(ids.includes(id), false, `${id} is not offered`);
  assert.equal(slots.some((slot) => /page found/i.test(slot.label)), false, "fender.com page found waits for its tab");
});

test("both Suppressed Listings figures and both Run Summary and Run Details rates are separate options", () => {
  const { slots } = build(retailReady(), aiReady());
  const bubble = slotById(slots, "sat-buybox");
  const lead = slotById(slots, "suppressed-buy-box-withheld");
  assert.equal(bubble.subTab, "Suppressed Listings");
  assert.equal(lead.subTab, "Suppressed Listings");
  assert.equal(lead.value, "33.3%");
  assert.equal(lead.reading.ratio, "1 of 3 current Buy Box readings");
  assert.equal(lead.reading.pie?.id, "retail-buy-box");
  assert.equal(bubble.reading.pie, null, "the confirmed high-price figure has no disc on its tab");

  for (const id of ["spoke-aeo", "run-summary-branded"]) {
    const slot = slotById(slots, id);
    assert.equal(slot.subTab, "Run Summary");
    assert.equal(slot.reading.pie, null, `${id} draws no pie, as Run Summary draws none`);
    assert.match(slot.reading.ratio ?? "", /^\d+ of \d+ resolved/);
  }
  const pies: Record<string, string> = {
    "run-details-unbranded": "role-unbranded",
    "sat-prompts": "role-branded",
    "battlecards-unbranded": "role-unbranded",
    "battlecards-branded": "role-branded",
    "engines-unbranded": "engine-unbranded_discovery",
    "engines-branded": "engine-branded_consideration",
  };
  for (const [id, pie] of Object.entries(pies)) assert.equal(slotById(slots, id).reading.pie?.id, pie, `${id} draws its own tab's disc`);
  assert.equal(slotById(slots, "run-summary-branded").value, slotById(slots, "sat-prompts").value, "same period, same rate");

  const beginner = slotById(slots, "battlecards-beginner-unbranded");
  assert.equal(beginner.subTab, "Category Battlecards");
  assert.equal(beginner.value, "100.0%");
  assert.match(beginner.reading.ratio ?? "", /^2 of 2 resolved Beginner unbranded discovery answers · Small sample$/);
});

test("the AI Consensus and AI Commerce options match Performance and Retail Overview with the viewer's authorized sellers", () => {
  const retail = retailReady();
  const ai = aiReady();
  const authorizedPartners = ["Austin Bazaar"];
  const { slots } = build(retail, ai, findability, { authorizedPartners });
  const consensus = consensusFromLive({ findability, specPages: bundle().specPages, retail, ai, authorizedPartners });
  assert.ok(consensus?.score != null);
  assert.equal(slotById(slots, "summary-ai-consensus").value, formatPct(consensus.score, 0));
  assert.equal(slotById(slots, "summary-ai-foundation").subTab, "Performance");
  assert.equal(slotById(slots, "summary-ai-commerce").value, formatPct(consensus.commerce.score, 0));
  const commerce = commerceScore(commerceInputsFromLive(retail, authorizedPartners)!, { authorizedPartners });
  const onRetail = slotById(slots, "retail-ai-commerce");
  assert.equal(onRetail.subTab, "Retail Overview");
  assert.equal(onRetail.value, formatPct(commerce.score, 0));
  assert.equal(onRetail.reading.pie?.id, "score-commerce");
  assert.match(onRetail.reading.ratio ?? "", /^\d+ of \d+ inputs in$/);
});

test("Out of Stock offers one estimate per sales source, as its tab shows them", () => {
  const { slots } = build(retailReady(), aiReady());
  const smartscout = slotById(slots, "stock-loss-12m-smartscout");
  assert.equal(smartscout.subTab, "Out of Stock");
  assert.equal(smartscout.provenance, "estimate");
  assert.equal(smartscout.value, formatUsd(1500.5));
  assert.equal(smartscout.reading.ratio, "2 of 3 estimated · 1 awaiting inputs");
  assert.equal(smartscout.reading.pie?.id, "stock-loss-population");
  assert.match(smartscout.detail, /^Analyst estimate\./);
  assert.equal(slots.some((slot) => slot.id === "stock-loss-12m-brand-reported"), false, "a source with no listings is left out");

  const loading = build(retailReady(), aiReady(), findability, { stockLoss: { phase: "loading" } }).slots;
  assert.equal(slotById(loading, "stock-loss-12m-smartscout").value, "Loading");
  const failed = build(retailReady(), aiReady(), findability, { stockLoss: { phase: "error" } }).slots;
  assert.equal(slotById(failed, "stock-loss-12m-smartscout").value, NOT_AVAILABLE);
  assert.ok(slotById(failed, "stock-loss-12m-smartscout").reading.missing);
});

test("each live figure says N of M and the larger slots carry the tab's disc", () => {
  const { slots } = build(retailReady(), aiReady());
  const ready = [
    "spoke-retail", "retail-ai-commerce", "suppressed-buy-box-withheld", "sat-buybox", "sat-map", "sat-asin",
    "spoke-aeo", "run-summary-branded", "run-details-unbranded", "sat-prompts", "sat-citations", "sat-drift",
    "sat-findability", "findability-official-family-page", "findability-completed-not-found",
    "findability-ambiguous-candidate", "findability-not-checked", "spoke-competitors", "battlecards-unbranded",
    "battlecards-branded", "battlecards-beginner-unbranded", "sat-taylor", "sat-amps", "engines-unbranded",
    "engines-branded", "summary-ai-consensus", "summary-ai-foundation", "summary-ai-commerce",
  ];
  const averages = ["map-average-gap"];
  for (const slot of slots) {
    if (slot.provenance === "estimate") continue;
    if (averages.includes(slot.id)) {
      assert.equal(slot.value, "-$20.00");
      assert.equal(slot.reading.ratio, "Across 1 listing below MAP");
      continue;
    }
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
  for (const id of ["spoke-retail", "sat-map", "sat-asin", "sat-findability", "findability-official-family-page", "sat-drift", "sat-prompts"]) {
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
  const bubbles = new Set(nodes.map((node) => node.id));
  for (const slot of slots) {
    if (bubbles.has(slot.id) || !slot.reading.missing) continue;
    assert.ok([NOT_AVAILABLE, "Loading"].includes(slot.value), `${slot.id} reads ${slot.value}`);
    assert.equal(slot.reading.pie, null, `${slot.id} draws no disc without its input`);
  }
  for (const id of ["summary-ai-consensus", "retail-ai-commerce", "map-average-gap", "battlecards-beginner-unbranded"]) {
    assert.ok(slotById(slots, id).reading.missing, `${id} explains the missing input`);
  }
  assert.equal(slotById(slots, "briefing-amazon-buy-box").value, NOT_AVAILABLE, "no offer split in this fixture");
  assert.equal(slotById(slots, "amazon-specs-completeness").value, NOT_AVAILABLE, "no completeness average in this fixture");
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
  const enterprise = slotById(slots, "enterprise-potential");
  assert.equal(enterprise.provenance, "estimate");
  assert.match(enterprise.detail, /^Analyst estimate\./);
  assert.equal(enterprise.subTab, "Revenue Estimates");
  const measuredPriceGap = "map-average-gap";
  for (const slot of slots.filter((item) => /\$/.test(item.value) && item.id !== measuredPriceGap)) {
    assert.equal(slot.provenance, "estimate", `${slot.id} dollar figure stays an analyst estimate`);
  }
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
    "lib/fender-canvas/minimal-metric-kit.ts",
    "lib/fender-canvas/minimal-metrics-summary.ts",
    "lib/fender-canvas/minimal-metrics-retail.ts",
    "lib/fender-canvas/minimal-metrics-ai.ts",
    "lib/fender-canvas/minimal-metrics-readiness.ts",
    "components/v3/live/useMinimalMetricReads.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /deep dive|deep-dive|ask intofocus/i, file);
    assert.doesNotMatch(source, /\u2014/, `${file} has no em dash`);
    if (file.endsWith(".tsx")) assert.ok(source.split("\n").length <= 400, `${file} stays at or under 400 lines`);
  }
  const toggle = read("lib/canvas-sdk/ViewModeSwitch.tsx");
  assert.deepEqual([...toggle.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Minimal", "Balanced"]);
  const picker = read("lib/canvas-sdk/MetricPicker.tsx");
  assert.match(picker, /aria-label="Filter metrics"/, "a long list gets a type-to-filter box");
  assert.match(picker, /Object\.keys\(spokes\)/, "options group by area in map order");
  assert.doesNotMatch(picker, /\stitle=\{/, "no native title tooltips in the picker");

  const shell = read("lib/canvas-sdk/CanvasShell.tsx");
  assert.match(shell, /<ViewModeSwitch views=\{views\} \/>\s*\{spec\.headerSlot\}/);
  assert.match(shell, /<MinimalView views=\{views\} spokes=\{spec\.spokes\} onOpenMetric=\{focusNode\} \/>/);
  assert.match(shell, /<HubSlots feeds=\{spec\.hubSlots\} bubbleId=\{inspectedBubbleId\} onOpen=\{focusNode\} \/>/);
  assert.ok(shell.split("\n").length <= 1593, "CanvasShell does not grow");
});
