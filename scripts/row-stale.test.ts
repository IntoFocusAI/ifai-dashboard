// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/row-stale.test.ts
// X-25 per-row stale rule (Watson, 11 Nov 2026): a row is stale when its own check is older than twice its
// recheck interval, and a figure with any stale row carries the asterisk and "N of M listings checked".
import assert from "node:assert/strict";
import { test } from "node:test";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";
import { partialFigureTip } from "../lib/fender-canvas/canvas-reads.ts";
import { mapChannelStale, channelReadingNote } from "../lib/fender-canvas/map-reading-status.ts";
import {
  amazonSpecGapsFinding,
  mapLeakageFinding,
  suppressedListingsFinding,
  unnestedBundlesFinding,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { combineStale, mergePartial, RECHECK_DAYS, rowCoverage, rowsStale } from "../lib/fender-canvas/row-stale.ts";
import { lostSalesPartial, lostSalesStale, sumLostSales, type StockLossRow } from "../lib/fender-canvas/stock-loss.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-11T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const rule = (intervalDays: number) => ({ intervalDays, check: "price check", source: "canvas_retail_listings", figure: "figures" });

test("a row is stale after twice its recheck interval, not at it", () => {
  const at = (days: number) => [{ at: ago(days) }];
  const read = (days: number, interval: number) => rowsStale(at(days), (row) => row.at, rule(interval), NOW);
  assert.equal(read(2, 1), null, "exactly 2 days is inside the 1-day interval window");
  assert.ok(read(2.1, 1));
  assert.equal(read(4, 2), null);
  assert.ok(read(4.1, 2));
  assert.equal(read(6, RECHECK_DAYS.musiciansFriend), null);
  assert.ok(read(34, RECHECK_DAYS.musiciansFriend));
  assert.equal(read(14, RECHECK_DAYS.weekly), null);
  assert.ok(read(15, RECHECK_DAYS.weekly));
});

test("the tooltip reads N of M listings have no check in X days, counted per row", () => {
  const rows = [ago(0.5), ago(1), ago(30), null, ""].map((at) => ({ at }));
  const partial = rowsStale(rows, (row) => row.at, rule(1), NOW);
  assert.ok(partial);
  assert.equal(partial.reason, "coverage");
  assert.equal(partial.missing, "3 of 5 listings have no price check in 2 days");
  assert.equal(partial.lastCheck, ago(0.5));
  assert.equal(partialFigureTip(partial).split("\n").length, 2, "the lead line and the last check day");
  assert.doesNotMatch(partialFigureTip(partial), /canvas_|Source:/);
});

test("a fresh newest row does not clear the asterisk while another row is stale", () => {
  const partial = rowsStale([{ at: ago(0) }, { at: ago(9) }], (row) => row.at, rule(3), NOW);
  assert.equal(partial?.missing, "1 of 2 listings has no price check in 6 days");
});

test("an empty population and an all-current population have no asterisk", () => {
  assert.equal(rowsStale([], () => null, rule(1), NOW), null);
  assert.equal(rowsStale([{ at: ago(0.2) }], (row) => row.at, rule(1), NOW), null);
  assert.deepEqual(rowCoverage([{ at: "2026-11-10" }], (row) => row.at, 1, NOW).recent, 1, "a bare day is a UTC day");
});

test("combine and merge keep every stale part named", () => {
  const a = rowsStale([{ at: ago(9) }], (row) => row.at, rule(1), NOW);
  const b = rowsStale([{ at: ago(0) }, { at: ago(30) }], (row) => row.at, rule(3), NOW);
  const both = combineStale([{ label: "Amazon", stale: a }, { label: "Walmart", stale: null }, { label: "Musician's Friend", stale: b }]);
  assert.equal(
    both?.missing,
    "Amazon: 1 of 1 listing has no price check in 2 days\nMusician's Friend: 1 of 2 listings has no price check in 6 days",
  );
  assert.equal(combineStale([{ label: "Amazon", stale: null }]), null);
  assert.equal(mergePartial(null, a), a);
  assert.equal(mergePartial(a, null), a);
  assert.match(mergePartial(a, b)?.missing ?? "", /\n/);
});

function offerRow(asin: string, checkedAt: string | null) {
  return {
    asin,
    offer_price: 100,
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_checked_at: checkedAt,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 9000,
  } as Parameters<typeof suppressedListingsFinding>[0][number];
}

test("Buy Box and suppression: featured_offer_checked_at, stale after 2 days", () => {
  const current = suppressedListingsFinding([offerRow("A", ago(0.1)), offerRow("B", ago(1.5))], { now: NOW });
  assert.equal(current.stale ?? null, null);
  const reading = suppressedListingsFinding([offerRow("A", ago(0.1)), offerRow("B", ago(3))], { now: NOW });
  assert.equal(reading.stale?.missing, "1 of 2 listings has no Buy Box check in 2 days");
});

test("MAP leakage: Amazon 1 day, Walmart 1 day for Fender and 2 days for Ledlenser, Musician's Friend 3 days", () => {
  const row = (wmtAge: number) => ({
    asin: "A",
    map_price: 100,
    offer_price: 90,
    amz_leakage: -10,
    wmt_leakage: -5,
    mf_leakage: -2,
    featured_offer_checked_at: ago(0.1),
    wmt_checked_at: ago(wmtAge),
    mf_checked_at: ago(34),
  });
  try {
    resetActiveClientForTests("fender");
    const fender = mapLeakageFinding([row(3)], { now: NOW }).stale;
    assert.match(fender?.missing ?? "", /1 of 1 listing has no Walmart price check in 2 days/);
    assert.match(fender?.missing ?? "", /1 of 1 listing has no Musician's Friend price check in 6 days/);
    assert.doesNotMatch(fender?.missing ?? "", /Amazon/);

    resetActiveClientForTests("ledlenser");
    const ledlenser = mapLeakageFinding([{ ...row(3), mf_leakage: null, mf_checked_at: null }], { now: NOW }).stale;
    assert.equal(ledlenser ?? null, null, "3 days is inside Ledlenser's 4-day Walmart window and it has no Musician's Friend");
    const old = mapLeakageFinding([{ ...row(5), mf_leakage: null, mf_checked_at: null }], { now: NOW }).stale;
    assert.match(old?.missing ?? "", /1 of 1 listing has no Walmart price check in 4 days/);
  } finally {
    resetActiveClientForTests(null);
  }
});

test("channel lines carry a per-channel note from each channel's own listings", () => {
  try {
    resetActiveClientForTests("fender");
    const rows = [
      { asin: "A", offer_price: 90, wmt_price: 80, mf_price: 85, featured_offer_checked_at: ago(0.1), wmt_checked_at: ago(0.1), mf_checked_at: ago(34) },
      { asin: "B", offer_price: 90, wmt_price: null, mf_price: 85, featured_offer_checked_at: ago(0.1), wmt_checked_at: null, mf_checked_at: ago(1) },
    ] as Parameters<typeof mapChannelStale>[0];
    const stale = mapChannelStale(rows, NOW);
    assert.equal(stale.Amazon, null);
    assert.equal(stale.Walmart, null);
    assert.equal(stale["Musician's Friend"]?.missing, "1 of 2 listings has no Musician's Friend price check in 6 days");
    assert.match(channelReadingNote("Musician's Friend", { walmartMissing: 0, channelStale: stale }) ?? "", /^1 of 2 listings has no Musician's Friend price check in 6 days\./);
    assert.equal(channelReadingNote("Amazon", { walmartMissing: 0, channelStale: stale }), null);
  } finally {
    resetActiveClientForTests(null);
  }
});

test("Splintered Listings for sale now: each live bundle's featured_offer_checked_at, stale after 2 days", () => {
  const bundle = (asin: string, state: string | null, at: string | null) => ({
    asin,
    model_name: asin,
    title: asin,
    bundle_name: "Kit",
    parent_asin: null,
    product_url: null,
    is_bundle: true,
    featured_offer_state: state,
    featured_offer_checked_at: at,
  });
  const reading = unnestedBundlesFinding(
    [bundle("A", "present", ago(0.1)), bundle("B", "withheld", ago(5)), bundle("C", "no_active_offer", ago(60))],
    { now: NOW },
  );
  assert.equal(reading.stale?.missing, "1 of 2 listings has no Buy Box check in 2 days", "a bundle that is not for sale is not in the population");
});

test("Amazon specs: each checked listing's spec_readiness.checked_at, stale after 14 days", () => {
  const spec = (asin: string, checked: boolean, at: string | null) => ({ asin, title: asin, amazon_checked: checked, amazon_missing_fields: null, checked_at: at });
  const reading = amazonSpecGapsFinding([spec("A", true, ago(1)), spec("B", true, ago(15)), spec("C", false, ago(90))], { now: NOW });
  assert.equal(reading.stale?.missing, "1 of 2 listings has no Amazon spec check in 14 days");
  assert.equal(amazonSpecGapsFinding([spec("A", true, ago(14))], { now: NOW }).stale ?? null, null);
});

function stockRow(asin: string, source: "smartscout" | "brand_reported", snapshot: string | null, through: string | null): StockLossRow {
  return {
    asin,
    title: asin,
    featured_offer_state: "present",
    offline_now: false,
    current_oos_days: 0,
    smartscout_snapshot_date: snapshot,
    smartscout_monthly_revenue: null,
    smartscout_ttm_revenue: null,
    history_through: through,
    in_stock_days_30: null,
    oos_days_30: 1,
    oos_days_90: 2,
    observed_days_365: 365,
    in_stock_days_365: 300,
    oos_days_365: 5,
    no_buy_box_days_365: 0,
    revenue_source: source,
    baseline_method: "smartscout_ttm",
    in_stock_days_used: 300,
    baseline_daily_revenue: null,
    est_lost_revenue_oos_30: 10,
    est_lost_revenue_oos_90: 10,
    est_lost_revenue_oos_365: 10,
    awaiting_inputs_reason: null,
  };
}

test("Out of Stock: SmartScout snapshot 7 days (stale after 14), Keepa history 1 day (stale after 2)", () => {
  const rows = [
    stockRow("A", "smartscout", "2026-11-10", "2026-11-11"),
    stockRow("B", "smartscout", "2026-10-20", "2026-11-11"),
    stockRow("C", "smartscout", "2026-11-10", "2026-11-05"),
  ];
  const partial = lostSalesStale(rows, 365, NOW);
  assert.match(partial?.missing ?? "", /1 of 3 listings has no Keepa update in 2 days/);
  assert.match(partial?.missing ?? "", /1 of 3 listings has no SmartScout snapshot in 14 days/);
  const current = [stockRow("A", "smartscout", "2026-11-10", "2026-11-11")];
  assert.equal(lostSalesStale(current, 365, NOW), null);
  assert.equal(lostSalesPartial(current, sumLostSales(current, 365), NOW), null);
  const brand = [stockRow("A", "brand_reported", null, "2026-11-11")];
  assert.equal(lostSalesStale(brand, 365, NOW), null, "a brand-reported source has no SmartScout snapshot to age");
});
