// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimates-sales-coverage.test.ts
//
// Decision 112: upside covers the whole catalog. A listing with no SmartScout or brand-reported
// sales is estimated from Keepa's bought-in-past-month figure, else from its sales rank. Every
// figure reports N of M listings measured, K estimated, the rest Not available*.
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateOutOfStock } from "../lib/estimates/availability.ts";
import { KEEPA_MONTHLY_SOLD_MULTIPLIER, RANK_CURVES } from "../lib/estimates/benchmarks.ts";
import { estimateContent } from "../lib/estimates/content.ts";
import { estimateMapLeakage } from "../lib/estimates/map-annual.ts";
import { calibrateRankCurve, rankCurveBand, type RankCurve, type RankCurvePoint } from "../lib/estimates/rank-curve.ts";
import { estimateListingLines } from "../lib/estimates/rollup.ts";
import { buildCoverage, catalogSalesCoverage, rankCurvePoints, resolveListingSales } from "../lib/estimates/sales-coverage.ts";
import type { EstimateListingInput } from "../lib/estimates/types.ts";
import { loadEstimatesFixture } from "./fixtures/estimates/load.ts";

const near = (actual: number | undefined | null, expected: number, tolerance: number, label = "") =>
  assert.ok(typeof actual === "number" && Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);

const CURVE: RankCurve = {
  category: "Test",
  calibratedOn: "2026-11-17",
  basis: "test",
  listings: 40,
  maxCalibratedRank: 500000,
  bands: [
    { maxRank: 10000, listings: 20, low: 8, mid: 10, high: 12 },
    { maxRank: Number.POSITIVE_INFINITY, listings: 20, low: 0, mid: 1, high: 2 },
  ],
};
const ctx = { rankCurves: { Test: CURVE } };
const base: EstimateListingInput = { asin: "A1", price: 100, rankCategory: "Test", inStockDays365: 365, inStockDays30: 30, observedDays365: 365 };

// ---------------------------------------------------------------------------------------------
// Source order
// ---------------------------------------------------------------------------------------------

test("source order: brand-reported, then SmartScout, then Keepa, then sales rank, then none", () => {
  const all: EstimateListingInput = { ...base, brandReportedAnnualSales: 50000, smartscoutHasRecord: true, smartscoutTtmRevenue: 40000, keepaMonthlySold: 50, salesRank: 5000 };
  assert.equal(resolveListingSales(all, ctx).annual?.source, "brand_reported");
  assert.equal(resolveListingSales(all, ctx).annual?.range.mid, 50000);
  assert.equal(resolveListingSales({ ...all, brandReportedAnnualSales: null }, ctx).annual?.source, "smartscout");
  assert.equal(resolveListingSales({ ...all, brandReportedAnnualSales: null, smartscoutTtmRevenue: null }, ctx).annual?.source, "keepa_monthly_sold");
  const rankOnly = { ...base, salesRank: 5000 };
  assert.equal(resolveListingSales(rankOnly, ctx).annual?.source, "sales_rank_curve");
  assert.equal(resolveListingSales({ ...base }, ctx).annual, null);
  // Measured sales are a single figure; estimated sales are a range.
  assert.deepEqual(resolveListingSales({ ...all, brandReportedAnnualSales: null }, ctx).annual?.range, { low: 40000, mid: 40000, high: 40000 });
});

test("Keepa bought-in-past-month: floor x 1 / 1.5 / 2, per in-stock day, x in-stock days in the year", () => {
  assert.deepEqual([KEEPA_MONTHLY_SOLD_MULTIPLIER.low, KEEPA_MONTHLY_SOLD_MULTIPLIER.mid, KEEPA_MONTHLY_SOLD_MULTIPLIER.high], [1, 1.5, 2]);
  // In stock every day: 50+ a month at $100 is $60,000 to $120,000 a year over 360 days at 30 a month.
  const r = resolveListingSales({ ...base, keepaMonthlySold: 50, inStockDays365: 360 }, ctx);
  assert.deepEqual(r.monthlyUnits?.range, { low: 50, mid: 75, high: 100 });
  near(r.perInStockDay?.range.mid, (75 * 100) / 30, 1e-6, "per in-stock day");
  near(r.annual?.range.low, 60000, 1e-6, "annual low");
  near(r.annual?.range.mid, 90000, 1e-6, "annual mid");
  near(r.annual?.range.high, 120000, 1e-6, "annual high");
  // In stock 15 of the last 30 days and 100 of the last 365: the 50 units sold on 15 days.
  const part = resolveListingSales({ ...base, keepaMonthlySold: 50, inStockDays30: 15, inStockDays365: 100, oosDays365: 265 }, ctx);
  near(part.perInStockDay?.range.mid, (75 * 100) / 15, 1e-6, "rate uses in-stock days");
  near(part.annual?.range.mid, ((75 * 100) / 15) * 100, 1e-6, "annual is rate x in-stock days, not x 365");
  // SmartScout tracks the listing and reports no sales, but Amazon shows 50+ bought: Keepa is used.
  const tracked = resolveListingSales({ ...base, smartscoutHasRecord: true, smartscoutTtmRevenue: 0, keepaMonthlySold: 50 }, ctx);
  assert.equal(tracked.annual?.source, "keepa_monthly_sold");
  assert.equal(tracked.reportedNoSales, false);
});

test("sales rank: the band's units x price, for listings SmartScout does not track", () => {
  const r = resolveListingSales({ ...base, salesRank: 5000, inStockDays365: 300 }, ctx);
  assert.deepEqual(r.monthlyUnits?.range, { low: 8, mid: 10, high: 12 });
  near(r.perInStockDay?.range.mid, (10 * 100) / 30, 1e-6, "per in-stock day");
  near(r.annual?.range.mid, ((10 * 100) / 30) * 300, 1e-6, "annual is rate x in-stock days");
  assert.equal(r.detail.rankBandListings, 20);
  assert.equal(resolveListingSales({ ...base, salesRank: 200000 }, ctx).monthlyUnits?.range.mid, 1);
  // Worse than any tracked listing's rank: nothing to compare with.
  assert.equal(resolveListingSales({ ...base, salesRank: 600000 }, ctx).annual, null);
  // No curve for the category, no price, or no category: Not available*.
  assert.equal(resolveListingSales({ ...base, salesRank: 5000, rankCategory: "Other" }, ctx).annual, null);
  assert.equal(resolveListingSales({ ...base, salesRank: 5000, price: null }, ctx).annual, null);
  assert.equal(resolveListingSales({ ...base, salesRank: 5000, rankCategory: null }, ctx).annual, null);
});

test("a listing SmartScout tracks and reports no sales for is not priced from its rank", () => {
  const r = resolveListingSales({ ...base, smartscoutHasRecord: true, smartscoutTtmRevenue: 0, salesRank: 5000 }, ctx);
  assert.equal(r.annual, null);
  assert.equal(r.reportedNoSales, true);
  const c = buildCoverage([{ source: "none", reportedNoSales: true }, { source: "none" }, { source: "smartscout" }, { source: "sales_rank_curve" }]);
  assert.equal(c.notAvailable, 2);
  assert.equal(c.reportedNoSales, 1);
});

test("measured_only stops after brand-reported and SmartScout sales", () => {
  assert.equal(resolveListingSales({ ...base, keepaMonthlySold: 50, salesRank: 5000 }, { ...ctx, salesSources: "measured_only" }).annual, null);
});

test("an estimated listing's out-of-stock days are priced once", () => {
  // 100 in-stock days, 265 out. Annual sales cover the 100 days; the out-of-stock line covers the 265.
  const l = { ...base, salesRank: 5000, inStockDays365: 100, oosDays365: 265 };
  const rate = (10 * 100) / 30;
  near(resolveListingSales(l, ctx).annual?.range.mid, rate * 100, 1e-6, "annual");
  const oos = estimateOutOfStock([l], ctx);
  near(oos.trail.listings[0].touchedSales, rate * 265, 1e-6, "missed");
  near(oos.range?.mid, rate * 265 * 0.4, 1, "brand loss");
  // The range is the sales range times the benchmark range: low x low, high x high.
  near(oos.range?.low, ((8 * 100) / 30) * 265 * 0.3, 1, "low");
  near(oos.range?.high, ((12 * 100) / 30) * 265 * 0.55, 1, "high");
});

// ---------------------------------------------------------------------------------------------
// Coverage wording
// ---------------------------------------------------------------------------------------------

test("coverage: N of M measured, K estimated, the rest Not available*, asterisk and tooltip when partial", () => {
  const listings: EstimateListingInput[] = [
    { ...base, asin: "M1", smartscoutHasRecord: true, smartscoutTtmRevenue: 36500, baselineDailyRevenue: 100, oosDays365: 10 },
    { ...base, asin: "M2", smartscoutHasRecord: true, smartscoutTtmRevenue: 36500, baselineDailyRevenue: 100, oosDays365: 10 },
    { ...base, asin: "K1", keepaMonthlySold: 50, oosDays365: 10 },
    { ...base, asin: "R1", salesRank: 5000, oosDays365: 10 },
    { ...base, asin: "R2", salesRank: 5000, oosDays365: 10 },
    { ...base, asin: "N1", oosDays365: 10 },
    { ...base, asin: "Z1", smartscoutHasRecord: true, smartscoutTtmRevenue: 0, salesRank: 5000, oosDays365: 10 },
    { ...base, asin: "OK", smartscoutHasRecord: true, smartscoutTtmRevenue: 36500, baselineDailyRevenue: 100, oosDays365: 0 },
  ];
  const r = estimateOutOfStock(listings, ctx);
  const c = r.trail.coverage;
  assert.deepEqual([c.total, c.measured, c.estimated, c.notAvailable, c.reportedNoSales], [7, 2, 3, 2, 1]);
  assert.equal(c.sentence, "2 of 7 listings measured, 3 estimated, 2 Not available*");
  assert.equal(c.tooltip, "Based on 5 of 7 listings (2 measured, 3 estimated)");
  assert.equal(r.asterisk, true);
  assert.equal(r.trail.salesSources.smartscout.listings, 2);
  assert.equal(r.trail.salesSources.keepa_monthly_sold.listings, 1);
  assert.equal(r.trail.salesSources.sales_rank_curve.listings, 2);
  assert.equal(r.trail.salesSources.none.listings, 2);
  // The trail names the estimate and cites the method.
  assert.ok(r.trail.notes.some((n) => n.includes("3 listings have no SmartScout or brand-reported sales")));
  assert.ok(r.trail.sources.some((s) => s.id === "intofocusCalibration"));
  const row = r.trail.listings.find((x) => x.asin === "R1")!;
  assert.equal(row.salesBasis, "estimated");
  assert.ok(row.annualSalesRange && row.annualSalesRange.low < row.annualSalesRange.high);
  assert.equal(r.trail.listings.find((x) => x.asin === "N1")!.range, null);

  // Full coverage: no asterisk, no tooltip.
  const full = estimateOutOfStock(listings.slice(0, 5), ctx);
  assert.equal(full.asterisk, false);
  assert.equal(full.trail.coverage.tooltip, null);
  assert.equal(full.trail.coverage.sentence, "2 of 5 listings measured, 3 estimated");
});

test("confidence drops one grade when more than half the figure rests on estimated sales", () => {
  const measured = { ...base, asin: "M1", smartscoutHasRecord: true, baselineDailyRevenue: 100, oosDays365: 10 };
  const estimated = { ...base, asin: "K1", keepaMonthlySold: 500, oosDays365: 100 };
  assert.equal(estimateOutOfStock([measured], ctx).trail.confidence, "high");
  assert.equal(estimateOutOfStock([measured, estimated], ctx).trail.confidence, "medium");
});

test("estimated sales feed MAP and the content lines too", () => {
  const l = { ...base, salesRank: 5000, amzLeakage: -20, aplusState: "absent" };
  const map = estimateMapLeakage([l], ctx);
  // gap $20 x 8/10/12 units x 12 x 50/75/100%
  assert.deepEqual(map.range, { low: 960, mid: 1800, high: 2880 });
  assert.equal(map.trail.coverage.estimated, 1);
  const aplus = estimateContent([l], ctx).aplus;
  near(aplus.range?.mid, ((10 * 100) / 30) * 365 * 0.05, 1, "A+ on estimated sales");
});

// ---------------------------------------------------------------------------------------------
// Rank curve
// ---------------------------------------------------------------------------------------------

test("rank curve: band averages count listings that sold nothing, and never rise as rank worsens", () => {
  const points: RankCurvePoint[] = [];
  // 12 listings near rank 3,000: half sell 20 a month, half sell nothing. Average 10.
  for (let i = 0; i < 12; i++) points.push({ rank: 3000 + i, unitsPer30InStockDays: i % 2 === 0 ? 20 : 0 });
  // 12 near rank 50,000 averaging 1, then 12 near 100,000 averaging 2 (out of order: pooled to 1.5).
  for (let i = 0; i < 12; i++) points.push({ rank: 50000 + i, unitsPer30InStockDays: 1 });
  for (let i = 0; i < 12; i++) points.push({ rank: 100000 + i, unitsPer30InStockDays: 2 });
  // 4 near rank 900,000 that sold nothing: too few for a band, so they join the band above.
  for (let i = 0; i < 4; i++) points.push({ rank: 900000 + i, unitsPer30InStockDays: 0 });
  const curve = calibrateRankCurve(points, { category: "Test", calibratedOn: "2026-11-17", basis: "test" })!;
  assert.equal(curve.listings, 40);
  assert.equal(curve.maxCalibratedRank, 900003);
  assert.equal(curve.bands.length, 2);
  assert.equal(curve.bands[0].mid, 10);
  assert.equal(curve.bands[0].listings, 12);
  near(curve.bands[1].mid, 36 / 28, 1e-4, "pooled tail");
  assert.equal(curve.bands[1].maxRank, Number.POSITIVE_INFINITY);
  for (const b of curve.bands) assert.ok(b.low >= 0 && b.low <= b.mid && b.mid <= b.high);
  for (let i = 1; i < curve.bands.length; i++) assert.ok(curve.bands[i].mid <= curve.bands[i - 1].mid);
  // The range is the average plus or minus two standard errors.
  const se = Math.sqrt((12 * 100) / 11 / 12);
  near(curve.bands[0].low, 10 - 2 * se, 1e-3, "low");
  near(curve.bands[0].high, 10 + 2 * se, 1e-3, "high");
  assert.equal(rankCurveBand(curve, 2500)?.mid, 10);
  assert.equal(rankCurveBand(curve, 900004), null);
});

test("rank curve: too few tracked listings means no curve", () => {
  const few = Array.from({ length: 19 }, (_, i) => ({ rank: 1000 + i, unitsPer30InStockDays: 5 }));
  assert.equal(calibrateRankCurve(few, { category: "Test", calibratedOn: "2026-11-17", basis: "test" }), null);
});

test("rank curve points: tracked listings only, zeros included, 30 in-stock days needed", () => {
  const points = rankCurvePoints([
    { asin: "A", smartscoutHasRecord: true, smartscoutTtmRevenue: 36500, price: 100, salesRank: 1000, inStockDays365: 365 },
    { asin: "B", smartscoutHasRecord: true, smartscoutTtmRevenue: 0, price: 100, salesRank: 2000, inStockDays365: 365 },
    { asin: "C", smartscoutHasRecord: false, price: 100, salesRank: 3000, inStockDays365: 365 },
    { asin: "D", smartscoutHasRecord: true, smartscoutTtmRevenue: 100, price: 100, salesRank: 4000, inStockDays365: 20 },
    { asin: "E", smartscoutHasRecord: true, smartscoutTtmRevenue: 100, price: null, salesRank: 5000, inStockDays365: 365 },
  ]);
  assert.deepEqual(points, [
    { rank: 1000, unitsPer30InStockDays: 30 },
    { rank: 2000, unitsPer30InStockDays: 0 },
  ]);
});

test("the stored rank curves are the calibration of the 17 Nov 2026 read", () => {
  for (const client of ["fender", "ledlenser"] as const) {
    const fixture = loadEstimatesFixture(client);
    const stored = RANK_CURVES[fixture.rankCategory];
    assert.ok(stored, `${client} has a stored curve`);
    const fresh = calibrateRankCurve(rankCurvePoints(fixture.listings), { category: stored.category, calibratedOn: stored.calibratedOn, basis: stored.basis });
    assert.deepEqual(fresh, stored);
  }
  // A line fitted only to listings that sell would put about 73 units a month on Fender's tracked
  // listings ranked 160,000 to 320,000. They sold about 1. The curve's last band says so.
  const tail = RANK_CURVES["Musical Instruments"].bands.at(-1)!;
  assert.ok(tail.mid < 0.05);
});

// ---------------------------------------------------------------------------------------------
// Coverage on the two clients, before and after (read 17 Nov 2026)
// ---------------------------------------------------------------------------------------------

test("Ledlenser: sales coverage before and after", () => {
  const listings = loadEstimatesFixture("ledlenser").listings;
  assert.equal(listings.length, 214);
  const c = catalogSalesCoverage(listings);
  assert.equal(c.before.sentence, "24 of 214 listings measured, 190 Not available*");
  assert.equal(c.after.sentence, "24 of 214 listings measured, 68 estimated, 122 Not available*");
  assert.equal(c.after.tooltip, "Based on 92 of 214 listings (24 measured, 68 estimated)");
  assert.equal(c.after.reportedNoSales, 36);
  assert.equal(c.salesSources.keepa_monthly_sold.listings, 2);
  assert.equal(c.salesSources.sales_rank_curve.listings, 66);
  near(c.measuredAnnualSales, 122373, 1, "measured sales");
  near(c.annualSales.mid, 255652, 1, "measured plus estimated sales");

  const e = estimateListingLines(listings);
  const cov = (r: { trail: { coverage: { measured: number; estimated: number; notAvailable: number; total: number } } }) => {
    const x = r.trail.coverage;
    return [x.measured, x.estimated, x.notAvailable, x.total];
  };
  assert.deepEqual(cov(e.outOfStock), [21, 52, 93, 166]);
  assert.deepEqual(cov(e.buyBox), [14, 47, 61, 122]);
  assert.deepEqual(cov(e.mapLeakage), [9, 12, 12, 33]);
  assert.deepEqual(cov(e.missingSpecs), [21, 60, 105, 186]);
  assert.deepEqual(cov(e.aplus), [9, 34, 76, 119]);
  assert.deepEqual(e.phase1.range, { low: 23110, mid: 55248, high: 120458 });
  assert.equal(e.phase1.asterisk, true);
  // Measured listings are untouched: the measured part of each line is the proposal's figure.
  near(e.outOfStock.trail.salesSources.smartscout.estimate, 11866, 1, "measured part of out of stock");
});

test("Fender: sales coverage before and after", () => {
  // The fixture holds 5 rows that are only in the spec or content views; the sales view has 1,169.
  const listings = loadEstimatesFixture("fender").listings.filter((l) => l.inSalesView);
  assert.equal(listings.length, 1169);
  const c = catalogSalesCoverage(listings);
  assert.equal(c.before.sentence, "403 of 1,169 listings measured, 766 Not available*");
  assert.equal(c.after.sentence, "403 of 1,169 listings measured, 322 estimated, 444 Not available*");
  assert.equal(c.after.tooltip, "Based on 725 of 1,169 listings (403 measured, 322 estimated)");
  assert.equal(c.after.reportedNoSales, 262);
  assert.equal(c.salesSources.keepa_monthly_sold.listings, 0);
  assert.equal(c.salesSources.sales_rank_curve.listings, 322);
  near(c.measuredAnnualSales, 20695240, 1, "measured sales");
  near(c.annualSales.mid, 21997511, 1, "measured plus estimated sales");

  const e = estimateListingLines(loadEstimatesFixture("fender").listings);
  assert.deepEqual(e.phase1.range, { low: 668826, mid: 1218490, high: 2071162 });
  assert.equal(e.outOfStock.trail.coverage.sentence, "247 of 609 listings measured, 144 estimated, 218 Not available*");
  assert.equal(e.outOfStock.trail.confidence, "high");
});
