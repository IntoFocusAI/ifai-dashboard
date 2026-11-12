// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/c01-deck.test.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { competitorTallies } from "../lib/ai-search/competitors.ts";
import { driftRead } from "../lib/ai-search/drift.ts";
import { factCheckAccuracyLead } from "../lib/ai-search/fact-check-copy.ts";
import { storedRunSnapshots } from "../lib/ai-search/stored-run-copy.ts";
import { BRANDED_RATE_BANDS, roleRateLead, summarizeRun, UNBRANDED_RATE_BANDS } from "../lib/ai-search/summary.ts";
import { buildDeck, deckFixes } from "../lib/deck/deck-model.ts";
import type { DeckInput, DeckModel } from "../lib/deck/deck-types.ts";
import { briefingFindingsLead } from "../lib/fender-canvas/briefing-retail-lead.ts";
import { formatRatio, formatUsd } from "../lib/fender-canvas/format.ts";
import { buildSpecPages, machineReadabilityHeroes } from "../lib/fender-canvas/machine-readability.ts";
import {
  loadPortfolioRetailSnapshot,
  type CatalogBundleRow,
  type MapLeakageRow,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { buyBoxHero, catalogHero, mapHero } from "../lib/fender-canvas/retail-overview-lead.ts";
import { rankedFindings } from "../lib/fender-canvas/roadmap-plan.ts";
import { lostSalesPartial, sumLostSales, type StockLossRow } from "../lib/fender-canvas/stock-loss.ts";
import { outcomeRatioFigure, outcomeShareFigure } from "../lib/findability/lead.ts";
import { countFindability, type FindabilityRow } from "../lib/findability/outcomes.ts";

/* C-01: the deck cites the same run as the screen. For one fixture, every deck figure equals
   the figure the screen's own function returns for the same read. */

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function suppression(state: "withheld" | "present", asin: string): SuppressionSupportRow {
  return {
    asin,
    offer_price: 200,
    featured_offer_state: state,
    featured_offer_withheld: state === "withheld",
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: state === "withheld" ? 20000 : 9000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

const mapRow = (asin: string, leak: number | null): MapLeakageRow => ({
  asin,
  map_price: 100,
  offer_price: 80,
  amz_leakage: leak,
  wmt_leakage: null,
  mf_leakage: null,
});

const bundle = (asin: string, parent: string | null): CatalogBundleRow => ({
  asin,
  model_name: asin,
  title: null,
  bundle_name: null,
  parent_asin: parent,
  product_url: null,
  is_bundle: true,
  featured_offer_state: "present",
});

function findabilityRow(asin: string, state: string, confirmed: boolean): FindabilityRow {
  return {
    asin,
    title: "Listing",
    category: "Solid Body",
    product_kind: "instrument",
    latest_state: state,
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: "not_checked",
    counts_as_confirmed: confirmed,
    counts_as_finished_search: true,
    counts_as_ambiguous: false,
    counts_as_unchecked: false,
    counts_as_completed_not_found: !confirmed,
    counts_as_blocked: false,
    counts_as_timeout: false,
    counts_as_parse_failure: false,
    counts_as_unsupported: false,
  };
}

function stockRow(asin: string, lost: number | null): StockLossRow {
  return {
    asin,
    title: `Listing ${asin}`,
    featured_offer_state: "present",
    offline_now: false,
    current_oos_days: 0,
    smartscout_snapshot_date: CHECKED_AT.slice(0, 10),
    smartscout_monthly_revenue: 1000,
    smartscout_ttm_revenue: 12000,
    history_through: CHECKED_AT.slice(0, 10),
    in_stock_days_30: 25,
    oos_days_30: 5,
    oos_days_90: 10,
    observed_days_365: 365,
    in_stock_days_365: 340,
    oos_days_365: 25,
    no_buy_box_days_365: 0,
    revenue_source: lost == null ? null : "smartscout",
    baseline_method: lost == null ? null : "smartscout_ttm",
    in_stock_days_used: 340,
    baseline_daily_revenue: 35,
    est_lost_revenue_oos_30: lost == null ? null : lost / 10,
    est_lost_revenue_oos_90: lost == null ? null : lost / 4,
    est_lost_revenue_oos_365: lost,
    awaiting_inputs_reason: lost == null ? "no_sales_source" : null,
  } as StockLossRow;
}

async function fixture(): Promise<DeckInput> {
  const snapshot = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({
      ok: true,
      rows: [suppression("withheld", "B01"), suppression("present", "B02"), suppression("present", "B03")],
      truncated: false,
    }),
    mapRows: async () => ({ ok: true, rows: [mapRow("B01", -20), mapRow("B02", 0), mapRow("B03", -5)], truncated: false }),
    catalogRows: async () => ({ ok: true, rows: [bundle("B10", null), bundle("B11", "B99"), bundle("B12", null)], truncated: false }),
    catalogBundleCount: async () => 3,
    specRows: async () => ({ ok: false }),
  });
  const ai = storedRunSnapshots()[0];
  return {
    brand: "Fender",
    brandSite: "fender.com",
    leadBrand: "Fender/Squier",
    tabAi: ai,
    mapAi: ai,
    retail: { phase: "ready", snapshot },
    findability: {
      phase: "ready",
      dealerBundleLoaded: true,
      rows: [
        findabilityRow("B01", "exact_official_product", true),
        findabilityRow("B02", "completed_not_found", false),
        findabilityRow("B03", "completed_not_found", false),
        findabilityRow("B04", "completed_not_found", false),
      ],
    },
    specPages: buildSpecPages([]),
    stockLoss: { rows: [stockRow("B01", 1200), stockRow("B02", 300), stockRow("B03", null)], populationCount: 10 },
    windowLabel: "Last 30 days",
    asOf: "Nov 10, 2026, 9:32 PM",
    phaseOneLift: "+$680K est.",
    enterprisePotential: "+$38M to $62M est.",
  };
}

function figure(deck: DeckModel, slide: string, id: string) {
  const found = deck.slides.find((item) => item.id === slide)?.figures.find((item) => item.id === id);
  assert.ok(found, `${slide} ${id} is on the deck`);
  return found;
}

test("AI figures equal Run Summary, Product Fact Checks, and Competitor Wins for the same read", async () => {
  const input = await fixture();
  const deck = buildDeck(input);
  const roles = summarizeRun(input.tabAi!).roles;
  const unbranded = roleRateLead(roles.unbranded, UNBRANDED_RATE_BANDS);
  const branded = roleRateLead(roles.branded, BRANDED_RATE_BANDS);
  assert.equal(figure(deck, "s2", "unbranded").value, unbranded.rate);
  assert.equal(figure(deck, "s2", "unbranded").status, unbranded.status);
  assert.match(figure(deck, "s2", "unbranded").ratio ?? "", new RegExp(`^${formatRatio(roles.unbranded.fenderWins, roles.unbranded.resolved)}`));
  assert.equal(figure(deck, "s2", "branded").value, branded.rate);
  const accuracy = factCheckAccuracyLead(driftRead(input.tabAi!.calls, input.tabAi!.probes).coverage);
  if (accuracy.rate) assert.equal(figure(deck, "s2", "accuracy").value, accuracy.rate);

  const tallies = competitorTallies(input.tabAi!.calls);
  const bars = deck.slides.find((slide) => slide.id === "s3")?.bars ?? [];
  assert.deepEqual(
    bars.map((bar) => [bar.label, bar.ratio]),
    tallies.slice(0, 5).map((row) => [row.brand, formatRatio(row.wins, row.resolved)]),
  );
  assert.equal(deck.runId, input.mapAi!.run.audit_run_id.slice(0, 8));
  assert.equal(deck.window, "Last 30 days");
});

test("listing figures equal the Catalog Health and AI Readiness heroes", async () => {
  const input = await fixture();
  const deck = buildDeck(input);
  assert.equal(input.retail.phase, "ready");
  if (input.retail.phase !== "ready") return;
  const snapshot = input.retail.snapshot;
  for (const [slide, id, hero] of [
    ["s5", "buy-box", buyBoxHero(snapshot)],
    ["s6", "map", mapHero(snapshot)],
    ["s7", "splintered", catalogHero(snapshot)],
  ] as const) {
    assert.equal(figure(deck, slide, id).value, `${hero.percent}${hero.partial ? "*" : ""}`);
    assert.equal(figure(deck, slide, id).ratio, hero.ratio);
  }
  assert.equal(figure(deck, "s6", "map-gap").value, formatUsd(snapshot.mapLeakage.detail!.averageLeakage, { signed: true }));

  const year = sumLostSales(input.stockLoss!.rows, 365);
  const mark = lostSalesPartial(input.stockLoss!.rows, year) ? "*" : "";
  assert.equal(figure(deck, "s5", "stock-loss").value, `${formatUsd(year.bySource[0].total)}${mark}`);
  assert.equal(figure(deck, "s5", "stock-loss").estimate, true);

  assert.equal(input.findability.phase, "ready");
  if (input.findability.phase !== "ready") return;
  const counts = countFindability(input.findability.rows);
  assert.equal(figure(deck, "s8", "exact-page").value, outcomeShareFigure(counts, "exact_official_product"));
  assert.equal(figure(deck, "s8", "exact-page").ratio, outcomeRatioFigure(counts, "exact_official_product"));
  // An empty page read has no Brand-Site Specs figure, so the deck leaves it off rather than showing Not available*.
  assert.equal(machineReadabilityHeroes(input.specPages)[0].ratio, null);
  assert.equal(deck.slides.find((slide) => slide.id === "s8")?.figures.some((item) => item.id === "missing-specs"), false);
});

test("the fix list is Action Items' order on Summary's read", async () => {
  const input = await fixture();
  const ai = { phase: "ready", snapshot: input.mapAi! } as const;
  const ranked = rankedFindings(briefingFindingsLead(input.retail, input.findability, ai).findings).filter((row) => row.stored);
  const fixes = deckFixes(input);
  assert.deepEqual(
    fixes.map((fix) => [fix.ratio, fix.statusWord]),
    ranked.slice(0, 5).map((row) => [`${row.finding.ratio ?? ""}${row.finding.partial ? "*" : ""}`, row.statusLabel]),
  );
  const s9 = buildDeck(input).slides.find((slide) => slide.id === "s9");
  assert.equal(s9?.meta?.value, "+$680K est. a year");
  assert.equal(s9?.meta?.estimate, true);
});

test("a slide whose data is missing is left out, never shown as Not available*", async () => {
  const input = await fixture();
  const deck = buildDeck({
    ...input,
    retail: { phase: "error" },
    stockLoss: null,
    phaseOneLift: null,
    enterprisePotential: null,
  });
  const ids = deck.slides.map((slide) => slide.id);
  for (const id of ["s5", "s6", "s7", "b2", "b3", "b4"]) assert.ok(!ids.includes(id), `${id} is left out`);
  assert.ok(deck.omitted.some((item) => item.id === "s5"));
  assert.doesNotMatch(JSON.stringify(deck.slides), /Not available\*/);
});

test("deck copy keeps the brand voice: no em dashes, no contractions, no fees", async () => {
  const deck = buildDeck(await fixture());
  const text = JSON.stringify(deck.slides.map(({ headline, why, note, markers, steps }) => ({ headline, why, note, markers, steps })));
  assert.doesNotMatch(text, /—/);
  assert.doesNotMatch(text, /\b\w+'(t|re|ve|ll|d)\b/i);
  assert.doesNotMatch(text, /\b(fee|fees|retainer|pricing tier)\b/i);
  const dir = new URL("../components/v3/live/deck/", import.meta.url).pathname;
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsx"))) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n").length;
    assert.ok(lines <= 400, `${file} is ${lines} lines`);
  }
});
