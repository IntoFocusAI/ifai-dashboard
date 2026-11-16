// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/metric-widget-destinations.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fenderWidgetMetrics } from "../components/v3/fender-metrics.ts";
import { aiMetrics } from "../lib/ai-search/canvas-surfaces.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { tabIndexFromSlug, tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";
import { RETAIL_PANEL_TABS, STOCK_LOSS_TAB } from "../lib/fender-canvas/portfolio-retail-display.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";
import type { CanvasMetric } from "../lib/canvas-sdk/types.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";

const root = new URL("..", import.meta.url);
const spec = JSON.parse(readFileSync(new URL("data/fender-v3-spec.json", root), "utf8")) as {
  spokes: Record<string, { tabs: string[] }>;
};

/** The substring rule CanvasShell uses. A miss opens the first tab. */
function openedTab(tabs: string[], subTab: string | undefined): string | null {
  if (!subTab) return null;
  const index = tabs.findIndex((tab) => tab.toLowerCase().includes(subTab.toLowerCase()));
  return index >= 0 ? tabs[index] : null;
}

const EXPECTED_SUBTAB: Record<string, string> = {
  "active-offer-coverage": "Briefing",
  "buy-box-retention": "Retail Overview",
  "seller-data-coverage": "Retail Overview",
  "flagged-asins": "MAP Leakage",
  "suppressed-listings": "Suppressed Listings",
  "stranded-reviews": "Catalog Governance",
  "amazon-map-drift": "MAP Leakage",
  "overall-ai-win-rate": "Run Summary",
  "beginner-ai-win-rate": "Run Details",
  "resolved-simulations": "Run Summary",
  "confirmed-hallucinations": "Product Fact Checks",
  "fender-findability": "Findability",
  "machine-readable-specs": "Brand-Site Specs",
  "missing-schema-fields": "Brand-Site Specs",
  "beginner-sov-gap": "Category Battlecards",
  "strongest-category-sov": "Category Battlecards",
  "prioritized-fixes": "Urgent Interventions",
  "phase-one-lift": "Revenue Estimates",
  "enterprise-potential": "Revenue Estimates",
  "day-90-buy-box-target": "30-60-90 Days",
};

const RETIRED = [
  "Dual-Index",
  "Hallucination",
  "Priority Matrix",
  "Brand Divisions",
  "Battlecards",
  "Catalog",
  "ROI",
  "Interactive ROI Model",
  "30-60-90",
];

function tabsFor(spokeId: string): string[] {
  if (spokeId === "ecommerce") return [...RETAIL_PANEL_TABS];
  return spec.spokes[spokeId].tabs;
}

function assertDestinations(metrics: CanvasMetric[], label: string) {
  const ids = metrics.map((metric) => metric.id);
  assert.deepEqual(ids.sort(), Object.keys(EXPECTED_SUBTAB).sort(), label);
  for (const metric of metrics) {
    assert.equal(metric.subTab, EXPECTED_SUBTAB[metric.id], `${label} ${metric.id}`);
    const tab = openedTab(tabsFor(metric.spokeId), metric.subTab);
    assert.ok(tab, `${label} ${metric.id} subTab "${metric.subTab}" matches no tab`);
    assert.ok(
      tab.toLowerCase() === metric.subTab!.toLowerCase() ||
        tab.toLowerCase().startsWith(metric.subTab!.toLowerCase()),
      `${label} ${metric.id} opens "${tab}" from "${metric.subTab}"`,
    );
    assert.equal(RETIRED.includes(metric.subTab ?? ""), false, `${label} ${metric.id}`);
  }
}

function bundle(): CanvasBundle {
  const m = {
    catalog_skus: 3598,
    spec_checked: 925,
    spec_fender_found: 123,
    spec_fender_found_pct: 13.3,
    spec_avg_amazon_pct: 91.8,
    sim_win_pct: 72.4,
    sim_resolved: 80,
    sim_hallucinations: 4,
    sim_hallucination_risk: 9,
  } as CanvasMetricsRow;
  return {
    m,
    cats: [{ category: "beginner", fender_win_pct: 41.2, top_competitor: "Yamaha", top_competitor_pct: 50 }],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: [],
  };
}

const findability: FindabilityRead = {
  phase: "ready",
  dealerBundleLoaded: true,
  rows: [
    {
      asin: "B00EXACT",
      title: "Exact",
      category: null,
      product_kind: null,
      latest_state: "exact_official_product",
      latest_canonical_url: "https://brand.example/exact",
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
    },
    {
      asin: "B00FAMILY",
      title: "Family",
      category: null,
      product_kind: null,
      latest_state: "official_family_page",
      latest_canonical_url: "https://brand.example/family",
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
    },
  ],
};

test("retail tabs on the live spoke match the catalog names", () => {
  assert.deepEqual([...RETAIL_PANEL_TABS], spec.spokes.ecommerce.tabs);
});

test("a metric or link that opens Out of Stock lands on that tab, before and after the live read", () => {
  for (const tabs of [[...RETAIL_PANEL_TABS], spec.spokes.ecommerce.tabs]) {
    assert.equal(openedTab(tabs, STOCK_LOSS_TAB), STOCK_LOSS_TAB);
    assert.equal(tabs[tabIndexFromSlug(tabs, tabSlug(STOCK_LOSS_TAB))], STOCK_LOSS_TAB);
    assert.equal(tabs.indexOf(STOCK_LOSS_TAB), tabs.indexOf("Catalog Governance") + 1);
  }
});

test("the fallback catalog opens a current tab for every widget", () => {
  assertDestinations(fenderWidgetMetrics, "fallback");
  const findabilityMetric = fenderWidgetMetrics.find((metric) => metric.id === "fender-findability");
  assert.equal(findabilityMetric?.value, "Unavailable");
  assert.match(findabilityMetric?.detail ?? "", /not available/);
  assert.doesNotMatch(`${findabilityMetric?.value} ${findabilityMetric?.detail}`, /%|29\.2|pages found|13\.3/);
  assert.equal(fenderWidgetMetrics.find((metric) => metric.id === "phase-one-lift")?.value, "+$680K est.");
  assert.equal(fenderWidgetMetrics.find((metric) => metric.id === "enterprise-potential")?.value, "+$38M to $62M est.");
  assert.equal(fenderWidgetMetrics.find((metric) => metric.id === "prioritized-fixes")?.provenance, "estimate");
  assert.equal(fenderWidgetMetrics.find((metric) => metric.id === "flagged-asins")?.label, "MAP violations");
});

test("the picker list, including live overrides, opens the named tab", () => {
  const live = buildLiveMetrics(bundle(), { phase: "loading" }, findability);
  assert.equal(live.overallAiWinRate.value, "72.4%");
  assert.equal(live.overallAiWinRate.detail, "80 resolved answers");
  assert.equal(live.beginnerAiWinRate.value, "41.2%");
  assert.equal(live.flaggedAsins.label, "MAP violations");
  assert.equal(live.flaggedAsins.value, "Loading");
  assert.equal(live.phaseOneLift.value, "+$680K est.");
  assert.equal(live.phaseOneLift.provenance, "estimate");
  assert.equal(live.enterprisePotential.value, "+$38M to $62M est.");
  assert.equal(live.enterprisePotential.provenance, "estimate");
  assert.equal(live.prioritizedFixes.value, "Estimates");
  assert.equal(live.prioritizedFixes.provenance, "estimate");
  assert.equal(live.fenderFindability.value, "1");
  assert.match(live.fenderFindability.detail, /1 family page/);
  assert.doesNotMatch(`${live.fenderFindability.value} ${live.fenderFindability.detail}`, /%|13\.3|pages found/);

  const rendered = Object.values({ ...live, ...aiMetrics({ phase: "loading" }) });
  assertDestinations(rendered, "rendered");
  const renderedFindability = rendered.find((metric) => metric.id === "fender-findability");
  assert.equal(renderedFindability?.value, "1");
  assert.equal(renderedFindability?.subTab, "Findability");

  const missing = buildLiveMetrics(bundle());
  assert.equal(missing.fenderFindability.value, "Loading");
  assert.match(missing.fenderFindability.detail, /loading/i);
  assert.notEqual(missing.fenderFindability.value, "0");
  assert.doesNotMatch(missing.fenderFindability.value, /%/);
});

test("the canvas spec passes the findability read into the widget list", () => {
  const source = readFileSync(new URL("lib/fender-canvas/build-canvas-spec.tsx", root), "utf8");
  assert.match(source, /buildLiveMetrics\(bundle, retail, findability, aiSearch\)/);
  const liveSource = readFileSync(new URL("lib/fender-canvas/metrics-from-live.ts", root), "utf8");
  const catalog = readFileSync(new URL("components/v3/fender-metrics.ts", root), "utf8");
  assert.doesNotMatch(liveSource, /spec_fender_found/);
  assert.doesNotMatch(catalog, /29\.2|pages found|spec_fender_found|"Dual-Index"|"Hallucination"|"Priority Matrix"/);
});
