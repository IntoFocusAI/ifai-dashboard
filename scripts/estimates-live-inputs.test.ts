// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimates-live-inputs.test.ts
//
// The shared read (lib/estimates/live-inputs.ts): the estimates fixtures are turned back into the
// four views' rows, joined, and priced. With measured sales only, the rollups must match the
// proposal's worked figures (docs/dollar-estimates-proposal.md, section 5).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildClientEstimates,
  ESTIMATE_VIEW_COLUMNS,
  joinEstimateListings,
  loadClientEstimates,
  type EstimateReadClient,
  type EstimateViewRows,
} from "../lib/estimates/live-inputs.ts";
import type { EstimateResult } from "../lib/estimates/types.ts";
import { loadEstimatesFixture, type EstimatesFixture } from "./fixtures/estimates/load.ts";

function viewRows(fx: EstimatesFixture): EstimateViewRows {
  const rows: EstimateViewRows = { sales: [], retail: [], spec: [], content: [] };
  for (const l of fx.listings) {
    if (l.inSalesView) {
      rows.sales.push({
        asin: l.asin,
        current_price: l.price ?? null,
        sales_rank_current: l.salesRank ?? null,
        smartscout_snapshot_date: l.smartscoutHasRecord ? fx.readOn : null,
        smartscout_ttm_revenue: l.smartscoutTtmRevenue ?? null,
        smartscout_monthly_units: l.smartscoutMonthlyUnits ?? null,
        baseline_daily_revenue: l.baselineDailyRevenue ?? null,
        est_lost_revenue_oos_365: l.missedSalesOos365 ?? null,
        in_stock_days_30: l.inStockDays30 ?? null,
        in_stock_days_365: l.inStockDays365 ?? null,
        oos_days_365: l.oosDays365 ?? null,
        no_buy_box_days_365: l.noBuyBoxDays365 ?? null,
        observed_days_365: l.observedDays365 ?? null,
      });
    }
    if (l.inRetailRead) {
      rows.retail.push({
        asin: l.asin,
        // Numbers arrive as strings from some views; the join reads both.
        offer_price: l.price == null ? null : String(l.price),
        sales_rank: l.salesRank ?? null,
        monthly_sold: l.keepaMonthlySold ?? null,
        amz_leakage: l.amzLeakage ?? null,
        is_bundle: l.isBundle ?? null,
        parent_asin: l.parentAsin ?? null,
      });
    }
    if (l.specChecked != null) rows.spec.push({ asin: l.asin, amazon_checked: l.specChecked, amazon_completeness_pct: l.amazonCompletenessPct ?? null });
    if (l.aplusState != null) rows.content.push({ asin: l.asin, aplus_state: l.aplusState });
  }
  return rows;
}

function near(actual: number | null | undefined, expected: number, tolerance: number, label: string): void {
  assert.ok(typeof actual === "number", `${label} is missing`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
}
function rangeIs(r: EstimateResult, expected: [number, number, number], tolerance = 2): void {
  near(r.range?.low, expected[0], tolerance, `${r.lineId} low`);
  near(r.range?.mid, expected[1], tolerance, `${r.lineId} mid`);
  near(r.range?.high, expected[2], tolerance, `${r.lineId} high`);
}

const measured = (client: "fender" | "ledlenser") => {
  const fx = loadEstimatesFixture(client);
  const listings = joinEstimateListings(viewRows(fx), fx.rankCategory);
  return { fx, listings, est: buildClientEstimates(listings, { rankCategory: fx.rankCategory, dataAsOf: fx.readOn, salesSources: "measured_only" }) };
};

const fender = measured("fender");
const ledlenser = measured("ledlenser");

test("the join keeps the sales view's listings and adds none from the other views", () => {
  assert.equal(fender.listings.length, fender.fx.listings.filter((l) => l.inSalesView).length);
  assert.equal(ledlenser.listings.length, ledlenser.fx.listings.filter((l) => l.inSalesView).length);
  const joined = joinEstimateListings(
    {
      sales: [{ asin: "A1", current_price: 10 }],
      retail: [{ asin: "R9", offer_price: 5, is_bundle: true, parent_asin: null }],
      spec: [{ asin: "S9", amazon_checked: true, amazon_completeness_pct: 10 }],
      content: [{ asin: "C9", aplus_state: "absent" }],
    },
    "Cat",
  );
  assert.deepEqual(joined.map((l) => l.asin), ["A1"]);
});

test("Phase 1 from the views matches the proposal's section 5", () => {
  rangeIs(fender.est.phase1, [603107, 1050952, 1549516]);
  rangeIs(ledlenser.est.phase1, [10997, 17101, 23150]);
  assert.deepEqual(fender.est.phase1.parts?.map((p) => p.lineId), ["out_of_stock", "buy_box", "splintered", "missing_specs", "aplus"]);
});

test("each line from the views matches the proposal's section 1", () => {
  rangeIs(fender.est.outOfStock, [367760, 490347, 551640]);
  rangeIs(ledlenser.est.outOfStock, [8899, 11866, 13349]);
  near(fender.est.buyBox.range?.mid, 111000, 1000, "Fender Buy Box mid");
  near(fender.est.missingSpecs.range?.mid, 328000, 1000, "Fender specs mid");
  near(fender.est.aplus.range?.mid, 66000, 1000, "Fender A+ mid");
});

test("a listing with no retail read is not counted as splintered", () => {
  const est = buildClientEstimates(
    joinEstimateListings({ sales: [{ asin: "A1", current_price: 10 }], retail: [], spec: [], content: [] }, "Cat"),
    { rankCategory: "Cat", dataAsOf: "2026-11-18" },
  );
  assert.equal(est.splintered.trail.coverage.total, 0);
});

test("a line whose listings are all measured with no sales reads $0 with its N of M (decision 113)", () => {
  const rows: EstimateViewRows = {
    sales: ["A1", "A2"].map((asin) => ({ asin, current_price: 50, smartscout_snapshot_date: "2026-11-17", smartscout_ttm_revenue: null })),
    retail: ["A1", "A2"].map((asin) => ({ asin, is_bundle: true, parent_asin: null })),
    spec: [],
    content: [],
  };
  const est = buildClientEstimates(joinEstimateListings(rows, "Cat"), { rankCategory: "Cat", dataAsOf: "2026-11-18" });
  assert.equal(est.splintered.status, "estimated");
  assert.deepEqual(est.splintered.range, { low: 0, mid: 0, high: 0 });
  assert.equal(est.splintered.trail.coverage.measured, 2);
  assert.equal(est.splintered.trail.coverage.reportedNoSales, 2);
  assert.equal(est.splintered.trail.coverage.total, 2);
  assert.equal(est.splintered.asterisk, false);
  // No sales record at all and nothing to estimate from: Not available*, never $0.
  rows.sales = rows.sales.map((r) => ({ ...r, smartscout_snapshot_date: null }));
  const none = buildClientEstimates(joinEstimateListings(rows, "Cat"), { rankCategory: "Cat", dataAsOf: "2026-11-18" });
  assert.equal(none.splintered.status, "not_available");
  assert.equal(none.splintered.range, null);
});

test("MAP sits beside Phase 1 and line 6 is held", () => {
  rangeIs(fender.est.mapLeakage, [25816, 38724, 51632]);
  rangeIs(ledlenser.est.mapLeakage, [23494, 35241, 46988]);
  for (const { est } of [fender, ledlenser]) {
    assert.equal(est.mapLeakage.countsInTotal, false);
    assert.ok(!est.phase1.parts?.some((p) => p.lineId === "map_leakage"));
    assert.equal(est.miscategorized.status, "not_available");
    assert.ok(!est.phase1.parts?.some((p) => p.lineId === "miscategorized"));
    assert.deepEqual(
      est.lines.map((l) => l.lineId),
      ["out_of_stock", "buy_box", "map_leakage", "splintered", "missing_specs", "miscategorized", "aplus"],
    );
  }
});

test("per-listing parts add up to each line and to Phase 1", () => {
  for (const { est } of [fender, ledlenser]) {
    let phase1 = 0;
    let oos = 0;
    for (const entry of est.byListing.values()) {
      phase1 += entry.phase1?.mid ?? 0;
      oos += entry.lines.out_of_stock?.mid ?? 0;
    }
    near(phase1, est.phase1.range!.mid, 3, "per-listing Phase 1");
    near(oos, est.outOfStock.range!.mid, 2, "per-listing out of stock");
  }
});

test("the join reads the retail price and rank when the sales view has none, and spec completeness only when checked", () => {
  const [l] = joinEstimateListings(
    {
      sales: [{ asin: "A1", current_price: null, sales_rank_current: null, smartscout_snapshot_date: null }],
      retail: [{ asin: "A1", offer_price: "19.99", sales_rank: 1200, monthly_sold: 50, parent_asin: null }],
      spec: [{ asin: "A1", amazon_checked: false, amazon_completeness_pct: 40 }],
      content: [{ asin: "A1", aplus_state: "absent" }],
    },
    "Cat",
  );
  assert.equal(l.price, 19.99);
  assert.equal(l.salesRank, 1200);
  assert.equal(l.keepaMonthlySold, 50);
  assert.equal(l.smartscoutHasRecord, false);
  assert.equal(l.amazonCompletenessPct, null);
  assert.equal(l.aplusState, "absent");
  assert.equal(l.rankCategory, "Cat");
});

test("with every sales source, estimated listings join and Phase 1 does not fall", () => {
  const fx = loadEstimatesFixture("ledlenser");
  const all = buildClientEstimates(joinEstimateListings(viewRows(fx), fx.rankCategory), { rankCategory: fx.rankCategory, dataAsOf: fx.readOn });
  assert.ok(all.phase1.range!.mid >= ledlenser.est.phase1.range!.mid);
  assert.ok(all.catalog.after.estimated > 0);
});

test("the loader pages each view through the read client it is given", async () => {
  const fx = loadEstimatesFixture("ledlenser");
  const rows = viewRows(fx);
  const byView: Record<string, unknown[]> = {
    canvas_listing_sales_loss_v2: rows.sales,
    canvas_retail_listings: rows.retail,
    canvas_spec_readiness: rows.spec,
    canvas_listing_content: rows.content,
  };
  const asked: string[] = [];
  const client: EstimateReadClient = {
    from: (view) => ({
      select: (columns) => {
        assert.equal(columns, ESTIMATE_VIEW_COLUMNS[view as keyof typeof ESTIMATE_VIEW_COLUMNS]);
        asked.push(view);
        return {
          order: () => ({
            range: async (from, to) => ({ data: byView[view].slice(from, to + 1), error: null }),
          }),
        };
      },
    }),
  };
  const est = await loadClientEstimates(client, { amazon_rank_category: fx.rankCategory }, fx.readOn);
  assert.deepEqual([...new Set(asked)].sort(), Object.keys(ESTIMATE_VIEW_COLUMNS).sort());
  assert.equal(est.listingCount, fx.listings.length);
  assert.equal(est.phase1.status, "estimated");
});

test("a failed read fails the estimate rather than pricing part of the data", async () => {
  const client: EstimateReadClient = {
    from: (view) => ({
      select: () => ({
        order: () => ({
          range: async () => (view === "canvas_retail_listings" ? { data: null, error: { message: "timeout" } } : { data: [], error: null }),
        }),
      }),
    }),
  };
  await assert.rejects(loadClientEstimates(client, {}), /canvas_retail_listings: timeout/);
});
