// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/buy-box-forward.test.ts
//
// R-06 and R-07 (Brian Magazu, 23 Nov 2026): the one Buy Box dollar figure. For each listing withheld
// today: sales per day with the Buy Box over the last 30 days x the days in the date pill's period x
// the share of sales lost while withheld (70% / 80% / 90%). Synthetic listings, hand-checked.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BUY_BOX_LOST_SHARE } from "../lib/estimates/benchmarks.ts";
import {
  buyBoxDays30,
  buyBoxDays365,
  buyBoxForPeriod,
  buyBoxListingMath,
  buyBoxRate,
  buyBoxRateSplitText,
  estimateBuyBox,
  MIN_BUY_BOX_DAYS_30,
  MIN_BUY_BOX_DAYS_365,
  YEAR_DAYS,
} from "../lib/estimates/buy-box.ts";
import { buildClientEstimates, joinEstimateListings } from "../lib/estimates/live-inputs.ts";
import { DEFAULT_PERIOD_DAYS, daysInclusive, periodDaysFor } from "../lib/estimates/period.ts";
import type { EstimateListingInput } from "../lib/estimates/types.ts";
import { BUY_BOX_CAUSE_ROW_IDS, BUY_BOX_ROW_ID, buyBoxRowEstimate, fixRowFigure } from "../lib/fender-canvas/action-items-buybox-rows.ts";
import { fixRowMonthly } from "../lib/fender-canvas/action-items-fix-list.ts";

const withheld = (asin: string, over: Partial<EstimateListingInput> = {}): EstimateListingInput => ({
  asin,
  buyBoxWithheld: true,
  smartscoutHasRecord: true,
  inStockDays30: 30,
  noBuyBoxDays30: 10,
  ...over,
});

/**
 * A: $600 over 20 Buy Box days = $30 a day.        B: $1,000 over 25 days = $40 a day.
 * C: SmartScout reports no sales, 28 days: $0.      D: 6 Buy Box days: Not available*.
 * E: no SmartScout record: Not available*.          F: no Keepa days: Not available*.
 * G: not withheld today, 100 days without a Buy Box in the last year: not in the figure at all.
 */
const LISTINGS: EstimateListingInput[] = [
  withheld("A", { smartscoutMonthlyRevenue: 600 }),
  withheld("B", { smartscoutMonthlyRevenue: 1000, inStockDays30: 28, noBuyBoxDays30: 3 }),
  withheld("C", { smartscoutMonthlyRevenue: 0, noBuyBoxDays30: 2 }),
  withheld("D", { smartscoutMonthlyRevenue: 900, inStockDays30: 26, noBuyBoxDays30: 20 }),
  withheld("E", { smartscoutHasRecord: false }),
  withheld("F", { smartscoutMonthlyRevenue: 500, inStockDays30: null, noBuyBoxDays30: null }),
  { asin: "G", buyBoxWithheld: false, smartscoutHasRecord: true, baselineDailyRevenue: 100, noBuyBoxDays365: 100, smartscoutMonthlyRevenue: 3000, inStockDays30: 30, noBuyBoxDays30: 0 },
];

const row = (r: ReturnType<typeof estimateBuyBox>, asin: string) => r.trail.listings.find((l) => l.asin === asin);

test("per listing: sales in the last 30 days / days with the Buy Box = sales per Buy Box day", () => {
  assert.equal(buyBoxDays30(LISTINGS[0]!), 20);
  assert.deepEqual(buyBoxRate(LISTINGS[0]!), { ok: true, window: "last_30_days", sales: 600, buyBoxDays: 20, perDay: 30, reportedNoSales: false });
  assert.deepEqual(buyBoxRate(LISTINGS[1]!), { ok: true, window: "last_30_days", sales: 1000, buyBoxDays: 25, perDay: 40, reportedNoSales: false });
  assert.equal(MIN_BUY_BOX_DAYS_30, 7);
});

test("per listing math over 30 days with the 70% / 80% / 90% range", () => {
  const r = estimateBuyBox(LISTINGS, {}, 30);
  // A: $30 x 30 = $900 -> 630 / 720 / 810. B: $40 x 30 = $1,200 -> 840 / 960 / 1,080. C: $0.
  assert.deepEqual(row(r, "A")!.range, { low: 630, mid: 720, high: 810 });
  assert.deepEqual(row(r, "B")!.range, { low: 840, mid: 960, high: 1080 });
  assert.deepEqual(row(r, "C")!.range, { low: 0, mid: 0, high: 0 });
  assert.deepEqual(r.range, { low: 1470, mid: 1680, high: 1890 });
  assert.equal(r.label, "analyst estimate");
  assert.deepEqual([BUY_BOX_LOST_SHARE.low, BUY_BOX_LOST_SHARE.mid, BUY_BOX_LOST_SHARE.high], [0.7, 0.8, 0.9]);
  assert.equal(BUY_BOX_LOST_SHARE.basis, "approved_assumption");
  assert.match(BUY_BOX_LOST_SHARE.credibility, /IntoFocus analyst assumption, Brian Magazu 23 Nov 2026/);
  const share = r.trail.inputs.find((i) => i.key === "buy_box_lost_share");
  assert.equal(share?.value, "70% low, 80% mid, 90% high");
});

test("period switching: the figure scales with the days in the date pill", () => {
  const at = (days: number) => estimateBuyBox(LISTINGS, {}, days).range!;
  assert.deepEqual(at(90), { low: 4410, mid: 5040, high: 5670 });
  assert.deepEqual(at(YEAR_DAYS), { low: 17885, mid: 20440, high: 22995 });
  for (const days of [7, 30, 61, 90, 365]) {
    assert.ok(Math.abs(at(days).mid - (at(30).mid * days) / 30) <= 1, `${days} days scales from 30`);
    assert.equal(estimateBuyBox(LISTINGS, {}, days).trail.inputs.find((i) => i.key === "period_days")?.value, days);
  }
  // The pill's selection to days.
  assert.equal(periodDaysFor({ kind: "month" }), 30);
  assert.equal(periodDaysFor({ kind: "range", from: "2026-10-01", to: "2026-12-29" }), 90);
  assert.equal(periodDaysFor({ kind: "range", from: "2026-11-23", to: "2026-11-23" }), 1);
  assert.equal(periodDaysFor({ kind: "all" }, { windowEnd: "2026-11-20", runDays: ["2026-10-31", null, "2026-11-10"] }), 21);
  assert.equal(periodDaysFor({ kind: "all" }, { runDays: [] }), DEFAULT_PERIOD_DAYS);
  assert.equal(periodDaysFor({ kind: "run", runId: "r1" }), DEFAULT_PERIOD_DAYS);
  assert.equal(daysInclusive("2026-11-30", "2026-11-01"), null);
});

test("missing sales history reads Not available* with its reason, never $0", () => {
  const r = estimateBuyBox(LISTINGS, {}, 30);
  for (const asin of ["D", "E", "F"]) {
    assert.equal(row(r, asin)!.range, null, `${asin} has no figure`);
    assert.equal(row(r, asin)!.salesSource, "none");
  }
  assert.match(String(row(r, "D")!.detail.notAvailable), /held the Buy Box on 6 of the last 30 days/);
  assert.match(String(row(r, "E")!.detail.notAvailable), /SmartScout has no sales record/);
  assert.match(String(row(r, "F")!.detail.notAvailable), /Keepa has no day history/);
  assert.equal(r.asterisk, true);
  assert.equal(r.trail.coverage.sentence, "3 of 6 listings measured (1 with no sales), 3 Not available*");
  assert.equal(r.trail.coverage.tooltip, "Based on 3 of 6 listings (3 measured, 0 estimated)");
  // Every listing missing: Not available*, no range, never $0.
  const none = estimateBuyBox(LISTINGS.filter((l) => ["D", "E", "F"].includes(l.asin)), {}, 30);
  assert.equal(none.status, "not_available");
  assert.equal(none.range, null);
});

test("no backward-looking Buy Box figure remains", () => {
  const r = estimateBuyBox(LISTINGS, {}, 30);
  // G lost the Buy Box on 100 days last year and has it today: it is not in the figure.
  assert.equal(row(r, "G"), undefined);
  assert.equal(r.trail.coverage.total, 6);
  // The 12-month window is only a sales-rate fallback now: no input counts days without a Buy Box.
  assert.ok(!r.trail.inputs.some((i) => /^no_buy_box_days|without a Buy Box/.test(`${i.key} ${i.label}`)));
  assert.ok(!r.trail.benchmarks.some((b) => b.id === "brand_loss_share"));
  assert.match(r.trail.formula, /^For each listing Amazon withholds the Buy Box from today/);
  // No source names the old line, its title, or its 12-month formula.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  for (const dir of ["lib", "components", "app"]) walk(new URL(`../${dir}`, import.meta.url).pathname);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.ok(!src.includes("Buy Box lost on any day in the last 12 months"), `${file} names the old line`);
    assert.ok(!/days with stock and no Buy Box in the last 12 months x the share/.test(src), `${file} keeps the old formula`);
  }
});

test("one figure everywhere: Suppressed Listings, Action Items rows, Priorities' monthly, and Phase 1's year", () => {
  const est = buildClientEstimates(LISTINGS, { rankCategory: null, dataAsOf: "2026-11-23", salesSources: "measured_only" });
  for (const days of [30, 90]) {
    const panel = buyBoxForPeriod(est, days);
    assert.equal(buyBoxForPeriod(est, days), panel, "cached per period");
    assert.deepEqual(fixRowFigure(BUY_BOX_ROW_ID, est, null, days)!.range, panel.range);
  }
  // Priorities and the rank reason: the 30-day figure, R-06's monthly opportunity.
  assert.equal(fixRowMonthly(BUY_BOX_ROW_ID, est), buyBoxForPeriod(est, 30).range!.mid);
  assert.equal(fixRowMonthly(BUY_BOX_ROW_ID, est), 1680);
  // Phase 1 counts a year of the same figure.
  assert.deepEqual(est.buyBox.range, buyBoxForPeriod(est, YEAR_DAYS).range);
  assert.ok(est.phase1.parts?.some((p) => p.lineId === "buy_box" && p.range?.mid === 20440));
  // The earlier-days row has no dollar.
  const split = { withheld: 2, price: 1, other: 1, priceAsins: new Set(["A"]), otherAsins: new Set(["B"]) };
  assert.equal(fixRowFigure(BUY_BOX_CAUSE_ROW_IDS.earlier, est, split, 30), null);
  assert.deepEqual(fixRowFigure(BUY_BOX_CAUSE_ROW_IDS.price, est, split, 30)!.range, { low: 630, mid: 720, high: 810 });
});

test("the join reads the withheld state, SmartScout's 30 days and Keepa's 30-day Buy Box days", () => {
  const [l] = joinEstimateListings(
    {
      sales: [{ asin: "A1", smartscout_snapshot_date: "2026-11-20", smartscout_monthly_revenue: "600", in_stock_days_30: 30, no_buy_box_days_30: "10" }],
      retail: [{ asin: "A1", featured_offer_state: "withheld" }],
      spec: [],
      content: [],
    },
    null,
  );
  assert.equal(l!.buyBoxWithheld, true);
  assert.equal(l!.smartscoutMonthlyRevenue, 600);
  assert.equal(l!.noBuyBoxDays30, 10);
  const [present] = joinEstimateListings({ sales: [{ asin: "A2" }], retail: [{ asin: "A2", featured_offer_state: "present" }], spec: [], content: [] }, null);
  assert.equal(present!.buyBoxWithheld, false);
});

test("the trail is written for an operator: plain words, brand voice", () => {
  const r = estimateBuyBox(LISTINGS, {}, 30);
  const text = [r.trail.title, r.trail.means, r.trail.formula, ...r.trail.notes, r.trail.confidenceReason, r.trail.mostImprovedBy ?? ""].join(" ");
  assert.ok(!/—|–/.test(text), "no em or en dash");
  assert.ok(!/\b\w+'(t|re|ll|ve|d)\b/i.test(text), "no contractions");
  assert.match(r.trail.formula, /30 days, the period in the date pill/);
  assert.match(r.trail.means, /over the next 30 days/);
  assert.match(estimateBuyBox(LISTINGS).trail.formula, /365 days \(a year\)/);
});

test("Suppressed Listings, Action Items and the Catalog Health header read the date pill", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("components/v3/live/SuppressedListingsPanel.tsx"), /<BuyBoxEstimateCard period=\{period\} \/>/);
  assert.match(read("components/v3/live/SuppressedListingsPanel.tsx"), /<BuyBoxListingCell period=\{period\} asin=\{asin\} \/>/);
  assert.match(read("components/v3/live/estimates/BuyBoxEstimate.tsx"), /useEstimatePeriodDays\(\)/);
  assert.match(read("components/v3/live/estimates/EstimateLineFigure.tsx"), /fixRowFigure\(itemId, read\.estimates, split, periodDays\)/);
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.equal(spokes.match(/headerAccessory: <RunHistoryControl \/>/g)?.length, 2, "AI Search and Competitive Radar keep the run pill");
  assert.equal(spokes.match(/headerAccessory: <RunHistoryControl mode="dates" \/>/g)?.length, 2, "Catalog Health and Action Items show date ranges only");
  assert.ok(!/period|30 days|month/i.test(read("components/v3/live/estimates/BuyBoxEstimate.tsx").match(/BUY_BOX_ESTIMATE_LABEL = "([^"]+)"/)![1]!), "the figure's label names no period");
});

// Round 2 (Brian Magazu, 23 Nov 2026): the 12-month fallback, never $0 for unknown, the dates-only pill.

/**
 * H: 6 Buy Box days in the last 30, 100 in the last 365, $36,500 in 12 months: falls back, $365 a day.
 * I: 20 Buy Box days in the last 30 and 300 in the last 365: keeps the 30-day rate.
 * J: no Keepa days for the last 30, 40 in the last 365, $8,000 in 12 months: falls back, $200 a day.
 * K: 6 in the last 30 and 29 in the last 365: neither rate, Not available*.
 * L: 6 in the last 30 and exactly 30 in the last 365, SmartScout reports no 12-month sales: measured $0.
 * M: no SmartScout record, 300 Buy Box days in the last 365: no fallback, Not available*.
 */
const FALLBACK: EstimateListingInput[] = [
  withheld("H", { smartscoutMonthlyRevenue: 900, inStockDays30: 26, noBuyBoxDays30: 20, inStockDays365: 300, noBuyBoxDays365: 200, smartscoutTtmRevenue: 36500 }),
  withheld("I", { smartscoutMonthlyRevenue: 600, inStockDays30: 30, noBuyBoxDays30: 10, inStockDays365: 365, noBuyBoxDays365: 65, smartscoutTtmRevenue: 99999 }),
  withheld("J", { inStockDays30: null, noBuyBoxDays30: null, inStockDays365: 60, noBuyBoxDays365: 20, smartscoutTtmRevenue: 8000 }),
  withheld("K", { smartscoutMonthlyRevenue: 900, inStockDays30: 26, noBuyBoxDays30: 20, inStockDays365: 200, noBuyBoxDays365: 171, smartscoutTtmRevenue: 5000 }),
  withheld("L", { smartscoutMonthlyRevenue: 0, inStockDays30: 26, noBuyBoxDays30: 20, inStockDays365: 200, noBuyBoxDays365: 170, smartscoutTtmRevenue: 0 }),
  withheld("M", { smartscoutHasRecord: false, inStockDays365: 365, noBuyBoxDays365: 65 }),
];

test("the 12-month rate is used only when the 30-day rate is not available", () => {
  const rate = (asin: string) => buyBoxRate(FALLBACK.find((l) => l.asin === asin)!);
  assert.deepEqual(rate("H"), { ok: true, window: "last_12_months", sales: 36500, buyBoxDays: 100, perDay: 365, reportedNoSales: false });
  assert.deepEqual(rate("I"), { ok: true, window: "last_30_days", sales: 600, buyBoxDays: 20, perDay: 30, reportedNoSales: false });
  assert.deepEqual(rate("J"), { ok: true, window: "last_12_months", sales: 8000, buyBoxDays: 40, perDay: 200, reportedNoSales: false });
  const m = rate("M");
  assert.equal(m.ok === false ? m.reason : null, "no_sales_source");
  assert.equal(buyBoxDays365(FALLBACK[0]!), 100);
  // Over 30 days: H $365 x 30 = $10,950; I $30 x 30 = $900; J $200 x 30 = $6,000; L $0. Sum $17,850 x 70 / 80 / 90%.
  const r = estimateBuyBox(FALLBACK, {}, 30);
  assert.deepEqual(r.range, { low: 12495, mid: 14280, high: 16065 });
  assert.equal(r.trail.inputs.find((i) => i.key === "listings_rate_30")?.value, 1);
  assert.equal(r.trail.inputs.find((i) => i.key === "listings_rate_12_months")?.value, 3);
  assert.equal(r.trail.inputs.find((i) => i.key === "sales_last_12_months")?.value, 44500);
  assert.equal(r.trail.inputs.find((i) => i.key === "buy_box_days_365")?.value, 170);
  assert.match(r.trail.formula, /fewer than 7 of those days, take its sales in the last 12 months and divide by the days in the last 365/);
  assert.equal(buyBoxRateSplitText(r), "1 priced on their last 30 days, 3 on their last 12 months, 2 Not available*.");
});

test("the 12-month rate needs 30 days with the Buy Box in the last 365", () => {
  assert.equal(MIN_BUY_BOX_DAYS_365, 30);
  const r = estimateBuyBox(FALLBACK, {}, 30);
  assert.equal(row(r, "K")!.range, null, "29 days is too few");
  assert.equal(row(r, "K")!.detail.notAvailableReason, "too_few_buy_box_days");
  assert.equal(
    row(r, "K")!.detail.notAvailable,
    "It held the Buy Box on 6 of the last 30 days and 29 of the last 365. A daily sales rate needs at least 7 days with the Buy Box in the last 30, or at least 30 in the last 365.",
  );
  assert.deepEqual(row(r, "L")!.range, { low: 0, mid: 0, high: 0 }, "exactly 30 days is enough; SmartScout reports no sales, so a measured $0");
  assert.equal(row(r, "L")!.detail.rateWindow, "last_12_months");
  assert.match(String(row(r, "M")!.detail.notAvailable), /no sales rate for the last 30 days or the last 12 months/);
});

test("each listing's tooltip names the window its rate came from, in plain words", () => {
  const r = estimateBuyBox(FALLBACK, {}, 30);
  assert.equal(row(r, "I")!.detail.rateUsed, "last 30 days");
  assert.equal(row(r, "H")!.detail.rateUsed, "last 12 months");
  assert.equal(
    buyBoxListingMath(row(r, "I")!),
    "Rate from the last 30 days. $600.00 in the last 30 days over the 20 of the last 30 days it held the Buy Box is $30.00 a day. Times 30 days times 80% is $720; with 70% to 90%, $630 to $810.",
  );
  assert.equal(
    buyBoxListingMath(row(r, "H")!),
    "Rate from the last 12 months. $36,500.00 in the last 12 months over the 100 of the last 365 days it held the Buy Box is $365.00 a day. Times 30 days times 80% is $8.76K; with 70% to 90%, $7.66K to $9.86K.",
  );
  assert.equal(
    buyBoxListingMath(row(r, "L")!),
    "Rate from the last 12 months. SmartScout reports no sales for this listing in the last 12 months, so it adds $0. It held the Buy Box on 30 of the last 365 days.",
  );
  for (const asin of ["H", "I", "L"]) {
    const text = buyBoxListingMath(row(r, asin)!);
    assert.ok(!/—|–/.test(text) && !/\b\w+'(t|re|ll|ve|d)\b/i.test(text), "brand voice");
  }
});

test("the headline reads Not available*, never $0, when no priced listing has sales", () => {
  // Like Ledlenser on 23 Nov 2026: one listing priced at a measured $0, the rest with no SmartScout record.
  const listings = [FALLBACK.find((l) => l.asin === "L")!, withheld("N", { smartscoutHasRecord: false }), withheld("O", { smartscoutHasRecord: false })];
  const r = estimateBuyBox(listings, {}, 30);
  assert.equal(r.status, "not_available");
  assert.equal(r.range, null);
  assert.deepEqual(row(r, "L")!.range, { low: 0, mid: 0, high: 0 }, "the measured $0 keeps its own $0 row");
  const figure = buyBoxRowEstimate(r);
  assert.equal(figure.status, "not_available");
  assert.equal(figure.range, null);
  assert.deepEqual([figure.priced, figure.listings], [1, 3]);
  assert.equal(
    figure.tip,
    "1 of 3 withheld listings could be priced, and SmartScout reports no sales for it, so the figure is not known rather than $0. Of the rest, 2 have no SmartScout sales record.",
  );
  // A row where nothing could be priced says so, with the reasons.
  const none = buyBoxRowEstimate(estimateBuyBox(listings.slice(1), {}, 30));
  assert.equal(none.tip, "None of the 2 withheld listings could be priced: 2 have no SmartScout sales record.");
  // Priorities, the map and rank ties get no dollar, not "$0 a month"; Phase 1 leaves the line out.
  const est = buildClientEstimates(listings, { rankCategory: null, dataAsOf: "2026-11-23", salesSources: "measured_only" });
  assert.equal(fixRowMonthly(BUY_BOX_ROW_ID, est), null);
  assert.equal(est.buyBox.range, null);
  assert.ok(est.phase1.trail.notes.some((n) => /Not available\* and left out: .*Buy Box withheld/.test(n)));
  // With one listing that has sales, the figure is known again, $0 rows and all.
  const known = estimateBuyBox([...listings, FALLBACK[1]!], {}, 30);
  assert.equal(known.status, "estimated");
  assert.equal(buyBoxRowEstimate(known).tip, undefined);
});

test("Catalog Health and Action Items: the pill offers date ranges only; the AI views keep runs", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const control = read("components/v3/live/ai-search/RunHistoryControl.tsx");
  assert.match(control, /export function RunHistoryControl\(\{ mode = "runs" \}: \{ mode\?: "runs" \| "dates" \} = \{\}\)/);
  // Latest run and Previous run sit inside the one block dates mode leaves out.
  const start = control.indexOf("{datesOnly ? null : (");
  const block = control.slice(start, control.indexOf("</>", start));
  assert.ok(start > 0);
  assert.match(block, /Latest run/);
  assert.match(block, /Previous run/);
  assert.equal(control.match(/Latest run|Previous run/g)?.length, 2, "no other run choice");
  // Dates mode never offers a single run: no run details, no View run.
  assert.match(control, /const chosen = selectedDay && !datesOnly/);
  assert.match(control, /\) : datesOnly \? null : \(\s*<button[\s\S]*?View run/);
  const spokes = read("components/v3/build-live-spokes.tsx");
  const retail = spokes.slice(spokes.indexOf('id === "ecommerce"'), spokes.indexOf('id === "aeo"'));
  assert.equal(retail.match(/<RunHistoryControl mode="dates" \/>/g)?.length, 2);
  assert.ok(!/<RunHistoryControl \/>/.test(retail), "no run pill on Catalog Health or Action Items");
});
