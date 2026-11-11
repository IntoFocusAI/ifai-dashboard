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
import { isNotAvailable } from "../lib/fender-canvas/minimal-metric-kit.ts";
import {
  buildMinimalMetrics,
  MINIMAL_ENTRIES,
  NOT_AVAILABLE,
  type StockLossRead,
} from "../lib/fender-canvas/minimal-metrics.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { brandSitePageFoundHero } from "../lib/fender-canvas/page-found-hero.ts";
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
const CHECKED_DAY = new Date().toISOString().slice(0, 10);

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
      { map_price: 100, offer_price: 80, amz_leakage: -20, wmt_leakage: null, mf_leakage: null, featured_offer_checked_at: CHECKED_AT },
      { map_price: 100, offer_price: 100, amz_leakage: 0, wmt_leakage: null, mf_leakage: null, featured_offer_checked_at: CHECKED_AT },
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
        featured_offer_state: "present",
        featured_offer_checked_at: CHECKED_AT,
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
    latest_attempt_at: new Date().toISOString(),
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
  // Published now, so these figures are current; scripts/map-stale-mark.test.ts covers a stale run.
  return { phase: "ready", snapshot: { ...published, run: { ...published.run, published_at: new Date().toISOString() } } };
}

function stockRow(asin: string, lost365: number | null): StockLossRow {
  return {
    asin,
    title: asin,
    featured_offer_state: "present",
    offline_now: false,
    current_oos_days: 0,
    smartscout_snapshot_date: CHECKED_DAY,
    smartscout_monthly_revenue: null,
    smartscout_ttm_revenue: null,
    history_through: CHECKED_DAY,
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

// The Roadmap figure follows Action Items: its 30-60-90 Days tab leads with it.
const AREA_ORDER = ["hub", "ecommerce", "aeo", "specs", "competitors", "suggestions", "roadmap"];

test("the list offers most headline figures, grouped by area, and each opens a tab that shows it", () => {
  const { nodes, slots } = build(retailReady(), aiReady());
  assert.ok(slots.length >= 38, `expected most headline figures, got ${slots.length}`);
  const ids = slots.map((slot) => slot.id);
  assert.equal(new Set(ids).size, ids.length, "each option once");
  const keys = MINIMAL_ENTRIES.map((item) => ("family" in item ? item.family : item.id));
  assert.equal(new Set(keys).size, keys.length, "entry ids are unique");
  const firstOther = slots.findIndex((slot) => slot.area === "Other");
  assert.ok(firstOther > 0, "Other has options");
  assert.ok(slots.slice(firstOther).every((slot) => slot.area === "Other"), "Other comes last");
  const mapped = slots.slice(0, firstOther);
  const areas = mapped.map((slot) => AREA_ORDER.indexOf(slot.spokeId));
  assert.ok(areas.every((area) => area >= 0), "every option sits in one of the seven areas");
  assert.deepEqual([...areas].sort((a, b) => a - b), areas, "areas run Summary through the Roadmap");
  assert.deepEqual([...new Set(mapped.map((slot) => slot.spokeId))], AREA_ORDER, "every area has options");
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
  for (const id of ["hub", "spoke-roadmap"]) assert.equal(ids.includes(id), false, `${id} is not offered`);
});

test("fender.com page found reads the AI Readiness bubble and the Brand-Site Specs hero, and opens that tab", () => {
  const b = bundle();
  const { nodes, slots } = build(retailReady(), aiReady(), findability, { b });
  const slot = slotById(slots, "spoke-specs");
  const bubble = nodeById(nodes, "spoke-specs");
  const hero = brandSitePageFoundHero(b.m);
  assert.equal(slot.label, "fender.com page found");
  assert.equal(slot.label, hero.label);
  assert.equal(slot.value, "13.3%");
  assert.equal(slot.value, bubble.heroValue?.value);
  assert.equal(slot.value, hero.percent);
  assert.equal(slot.tone, bubble.status);
  assert.equal(slot.reading.ratio, "123 of 925 checked SKUs");
  assert.equal(slot.reading.ratio, `${hero.ratio} checked SKUs`);
  assert.deepEqual(slot.reading.pie, hero.pie);
  assert.equal(slot.reading.pie?.id, "brand-site-page-found");
  assert.equal(slot.spokeId, "specs");
  assert.equal(openedTab(slot.spokeId, slot.subTab), "Brand-Site Specs");
  const readiness = slots.filter((item) => item.spokeId === "specs").map((item) => item.id);
  assert.equal(readiness.indexOf("spoke-specs") + 1, readiness.indexOf("sat-schema"), "leads Brand-Site Specs, as its hero does");

  const missing = build(retailReady(), aiReady(), findability, { b: { ...b, m: { catalog_skus: 3598 } as CanvasMetricsRow } });
  const unread = slotById(missing.slots, "spoke-specs");
  assert.equal(unread.value, nodeById(missing.nodes, "spoke-specs").heroValue?.value);
  assert.ok(isNotAvailable(unread.value), `reads ${unread.value}`);
  assert.equal(unread.reading.ratio, null);
  assert.equal(unread.reading.pie, null);
  assert.equal(unread.reading.missing, brandSitePageFoundHero(null).figureTip);
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

const BATTERY_CATEGORIES = ["electrics", "acoustics", "amps", "basses", "squier", "beginner"];

test("Category Battlecards offers one option per question category, each with its row's rate", () => {
  const { slots } = build(retailReady(), aiReady());
  const ids = BATTERY_CATEGORIES.map((category) => `battlecards-${category}-unbranded`);
  const options = slots.filter((slot) => /^battlecards-.+-unbranded$/.test(slot.id) && slot.id !== "battlecards-unbranded");
  assert.deepEqual(options.map((slot) => slot.id), ids, "battery order, one each");
  const branded = slots.findIndex((slot) => slot.id === "battlecards-branded");
  assert.equal(slots.findIndex((slot) => slot.id === ids[0]), branded + 1, "right after the run-wide rates");
  for (const slot of options) {
    assert.equal(slot.spokeId, "competitors");
    assert.equal(slot.subTab, "Category Battlecards");
    assert.match(slot.label, /^[A-Z]\w+: Fender leads in unbranded discovery$/);
  }
  const electrics = slotById(slots, "battlecards-electrics-unbranded");
  assert.equal(electrics.value, "66.7%");
  assert.equal(electrics.reading.ratio, "6 of 9 resolved Electrics unbranded discovery answers · Small sample");
  assert.equal(slotById(slots, "battlecards-basses-unbranded").reading.ratio, "1 of 4 resolved Basses unbranded discovery answers · Small sample");
  const squier = slotById(slots, "battlecards-squier-unbranded");
  assert.equal(squier.value, NOT_AVAILABLE, "a category with no resolved answers");
  assert.equal(squier.reading.missing, "The published run has no resolved Squier unbranded discovery answers.");

  const ai = aiReady();
  assert.equal(ai.phase, "ready");
  const moved = { ...ai.snapshot, calls: ai.snapshot.calls.map((call) => (call.category === "amps" ? { ...call, category: "ukuleles" } : call)) };
  const withExtra = build(retailReady(), { phase: "ready", snapshot: moved }).slots;
  const amps = slotById(withExtra, "battlecards-amps-unbranded");
  assert.equal(amps.value, NOT_AVAILABLE, "a battery category the run did not ask stays offered");
  assert.equal(amps.reading.missing, "The published run asked no Amps questions.");
  const ukuleles = slotById(withExtra, "battlecards-ukuleles-unbranded");
  assert.equal(ukuleles.label, "Ukuleles: Fender leads in unbranded discovery");
  assert.equal(ukuleles.value, "100.0%");
  assert.equal(withExtra.indexOf(ukuleles), withExtra.findIndex((slot) => slot.id === "battlecards-beginner-unbranded") + 1, "live extras follow the battery");

  const loading = build(retailReady(), { phase: "loading" }).slots;
  for (const id of ids) assert.equal(slotById(loading, id).value, "Loading", `${id} waits for the run`);
});

const OTHER: Record<string, [spokeId: string, tab: string]> = {
  "buy-box-retention": ["ecommerce", "Retail Overview"],
  "seller-data-coverage": ["ecommerce", "Retail Overview"],
  "stranded-reviews": ["ecommerce", "Catalog Governance"],
  "beginner-sov-gap": ["competitors", "Category Battlecards"],
  "strongest-category-sov": ["competitors", "Category Battlecards"],
  "resolved-simulations": ["aeo", "Run Summary"],
  "ai-actuation": ["hub", "Performance"],
};

function storedBundle(): CanvasBundle {
  const b = bundle();
  return {
    ...b,
    m: { ...b.m, catalog_skus: 3718, bb_1p: 79, bb_total: 1107, bb_1p_pct: 7.1, seller_harvested: 1108, seller_harvested_pct: 29.8, bundle_reviews: null },
  };
}

test("Other lists the figures no tab shows, last, each opening its closest tab with a definition", () => {
  const { slots, nodes } = build(retailReady(), aiReady(), findability, { b: storedBundle() });
  const others = slots.filter((slot) => slot.area === "Other");
  assert.deepEqual(others.map((slot) => slot.id), Object.keys(OTHER), "in the order PM20 listed them");
  for (const slot of others) {
    const [spokeId, tab] = OTHER[slot.id];
    assert.equal(slot.spokeId, spokeId, `${slot.id} spoke`);
    assert.equal(openedTab(slot.spokeId, slot.subTab), tab, `${slot.id} opens ${tab}`);
    assert.match(slot.definition ?? "", /No tab shows/, `${slot.id} says no tab shows it yet`);
    assert.doesNotMatch(slot.definition ?? "", /\u2014/);
    if (slot.value === NOT_AVAILABLE) assert.ok(slot.reading.missing, `${slot.id} explains the missing input`);
  }
  assert.equal(slots.filter((slot) => slot.area !== "Other").some((slot) => slot.definition), false, "only Other carries a definition");

  const share = slotById(slots, "buy-box-retention");
  assert.equal(share.label, "Amazon 1P Buy Box share");
  assert.equal(share.value, "7.1%");
  assert.equal(share.reading.ratio, "79 of 1,107 listings in the stored Buy Box count");
  assert.equal(share.tone, "danger");
  const sellers = slotById(slots, "seller-data-coverage");
  assert.equal(sellers.value, "29.8%");
  assert.equal(sellers.reading.ratio, "1,108 of 3,718 catalog listings");
  const reviews = slotById(slots, "stranded-reviews");
  assert.equal(reviews.value, NOT_AVAILABLE);
  assert.equal(reviews.reading.missing, "The catalog metrics row does not store a stranded review count.");

  const gap = slotById(slots, "beginner-sov-gap");
  assert.equal(gap.value, "+100.0 pts");
  assert.equal(gap.reading.ratio, "Fender/Squier 2 of 2 resolved Beginner unbranded discovery answers. No competitor led one.");
  const best = slotById(slots, "strongest-category-sov");
  assert.equal(best.label, "Strongest category: Amps");
  assert.equal(best.value, slotById(slots, "battlecards-amps-unbranded").value, "reads the category's own option");
  assert.equal(best.reading.ratio, slotById(slots, "battlecards-amps-unbranded").reading.ratio);
  const answered = slotById(slots, "resolved-simulations");
  assert.match(answered.value, /^\d[\d,]* of \d[\d,]*$/);
  assert.equal(answered.reading.ratio, "calls answered", "the count is not repeated under the value");
  const actuation = slotById(slots, "ai-actuation");
  assert.equal(actuation.value, NOT_AVAILABLE, "AI Actuation has no records yet");
  assert.equal(actuation.reading.missing, "No owner, evidence, or dated records yet.");
  const plan = slotById(slots, "day-90-buy-box-target");
  const roadmap = nodes.find((node) => node.id === "spoke-roadmap");
  assert.equal(plan.value, roadmap?.heroValue?.value, "reads the Roadmap bubble");
  assert.equal(plan.tone, "neutral", "a plan is not graded, so it never takes the Champagne color");
  assert.equal(plan.area, undefined, "the 30-60-90 Days tab shows it, so it is not an Other figure");

  const unstored = build(retailReady(), { phase: "error", message: "down" }).slots;
  for (const id of ["buy-box-retention", "seller-data-coverage", "beginner-sov-gap", "strongest-category-sov", "resolved-simulations"]) {
    const slot = slotById(unstored, id);
    assert.equal(slot.value, NOT_AVAILABLE, `${id} without its input`);
    assert.ok(slot.reading.missing, `${id} explains the missing input`);
  }
  assert.equal(slotById(unstored, "strongest-category-sov").label, "Strongest category");

  const picker = read("lib/canvas-sdk/MetricPicker.tsx");
  assert.match(picker, /\.\.\.areas, \.\.\.extra/, "Other follows the map areas");
  assert.match(picker, /metricTermAttrs\(option\.label, option\.definition\)/, "the definition is the label's tooltip");
  assert.match(picker, /metricTermAttrs\(option\.value, option\.reading\?\.missing\)/, "Not available* carries its reason");
  for (const file of ["lib/canvas-sdk/LargeMetricSlots.tsx", "lib/canvas-sdk/MetricWidgets.tsx"]) {
    const source = read(file);
    assert.match(source, /area \?\? spokeLabel/, `${file} shows Other as the overline`);
    assert.match(source, /metricTermAttrs\(metric\.label, definition\)/, `${file} puts the definition on the label`);
  }
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
  // One listing is awaiting inputs, so the total carries the asterisk and says why (X-25).
  assert.equal(smartscout.value, `${formatUsd(1500.5)}*`);
  assert.match(smartscout.reading.missing ?? "", /^1 of 3 out-of-stock listings are awaiting inputs and not counted as \$0/);
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
    "findability-ambiguous-candidate", "findability-not-checked", "spoke-specs", "spoke-competitors", "battlecards-unbranded",
    "battlecards-branded", "battlecards-electrics-unbranded", "battlecards-acoustics-unbranded",
    "battlecards-amps-unbranded", "battlecards-basses-unbranded", "battlecards-beginner-unbranded", "sat-taylor", "sat-amps", "engines-unbranded",
    "engines-branded", "summary-ai-consensus", "summary-ai-foundation", "summary-ai-commerce",
    "beginner-sov-gap", "strongest-category-sov", "resolved-simulations",
  ];
  const averages = ["map-average-gap"];
  for (const slot of slots) {
    if (slot.provenance === "estimate" || slot.id === "day-90-buy-box-target") continue;
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
  for (const id of ["spoke-retail", "sat-map", "sat-asin", "sat-findability", "findability-official-family-page", "spoke-specs", "sat-drift", "sat-prompts"]) {
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
  assert.ok(taylor && /^\d+\.\d%$/.test(taylor.value), "the bubble leads with the competitor-led share");
  assert.match(taylor.reading.ratio ?? "", /^\d+ of \d+ resolved unbranded discovery answers$/, "the N of M sits under the share");
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
    // A figure with the partial asterisk keeps its tooltip in `missing`; it is a figure, not a missing input.
    if (/\d\*$/.test(slot.value)) continue;
    assert.ok([NOT_AVAILABLE, "Loading"].includes(slot.value), `${slot.id} reads ${slot.value}`);
    assert.equal(slot.reading.pie, null, `${slot.id} draws no disc without its input`);
  }
  for (const id of ["summary-ai-consensus", "retail-ai-commerce", "map-average-gap", "battlecards-beginner-unbranded"]) {
    assert.ok(slotById(slots, id).reading.missing, `${id} explains the missing input`);
  }
  assert.equal(slotById(slots, "briefing-amazon-buy-box").value, NOT_AVAILABLE, "no offer split in this fixture");
  assert.equal(slotById(slots, "amazon-specs-completeness").value, NOT_AVAILABLE, "no completeness average in this fixture");
  const source = read("lib/canvas-sdk/LargeMetricSlots.tsx") + read("lib/canvas-sdk/MetricWidgets.tsx");
  assert.match(source, /metricTermAttrs\(metric\.value, (reading\.)?missing\)/);
  assert.match(source, /ifai-term/);
  assert.match(read("lib/canvas-sdk/metric-term.ts"), /"data-ifai-tooltip-desc": desc/);
});

test("Phase 1 stays an analyst estimate and nothing mentions fees", () => {
  const { nodes, slots } = build(retailReady(), aiReady());
  const phaseOne = slots.find((slot) => slot.id === "spoke-fixes");
  assert.ok(phaseOne);
  assert.deepEqual(nodeById(nodes, "spoke-fixes").heroValue, { value: "+$680K est.", label: "Phase 1 lift" });
  assert.equal(phaseOne.value, "+$680K est.");
  assert.equal(slotById(slots, "enterprise-potential").value, "+$38M to $62M est.");
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
  const copy = slots
    .flatMap((slot) => [slot.label, slot.detail, slot.reading.ratio ?? "", slot.reading.missing ?? "", slot.definition ?? ""])
    .join("\n");
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
    "lib/fender-canvas/minimal-metrics-other.ts",
    "lib/canvas-sdk/metric-term.ts",
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
  assert.ok(shell.split("\n").length <= 1595, "CanvasShell does not grow past the bubble landing's import and call");
});
