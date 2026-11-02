// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/stock-loss.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  awaitingInputsReason,
  lostSales,
  lostSalesPopulationPie,
  sumLostSales,
  type StockLossRow,
} from "../lib/fender-canvas/stock-loss.ts";

function row(patch: Partial<StockLossRow> & Pick<StockLossRow, "asin">): StockLossRow {
  return {
    title: patch.asin,
    featured_offer_state: null,
    offline_now: false,
    current_oos_days: 0,
    smartscout_snapshot_date: "2026-10-01",
    smartscout_monthly_revenue: 1000,
    smartscout_ttm_revenue: 12000,
    history_through: "2026-10-28",
    in_stock_days_30: 20,
    oos_days_30: 2,
    oos_days_90: 10,
    observed_days_365: 365,
    in_stock_days_365: 300,
    oos_days_365: 50,
    no_buy_box_days_365: 5,
    revenue_source: "smartscout",
    baseline_method: "smartscout_ttm",
    in_stock_days_used: 300,
    baseline_daily_revenue: 40,
    est_lost_revenue_oos_30: 80,
    est_lost_revenue_oos_90: 400,
    est_lost_revenue_oos_365: 2000,
    awaiting_inputs_reason: null,
    ...patch,
  };
}

const awaiting = (asin: string, reason: StockLossRow["awaiting_inputs_reason"] = "no_sales_source") =>
  row({
    asin,
    revenue_source: null,
    baseline_method: null,
    baseline_daily_revenue: null,
    est_lost_revenue_oos_30: null,
    est_lost_revenue_oos_90: null,
    est_lost_revenue_oos_365: null,
    awaiting_inputs_reason: reason,
  });

test("lostSales reads each window and is null while awaiting inputs", () => {
  const r = row({ asin: "A" });
  assert.equal(lostSales(r, 30), 80);
  assert.equal(lostSales(r, 90), 400);
  assert.equal(lostSales(r, 365), 2000);
  assert.equal(lostSales(r), 2000);
  assert.equal(lostSales(awaiting("B"), 365), null);
});

test("sumLostSales keeps sources apart and leaves awaiting inputs out of every total", () => {
  const rows = [
    row({ asin: "A", est_lost_revenue_oos_365: 100 }),
    row({ asin: "B", est_lost_revenue_oos_365: 250 }),
    row({ asin: "C", revenue_source: "brand_reported", est_lost_revenue_oos_365: 900 }),
    awaiting("D"),
  ];
  const sum = sumLostSales(rows, 365);
  assert.deepEqual(sum.bySource, [
    { source: "brand_reported", total: 900, count: 1 },
    { source: "smartscout", total: 350, count: 2 },
  ]);
  assert.equal(sum.estimatedCount, 3);
  assert.equal(sum.awaitingCount, 1);
  assert.equal(sum.affectedCount, 4);
});

test("sumLostSales never treats awaiting inputs as zero; empty set has no source total", () => {
  assert.deepEqual(sumLostSales([], 90), {
    window: 90,
    bySource: [],
    estimatedCount: 0,
    awaitingCount: 0,
    affectedCount: 0,
  });
  const sum = sumLostSales([awaiting("X", "smartscout_reports_no_sales")], 30);
  assert.deepEqual(sum.bySource, []);
  assert.equal(sum.awaitingCount, 1);
});

test("awaitingInputsReason names why, never a zero", () => {
  assert.match(awaitingInputsReason(awaiting("A", "no_sales_source")), /No sales source/);
  assert.match(awaitingInputsReason(awaiting("B", "smartscout_reports_no_sales")), /reports no sales/);
  assert.match(awaitingInputsReason(awaiting("C", "too_few_in_stock_days")), /Too few in-stock days/);
});

test("lostSalesPopulationPie mirrors estimated vs awaiting inputs", () => {
  const pie = lostSalesPopulationPie(sumLostSales([row({ asin: "A" }), awaiting("B")]));
  assert.ok(pie);
  assert.equal(pie!.total, 2);
  assert.deepEqual(
    pie!.slices.map((s) => [s.key, s.label, s.count]),
    [
      ["matched", "Estimated", 1],
      ["contradicted", "Awaiting inputs", 1],
    ],
  );
  assert.equal(lostSalesPopulationPie(sumLostSales([])), null);
});
