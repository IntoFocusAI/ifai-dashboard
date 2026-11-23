// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimates-core.test.ts
//
// Reproduces the worked figures in docs/dollar-estimates-proposal.md (sections 1, 3 and 5) from the
// listings as read on 17 Nov 2026. The proposal priced only listings with SmartScout sales, so these
// run with salesSources "measured_only". Coverage beyond SmartScout (decision 112) is tested in
// scripts/estimates-sales-coverage.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateOutOfStock } from "../lib/estimates/availability.ts";
import { estimateBuyBox } from "../lib/estimates/buy-box.ts";
import {
  ALL_BENCHMARKS,
  APLUS_LIFT,
  BRAND_LOSS_SHARE,
  BUY_BOX_LOST_SHARE,
  MAP_VOLUME_KEPT,
  RANK_CURVE_METHOD_SOURCES,
  SOURCES,
  SPEC_LIFT_BANDS,
  SPLINTERED_LIFT,
} from "../lib/estimates/benchmarks.ts";
import { combinedLiftShares, contentLifts, estimateContent, specLiftBand } from "../lib/estimates/content.ts";
import { estimateMapLeakage } from "../lib/estimates/map-annual.ts";
import { estimateListingLines, rollupMeasuredTotal, rollupPhase1 } from "../lib/estimates/rollup.ts";
import { catalogSalesCoverage } from "../lib/estimates/sales-coverage.ts";
import type { EstimateListingInput, EstimateResult } from "../lib/estimates/types.ts";
import { loadEstimatesFixture } from "./fixtures/estimates/load.ts";

const MEASURED = { salesSources: "measured_only", dataAsOf: "2026-11-17" } as const;

/** Within rounding: the proposal's tables are whole dollars. */
function near(actual: number | null | undefined, expected: number, tolerance = 1, label = ""): void {
  assert.ok(typeof actual === "number", `${label} is missing`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
}

function rangeIs(result: EstimateResult, expected: [number, number, number], tolerance = 1): void {
  assert.equal(result.status, "estimated");
  near(result.range?.low, expected[0], tolerance, `${result.lineId} low`);
  near(result.range?.mid, expected[1], tolerance, `${result.lineId} mid`);
  near(result.range?.high, expected[2], tolerance, `${result.lineId} high`);
}

const touched = (r: EstimateResult) => r.trail.inputs.find((i) => i.key === "touched_sales")?.value as number;

const fender = estimateListingLines(loadEstimatesFixture("fender").listings, MEASURED);
const ledlenser = estimateListingLines(loadEstimatesFixture("ledlenser").listings, MEASURED);

test("line 1, out of stock, reproduces the proposal", () => {
  rangeIs(fender.outOfStock, [367760, 490347, 551640]);
  near(touched(fender.outOfStock), 1225867, 1, "Fender listing-level missed sales");
  // The proposal priced 247; 136 more are tracked by SmartScout with no sales: measured at $0 (decision 113).
  assert.equal(fender.outOfStock.trail.coverage.measured, 383);
  assert.equal(fender.outOfStock.trail.coverage.reportedNoSales, 136);
  assert.equal(fender.outOfStock.trail.coverage.total, 609);

  rangeIs(ledlenser.outOfStock, [8899, 11866, 13349]);
  near(touched(ledlenser.outOfStock), 29665, 1, "Ledlenser listing-level missed sales");
  assert.equal(ledlenser.outOfStock.trail.coverage.measured, 55);
  assert.equal(ledlenser.outOfStock.trail.coverage.reportedNoSales, 34);
  assert.equal(ledlenser.outOfStock.trail.coverage.total, 166);
  assert.equal(fender.outOfStock.trail.confidence, "high");
});

test("line 2, Buy Box: the proposal's backward figure is retired (R-06, 23 Nov 2026)", () => {
  // The 17 Nov read stored no Buy Box state, so no listing is withheld in it: line 2 prices no
  // listing and reads Not available*, never $0. Its old figure ($52K to $148K for Fender, priced on
  // days without a Buy Box in the last 12 months) is gone from the line and from Phase 1.
  for (const r of [fender.buyBox, ledlenser.buyBox]) {
    assert.equal(r.status, "not_available");
    assert.equal(r.range, null);
    assert.equal(r.trail.coverage.total, 0);
    assert.equal(r.trail.confidence, "medium");
    assert.ok(!r.trail.inputs.some((i) => i.key === "no_buy_box_days"), "no 12-month no-Buy-Box days input");
    assert.ok(!r.trail.benchmarks.some((b) => b.id === "brand_loss_share"), "the brand-loss share no longer applies");
  }
  assert.ok(fender.phase1.trail.notes.some((n) => n.includes("Buy Box withheld")), "Phase 1 names the line it leaves out");
});

test("line 3, MAP leakage, reproduces the proposal and stays outside the total", () => {
  rangeIs(fender.mapLeakage, [25816, 38724, 51632]);
  near(fender.mapLeakage.trail.inputs.find((i) => i.key === "monthly_value")?.value as number, 4303, 1, "Fender monthly value");
  assert.equal(fender.mapLeakage.trail.coverage.measured, 87);
  assert.equal(fender.mapLeakage.trail.coverage.total, 157);

  rangeIs(ledlenser.mapLeakage, [23494, 35241, 46988]);
  near(ledlenser.mapLeakage.trail.inputs.find((i) => i.key === "monthly_value")?.value as number, 3916, 1, "Ledlenser monthly value");
  assert.equal(ledlenser.mapLeakage.trail.coverage.measured, 23);
  assert.equal(ledlenser.mapLeakage.trail.coverage.total, 33);

  assert.equal(fender.mapLeakage.countsInTotal, false);
  assert.ok(!fender.phase1.parts?.some((p) => p.lineId === "map_leakage"));
});

test("line 4, splintered listings, reproduces the proposal", () => {
  rangeIs(fender.splintered, [18134, 55301, 89920]);
  near(touched(fender.splintered), 359679, 1, "Fender splintered sales");
  assert.equal(fender.splintered.trail.coverage.measured, 17);
  assert.equal(fender.splintered.trail.coverage.total, 84);

  // Ledlenser: one splintered listing with no recorded sales. Not estimated, never $0.
  assert.equal(ledlenser.splintered.status, "not_available");
  assert.equal(ledlenser.splintered.range, null);
  assert.equal(ledlenser.splintered.trail.coverage.total, 1);
  assert.equal(ledlenser.splintered.trail.coverage.notAvailable, 1);
});

test("line 5, missing Amazon specs, reproduces the proposal", () => {
  rangeIs(fender.missingSpecs, [125657, 328040, 652840]);
  rangeIs(ledlenser.missingSpecs, [1585, 4172, 8346]);
  // The proposal counted 519 Fender listings below 100%; the same-day read holds 523. Dollars match.
  assert.equal(fender.missingSpecs.trail.coverage.total, 523);
  assert.equal(ledlenser.missingSpecs.trail.coverage.total, 186);

  // Sales by band, as the proposal's table: $170K / $1.36M / $7.62M and $10K / $2K / $100K.
  const byBand = (r: EstimateResult) => {
    const sums: Record<string, number> = {};
    for (const row of r.trail.listings) {
      const band = specLiftBand(row.detail.amazonCompletenessPct as number)!;
      sums[band.id] = (sums[band.id] ?? 0) + (row.range ? (row.annualSales ?? 0) : 0);
    }
    return sums;
  };
  const f = byBand(fender.missingSpecs);
  near(f.below_70, 169850, 1, "Fender below 70%");
  near(f["70_to_84"], 1361028, 1, "Fender 70 to 84%");
  near(f["85_to_99"], 7618266, 1, "Fender 85 to 99%");
  const l = byBand(ledlenser.missingSpecs);
  near(l.below_70, 10167, 1, "Ledlenser below 70%");
  near(l["70_to_84"], 2487, 1, "Ledlenser 70 to 84%");
  near(l["85_to_99"], 100140, 1, "Ledlenser 85 to 99%");
});

test("line 6, miscategorized, is held until D-12 exists", () => {
  assert.equal(fender.miscategorized.status, "not_available");
  assert.equal(fender.miscategorized.countsInTotal, false);
  assert.ok(!fender.phase1.parts?.some((p) => p.lineId === "miscategorized"));
});

test("line 7, A+ content, reproduces the proposal", () => {
  rangeIs(fender.aplus, [39464, 66134, 106651]);
  near(touched(fender.aplus), 1309629, 1, "Fender sales of listings without A+");
  rangeIs(ledlenser.aplus, [70, 119, 193]);
  near(touched(ledlenser.aplus), 2328, 1, "Ledlenser sales of listings without A+");
  // The proposal counted 607 Fender listings without A+; the same-day read holds 605. Dollars match.
  assert.equal(fender.aplus.trail.coverage.total, 605);
  assert.equal(ledlenser.aplus.trail.coverage.total, 119);
  assert.equal(fender.aplus.trail.confidence, "medium");
});

test("A, near-term upside (Phase 1), reproduces the proposal less its retired Buy Box line", () => {
  // The proposal's Phase 1 ($603,107 / $1,050,952 / $1,549,516 for Fender) less its line 2, which
  // R-06 replaced on 23 Nov 2026 and which the 17 Nov read cannot price (no Buy Box state stored).
  rangeIs(fender.phase1, [551015, 939822, 1401051], 2);
  rangeIs(ledlenser.phase1, [10554, 16157, 21888], 2);
  assert.deepEqual(fender.phase1.parts?.map((p) => p.lineId), ["out_of_stock", "buy_box", "splintered", "missing_specs", "aplus"]);
  // Share of measured Amazon sales (mid): 4.5% and 13.2%.
  near(fender.catalog.measuredAnnualSales, 20695240, 1, "Fender measured sales");
  near(ledlenser.catalog.measuredAnnualSales, 122373, 1, "Ledlenser measured sales");
  assert.equal(((fender.phase1.range!.mid / fender.catalog.measuredAnnualSales) * 100).toFixed(1), "4.5");
  assert.equal(((ledlenser.phase1.range!.mid / ledlenser.catalog.measuredAnnualSales) * 100).toFixed(1), "13.2");
  // Ledlenser's splintered line is Not available* and is named, not added as $0.
  assert.ok(ledlenser.phase1.trail.notes.some((n) => n.includes("Splintered listings")));
});

test("B, measured total, reproduces the proposal from its AI lines", () => {
  // Lines 8 and 9 are built in chunk E5; their proposal values are inputs here.
  const f = rollupMeasuredTotal(fender.phase1, { unbranded: { low: 11255, mid: 90040, high: 337649 }, branded: null, retailerShare: 0.231 }, fender.catalog);
  // The proposal's [611,762, 1,120,193, 1,809,168] less the retired line 2.
  rangeIs(f, [559670, 1009063, 1660703], 2);
  const l = rollupMeasuredTotal(
    ledlenser.phase1,
    { unbranded: { low: 306, mid: 2447, high: 9178 }, branded: { low: 71, mid: 567, high: 2125 }, retailerShare: 0.103 },
    ledlenser.catalog,
  );
  rangeIs(l, [10892, 18861, 32027], 2);
});

/** True when a figure rounds to the proposal's printed one: "$11.9K" allows 11,850 to 11,950. */
function printsAs(actual: number | undefined, printed: string): boolean {
  const m = /^\$([\d,]+)(?:\.(\d+))?([KM]?)$/.exec(printed);
  if (!m || typeof actual !== "number") return false;
  const unit = m[3] === "M" ? 1e6 : m[3] === "K" ? 1e3 : 1;
  const value = Number(`${m[1].replace(/,/g, "")}.${m[2] ?? "0"}`) * unit;
  const step = unit / 10 ** (m[2]?.length ?? 0);
  return Math.abs(actual - value) <= step / 2 + 1;
}

test("section 1 table, as printed for Brian", () => {
  const rows: Array<[string, EstimateResult, EstimateResult, [string, string, string], [string, string, string] | null]> = [
    ["1 Out of stock", fender.outOfStock, ledlenser.outOfStock, ["$368K", "$490K", "$552K"], ["$8.9K", "$11.9K", "$13.3K"]],
    ["3 MAP leakage", fender.mapLeakage, ledlenser.mapLeakage, ["$26K", "$39K", "$52K"], ["$23K", "$35K", "$47K"]],
    ["4 Splintered", fender.splintered, ledlenser.splintered, ["$18K", "$55K", "$90K"], null],
    ["5 Missing specs", fender.missingSpecs, ledlenser.missingSpecs, ["$126K", "$328K", "$653K"], ["$1.6K", "$4.2K", "$8.3K"]],
    ["7 A+ content", fender.aplus, ledlenser.aplus, ["$39K", "$66K", "$107K"], ["$70", "$119", "$193"]],
    // Less the retired line 2 (the proposal printed $0.60M / $1.05M / $1.55M and $11.0K / $17.1K / $23.2K).
    ["A Phase 1", fender.phase1, ledlenser.phase1, ["$0.55M", "$0.94M", "$1.40M"], ["$10.6K", "$16.2K", "$21.9K"]],
  ];
  for (const [name, f, l, fExpected, lExpected] of rows) {
    (["low", "mid", "high"] as const).forEach((level, i) => {
      assert.ok(printsAs(f.range?.[level], fExpected[i]), `Fender ${name} ${level}: ${f.range?.[level]} should print as ${fExpected[i]}`);
      if (lExpected) assert.ok(printsAs(l.range?.[level], lExpected[i]), `Ledlenser ${name} ${level}: ${l.range?.[level]} should print as ${lExpected[i]}`);
      else assert.equal(l.range, null, `Ledlenser ${name} is not estimated`);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Formula and overlap rules on small hand-checked inputs
// ---------------------------------------------------------------------------------------------

const listing = (over: Partial<EstimateListingInput>): EstimateListingInput => ({ asin: "A1", smartscoutHasRecord: true, ...over });

test("out of stock: sales per in-stock day x out-of-stock days x brand-loss share", () => {
  const r = estimateOutOfStock([listing({ baselineDailyRevenue: 100, oosDays365: 10, smartscoutTtmRevenue: 35500, inStockDays365: 355 })]);
  assert.deepEqual(r.range, { low: 300, mid: 400, high: 450 });
  assert.equal(r.trail.listings[0].touchedSales, 1000);
  assert.equal(r.asterisk, false);
  assert.equal(r.trail.coverage.tooltip, null);
  // The view's own missed-sales figure wins when present.
  const v = estimateOutOfStock([listing({ baselineDailyRevenue: 100, oosDays365: 10, missedSalesOos365: 1004.4 })]);
  assert.equal(v.trail.listings[0].touchedSales, 1004.4);
});

test("Buy Box (R-06): sales per Buy Box day x 365 days x 70/80/90%, for a year in Phase 1", () => {
  // $600 in the last 30 days over 20 Buy Box days = $30 a day; x 365 = $10,950.
  const r = estimateBuyBox([listing({ buyBoxWithheld: true, smartscoutMonthlyRevenue: 600, inStockDays30: 25, noBuyBoxDays30: 5 })]);
  assert.deepEqual(r.range, { low: 7665, mid: 8760, high: 9855 });
  assert.equal(BUY_BOX_LOST_SHARE.mid, 0.8);
  assert.equal(BRAND_LOSS_SHARE.mid, 0.4);
  assert.ok(!r.trail.benchmarks.includes(BRAND_LOSS_SHARE), "no brand-loss share on the Buy Box");
});

test("one day, one cause: the out-of-stock line prices past days, the Buy Box line only today's withheld listings", () => {
  const l = listing({ baselineDailyRevenue: 100, oosDays365: 10, noBuyBoxDays365: 5, inStockDays365: 355 });
  assert.equal(estimateOutOfStock([l]).trail.listings[0].touchedSales, 1000);
  // Not withheld today: past days without a Buy Box are not priced any more.
  assert.equal(estimateBuyBox([l]).trail.coverage.total, 0);
});

test("MAP: gap x monthly units x 12 x 50/75/100%, only below MAP", () => {
  const r = estimateMapLeakage([
    listing({ amzLeakage: -20, smartscoutMonthlyUnits: 10 }),
    listing({ asin: "A2", amzLeakage: 5, smartscoutMonthlyUnits: 10 }),
    listing({ asin: "A3", amzLeakage: null, smartscoutMonthlyUnits: 10 }),
  ]);
  assert.deepEqual(r.range, { low: 1200, mid: 1800, high: 2400 });
  assert.equal(r.trail.coverage.total, 1);
  assert.equal(MAP_VOLUME_KEPT.high, 1);
});

test("content: one problem gets its own lift", () => {
  const c = estimateContent([listing({ smartscoutTtmRevenue: 100000, aplusState: "absent", amazonCompletenessPct: 100 })]);
  assert.deepEqual(c.aplus.range, { low: 3000, mid: 5000, high: 8000 });
  assert.equal(c.missing_specs.trail.coverage.total, 0);
  assert.equal(c.splintered.trail.coverage.total, 0);
});

test("content: spec bands are below 70, 70 to 84, 85 to 99", () => {
  assert.equal(specLiftBand(38.5)?.id, "below_70");
  assert.equal(specLiftBand(69.9)?.id, "below_70");
  assert.equal(specLiftBand(70)?.id, "70_to_84");
  assert.equal(specLiftBand(84.6)?.id, "70_to_84");
  assert.equal(specLiftBand(85)?.id, "85_to_99");
  assert.equal(specLiftBand(99.9)?.id, "85_to_99");
  assert.equal(specLiftBand(100), null);
  assert.equal(specLiftBand(null), null);
  assert.deepEqual(SPEC_LIFT_BANDS.map((b) => [b.benchmark.low, b.benchmark.mid, b.benchmark.high]), [[0.05, 0.1, 0.2], [0.03, 0.06, 0.12], [0.01, 0.03, 0.06]]);
});

test("overlap rule 3: content lifts combine, are capped at 30%, and are shared in proportion", () => {
  // The proposal's splintered Fender listing: splintered (5/15/30%) and specs at 85 to 99% (1/3/6%).
  const l = listing({ smartscoutTtmRevenue: 359678.55, isBundle: true, parentAsin: null, amazonCompletenessPct: 92.3, aplusState: "present" });
  const lifts = contentLifts(l);
  assert.deepEqual(lifts.map((x) => x.lineId), ["splintered", "missing_specs"]);
  const { shares, capped } = combinedLiftShares(lifts);
  const s = shares.get("splintered")!;
  const p = shares.get("missing_specs")!;
  // Low: 1.05 x 1.01 - 1 = 6.05%. Mid: 1.15 x 1.03 - 1 = 18.45%. High: 1.30 x 1.06 - 1 = 37.8%, capped at 30%.
  near(s.low + p.low, 0.0605, 1e-9, "combined low");
  near(s.mid + p.mid, 0.1845, 1e-9, "combined mid");
  near(s.high + p.high, 0.3, 1e-9, "combined high");
  assert.equal(capped, true);
  near(s.mid / p.mid, SPLINTERED_LIFT.mid / 0.03, 1e-9, "shared in proportion");
  const c = estimateContent([l]);
  rangeIs(c.splintered, [18134, 55301, 89920]);
  // The two lines add up to the capped combined lift, never more.
  near(c.splintered.range!.high + c.missing_specs.range!.high, 359678.55 * 0.3, 1, "capped total");
});

test("overlap rule 3: three problems never credit more than 30% of a listing's sales", () => {
  const l = listing({ smartscoutTtmRevenue: 1000, isBundle: true, parentAsin: null, amazonCompletenessPct: 40, aplusState: "absent" });
  const c = estimateContent([l]);
  const high = c.splintered.range!.high + c.missing_specs.range!.high + c.aplus.range!.high;
  near(high, 300, 2, "high is capped");
  // Mid: 1.15 x 1.10 x 1.05 - 1 = 32.8%, capped too.
  near(c.splintered.range!.mid + c.missing_specs.range!.mid + c.aplus.range!.mid, 300, 2, "mid is capped");
  // Low: 1.05 x 1.05 x 1.03 - 1 = 13.6%, under the cap.
  near(c.splintered.range!.low + c.missing_specs.range!.low + c.aplus.range!.low, 135.6, 2, "low is not capped");
  assert.equal(APLUS_LIFT.high, 0.08);
});

test("a listing with no sales figure is Not available*, never $0", () => {
  const r = estimateOutOfStock([listing({ oosDays365: 40, smartscoutHasRecord: false })], MEASURED);
  assert.equal(r.status, "not_available");
  assert.equal(r.range, null);
  assert.equal(r.asterisk, true);
  assert.equal(r.trail.coverage.sentence, "0 of 1 listings measured, 1 Not available*");
  assert.equal(r.trail.listings[0].range, null);
  const none = rollupPhase1([r], catalogSalesCoverage([], MEASURED));
  assert.equal(none.status, "not_available");
  assert.equal(none.range, null);
});

test("rule 8: low totals add the lows, high totals add the highs", () => {
  const parts = fender.phase1.parts!;
  for (const level of ["low", "mid", "high"] as const) {
    const sum = parts.reduce((s, p) => s + (p.range?.[level] ?? 0), 0);
    near(fender.phase1.range![level], sum, 0, `phase 1 ${level}`);
  }
});

test("every result carries a full trail", () => {
  for (const r of [fender.outOfStock, fender.buyBox, fender.mapLeakage, fender.splintered, fender.missingSpecs, fender.aplus, fender.phase1]) {
    assert.equal(r.label, "analyst estimate");
    assert.ok(r.trail.formula.length > 20, `${r.lineId} formula`);
    assert.ok(r.trail.means.length > 20, `${r.lineId} means`);
    assert.ok(r.trail.inputs.length >= 3, `${r.lineId} inputs`);
    assert.ok(r.trail.benchmarks.length >= 1, `${r.lineId} benchmarks`);
    assert.ok(["high", "medium", "low"].includes(r.trail.confidence));
    assert.ok(r.trail.confidenceReason.length > 10);
    const c = r.trail.coverage;
    assert.equal(c.measured + c.estimated + c.notAvailable, c.total, `${r.lineId} coverage adds up`);
    assert.equal(r.asterisk, c.partial);
    if (c.partial) assert.match(c.tooltip ?? "", /^Based on [\d,]+ of [\d,]+ listings \([\d,]+ measured, [\d,]+ estimated\)$/);
    assert.ok((r.trail.mostImprovedBy ?? "").length > 10, `${r.lineId} names its best improvement`);
    // An IntoFocus assumption with no published source has no date.
    for (const i of r.trail.inputs) if (i.kind !== "assumption") assert.ok(i.asOf, `${r.lineId} input ${i.key} has an as-of date`);
    assert.ok(!/—/.test(JSON.stringify(r.trail)), `${r.lineId} has no em dash`);
  }
  assert.equal(fender.outOfStock.trail.coverage.tooltip, "Based on 383 of 609 listings (383 measured, 0 estimated)");
  assert.equal(fender.outOfStock.trail.inputs.find((i) => i.key === "oos_days")?.asOf, "2026-11-17");
  assert.equal(fender.outOfStock.trail.inputs.find((i) => i.key === "brand_loss_share")?.asOf, "2018, reported Mar 2019");
  assert.equal(fender.outOfStock.trail.listings.length, 609);
  assert.ok(fender.outOfStock.trail.sources.some((s) => s.id === "corstenGruenOnlineUnh"));
});

test("benchmarks: every value has a range, a credibility note and unverified sources", () => {
  const ids = new Set<string>();
  for (const b of ALL_BENCHMARKS) {
    assert.ok(!ids.has(b.id), `${b.id} is listed once`);
    ids.add(b.id);
    assert.ok(b.low <= b.mid && b.mid <= b.high, `${b.id} low <= mid <= high`);
    assert.ok(b.credibility.length > 10, `${b.id} credibility`);
    if (b.basis === "published") assert.ok(b.sources.length > 0, `${b.id} cites a source`);
  }
  for (const s of [...Object.values(SOURCES), ...RANK_CURVE_METHOD_SOURCES]) {
    // Worker 29.1 checked every page (docs/benchmark-register.md): verified only with the quote read there.
    if (s.verified) assert.ok(s.quote && s.checked, `${s.id} is verified with its quote and check`);
    assert.ok(s.title && s.date && s.credibility && s.usedFor, `${s.id} is complete`);
    if (s.url !== null) assert.match(s.url, /^https:\/\//, `${s.id} url`);
  }
  assert.deepEqual([BRAND_LOSS_SHARE.low, BRAND_LOSS_SHARE.mid, BRAND_LOSS_SHARE.high], [0.3, 0.4, 0.45]);
  // Brian Magazu, 23 Nov 2026 (R-06): 70% to 90%, mid 80%.
  assert.deepEqual([BUY_BOX_LOST_SHARE.low, BUY_BOX_LOST_SHARE.mid, BUY_BOX_LOST_SHARE.high], [0.7, 0.8, 0.9]);
  assert.deepEqual([MAP_VOLUME_KEPT.low, MAP_VOLUME_KEPT.mid, MAP_VOLUME_KEPT.high], [0.5, 0.75, 1]);
  assert.deepEqual([SPLINTERED_LIFT.low, SPLINTERED_LIFT.mid, SPLINTERED_LIFT.high], [0.05, 0.15, 0.3]);
  assert.deepEqual([APLUS_LIFT.low, APLUS_LIFT.mid, APLUS_LIFT.high], [0.03, 0.05, 0.08]);
});
