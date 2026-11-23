// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/buy-box-cause.test.ts
//
// Audit recommendation 3: Buy Box withheld split by its stored cause. The split rules, the lower
// outside price for price-caused listings, and the fix-list rows: they replace the Buy Box row, the
// two withheld rows add up to the one Buy Box figure (R-06, over the date pill's days), and the
// yearly lines still add up to Phase 1 for both fixture clients.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buyBoxForPeriod } from "../lib/estimates/buy-box.ts";
import { buildClientEstimates } from "../lib/estimates/live-inputs.ts";
import { PHASE_1_LINES } from "../lib/estimates/rollup.ts";
import type { EstimateListingInput } from "../lib/estimates/types.ts";
import {
  BUY_BOX_CAUSE_ROW_IDS,
  BUY_BOX_ROW_ID,
  buyBoxCauseLine,
  buyBoxRowAction,
  earlierBuyBoxListings,
  fixRowFigure,
  planWithBuyBoxCauses,
} from "../lib/fender-canvas/action-items-buybox-rows.ts";
import { FIX_ROW_LINES, fixRowEstimate } from "../lib/fender-canvas/action-items-fix-list.ts";
import {
  WITHHELD_CAUSE_COLUMNS,
  buyBoxCause,
  buyBoxCauseAction,
  lowerPricesElsewhere,
  splitBuyBoxCauses,
  type BuyBoxCauseSplit,
  type WithheldCauseRow,
} from "../lib/fender-canvas/buy-box-cause.ts";
import type { PlanItem } from "../lib/fender-canvas/roadmap-plan.ts";
import { loadEstimatesFixture } from "./fixtures/estimates/load.ts";

const GROUPS = ["price", "other", "earlier"] as const;

const CHECKED = "2026-11-18T10:00:00Z";

function row(asin: string, over: Partial<WithheldCauseRow> = {}): WithheldCauseRow {
  return {
    asin,
    featured_offer_state: "withheld",
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: 12000,
    ...over,
  };
}

test("the stored flag decides the cause; a read without it falls back to the view's rule", () => {
  assert.equal(buyBoxCause(row("A", { competitive_offer_suppressed: true })), "price");
  assert.equal(buyBoxCause(row("A", { competitive_offer_suppressed: false })), "other");
  assert.equal(buyBoxCause(row("A")), "price", "offer above the benchmark in one check");
  assert.equal(buyBoxCause(row("A", { competitive_price_threshold_cents: null })), "other", "no benchmark");
  assert.equal(buyBoxCause(row("A", { featured_offer_observed_price_cents: 9000 })), "other", "offer at or below");
});

test("the split counts withheld listings only, and the two causes add up to withheld", () => {
  const split = splitBuyBoxCauses([
    row("P1", { competitive_offer_suppressed: true }),
    row("P2", { competitive_offer_suppressed: true }),
    row("O1", { competitive_offer_suppressed: false }),
    row("X1", { featured_offer_state: "present", competitive_offer_suppressed: true }),
  ]);
  assert.equal(split.withheld, 3);
  assert.equal(split.price, 2);
  assert.equal(split.other, 1);
  assert.deepEqual([...split.priceAsins].sort(), ["P1", "P2"]);
  assert.deepEqual([...split.otherAsins], ["O1"]);
});

test("the read carries the stored cause and the stored outside prices", () => {
  const cols = WITHHELD_CAUSE_COLUMNS.split(",");
  for (const col of ["competitive_offer_suppressed", "wmt_price", "wmt_url", "mf_price", "featured_offer_state"]) {
    assert.ok(cols.includes(col), col);
  }
});

test("a lower price elsewhere shows for every withheld listing, below the Amazon offer, lowest first", () => {
  const priced = row("P", {
    competitive_offer_suppressed: true,
    featured_offer_observed_price_cents: 86239,
    wmt_price: 649.99,
    wmt_url: "https://www.walmart.com/ip/19311667655",
    mf_price: "879.99",
  });
  assert.deepEqual(lowerPricesElsewhere(priced), [
    { channel: "Walmart", price: 649.99, url: "https://www.walmart.com/ip/19311667655" },
  ]);
  const both = { ...priced, mf_price: 700 };
  assert.deepEqual(lowerPricesElsewhere(both).map((p) => p.channel), ["Walmart", "Musician's Friend"]);
  assert.equal(lowerPricesElsewhere(both)[1]!.url, null, "no Musician's Friend page is stored");
  assert.deepEqual(lowerPricesElsewhere({ ...priced, wmt_price: 862.39, mf_price: null }), [], "equal is not lower");
  // Every withheld listing, whatever its cause (e.g. an Amazon offer of $154.95 against Walmart $69.99).
  const other = row("O", { competitive_offer_suppressed: false, competitive_price_threshold_cents: null, featured_offer_observed_price_cents: 15495, wmt_price: 69.99 });
  assert.deepEqual(lowerPricesElsewhere(other), [{ channel: "Walmart", price: 69.99, url: null }], "other cause");
  assert.deepEqual(lowerPricesElsewhere({ ...priced, featured_offer_state: "present" }), [], "not withheld");
  assert.equal(lowerPricesElsewhere({ ...priced, wmt_url: "javascript:alert(1)" })[0]!.url, null);
});

test("action wording", () => {
  assert.equal(buyBoxCauseAction("price", 51), "Review pricing on 51 listings priced above Amazon's reference price.");
  assert.equal(buyBoxCauseAction("price", 1), "Review pricing on 1 listing priced above Amazon's reference price.");
  assert.equal(buyBoxCauseAction("other", 9), "Check 9 listings without the Buy Box for other causes.");
  assert.equal(buyBoxRowAction("earlier", 686), "Watch 686 listings that lost the Buy Box earlier this year.");
  assert.equal(buyBoxRowAction("earlier", 1), "Watch 1 listing that lost the Buy Box earlier this year.");
  assert.equal(buyBoxRowAction("price", 1), "Review pricing on 1 listing priced above Amazon's reference price.");
});

function item(id: string, rank: number, extra: Partial<PlanItem> = {}): PlanItem {
  return {
    id,
    kind: "finding",
    rank,
    phase: "days_1_30",
    label: id,
    percent: "5.6%",
    ratio: "60 of 1,076",
    tone: "danger",
    statusLabel: "Critical",
    fact: "",
    action: "Correct each offer.",
    needsAction: true,
    noReading: false,
    loading: false,
    partial: null,
    open: { spokeId: "ecommerce", tab: "Suppressed Listings" },
    siteType: null,
    pages: [],
    evidence: null,
    categories: [],
    ...extra,
  };
}

function splitOf(price: string[], other: string[]): BuyBoxCauseSplit {
  return { withheld: price.length + other.length, price: price.length, other: other.length, priceAsins: new Set(price), otherAsins: new Set(other) };
}

test("the Buy Box row becomes two cause rows in its place, each keeping its rank", () => {
  const plan = [item("finding:map_leakage", 1), item(BUY_BOX_ROW_ID, 2), item("signal:out_of_stock", 3, { kind: "signal" })];
  const split = splitOf(
    Array.from({ length: 51 }, (_, i) => `P${i}`),
    Array.from({ length: 9 }, (_, i) => `O${i}`),
  );
  const next = planWithBuyBoxCauses(plan, split);
  assert.deepEqual(next.map((i) => i.id), ["finding:map_leakage", BUY_BOX_CAUSE_ROW_IDS.price, BUY_BOX_CAUSE_ROW_IDS.other, "signal:out_of_stock"]);
  assert.deepEqual(next.map((i) => i.rank), [1, 2, 2, 3]);
  const [price, other] = [next[1]!, next[2]!];
  assert.equal(price.ratio, "51 of 1,076");
  assert.equal(other.ratio, "9 of 1,076");
  assert.equal(price.percent, "4.7%");
  assert.equal(price.siteType, "Priced above Amazon's reference price");
  assert.equal(other.siteType, "Other or unknown cause");
  assert.equal(price.action, "Review pricing on 51 listings priced above Amazon's reference price.");
  assert.equal(other.action, "Check 9 listings without the Buy Box for other causes.");
  assert.equal(price.statusLabel, "Critical");
  assert.equal(price.open.tab, "Suppressed Listings");
});

test("the plan stays as it is while the split is missing or the row has no reading; an empty group has no row", () => {
  const plan = [item(BUY_BOX_ROW_ID, 1)];
  assert.equal(planWithBuyBoxCauses(plan, null), plan);
  assert.equal(planWithBuyBoxCauses(plan, splitOf([], [])), plan);
  assert.deepEqual(planWithBuyBoxCauses(plan, splitOf([], ["O"])).map((i) => i.id), [BUY_BOX_CAUSE_ROW_IDS.other]);
  assert.deepEqual(planWithBuyBoxCauses(plan, splitOf(["P"], [])).map((i) => i.id), [BUY_BOX_CAUSE_ROW_IDS.price]);
  const noReading = [item(BUY_BOX_ROW_ID, 1, { noReading: true })];
  assert.equal(planWithBuyBoxCauses(noReading, splitOf(["P"], ["O"])), noReading);
});

for (const client of ["fender", "ledlenser"] as const) {
  const fx = loadEstimatesFixture(client);
  // The 17 Nov read stored no Buy Box state, so every fifth sales-view listing is marked withheld
  // here with a 30-day sales read; every third of those has too few Buy Box days for a rate.
  let n = 0;
  const listings: EstimateListingInput[] = fx.listings.map((l) => {
    if (!l.inSalesView || !l.smartscoutHasRecord) return l;
    n += 1;
    if (n % 5 !== 0) return l;
    return { ...l, buyBoxWithheld: true, smartscoutMonthlyRevenue: 150 + n, inStockDays30: 30, noBuyBoxDays30: n % 3 === 0 ? 27 : 10 };
  });
  const est = buildClientEstimates(listings, { rankCategory: fx.rankCategory, dataAsOf: fx.readOn });
  const withheld = listings.filter((l) => l.buyBoxWithheld).map((l) => l.asin);
  const split = splitOf(withheld.filter((_, i) => i % 3 === 0), [...withheld.filter((_, i) => i % 3 !== 0), "NOT-IN-THE-READ"]);

  test(`${client}: the two withheld rows add up to the one Buy Box figure for the period; the earlier row has no dollar`, () => {
    assert.ok(withheld.length > 2, "the fixture has withheld listings");
    for (const days of [30, 90]) {
      const whole = fixRowFigure(BUY_BOX_ROW_ID, est, split, days)!;
      const panel = buyBoxForPeriod(est, days);
      assert.deepEqual(whole.range, panel.range, "Action Items and Suppressed Listings show one figure");
      const parts = (["price", "other"] as const).map((group) => fixRowFigure(BUY_BOX_CAUSE_ROW_IDS[group], est, split, days)!);
      assert.equal(parts.reduce((total, p) => total + p.listings, 0), whole.listings);
      assert.equal(parts[1]!.listings, split.other - 1, "the listing outside the read adds no dollar");
      for (const key of ["low", "mid", "high"] as const) {
        const sum = parts.reduce((total, p) => total + (p.range?.[key] ?? 0), 0);
        assert.ok(Math.abs(sum - (whole.range?.[key] ?? 0)) <= 2, `${days} days ${key}: ${sum} vs ${whole.range?.[key]}`);
      }
    }
    // The backward-looking figure is retired: the earlier-days row keeps its count and has no dollar.
    assert.equal(fixRowFigure(BUY_BOX_CAUSE_ROW_IDS.earlier, est, split, 30), null);
    const earlier = earlierBuyBoxListings(est, split);
    assert.ok(earlier > 0, "listings lost the Buy Box on earlier days");
    const plan = planWithBuyBoxCauses([item(BUY_BOX_ROW_ID, 1)], split, est);
    assert.deepEqual(plan.map((i) => i.id), GROUPS.map((group) => BUY_BOX_CAUSE_ROW_IDS[group]), "the earlier row ranks below the other two");
    assert.equal(plan[2]!.action, buyBoxRowAction("earlier", earlier));
    // Each row's rank reason carries its own 30-day part; the earlier-days row carries no dollar.
    assert.equal(plan[0]!.inputs.monthly, fixRowFigure(BUY_BOX_CAUSE_ROW_IDS.price, est, split, 30)!.range?.mid ?? null);
    assert.equal(plan[1]!.inputs.monthly, fixRowFigure(BUY_BOX_CAUSE_ROW_IDS.other, est, split, 30)!.range?.mid ?? null);
    assert.equal(plan[2]!.inputs.monthly, null);
    assert.ok(!/a month/.test(plan[2]!.reason), plan[2]!.reason);
    // The yearly lines still add up to Phase 1, with the Buy Box at 365 days.
    const rows = Object.keys(FIX_ROW_LINES).map((id) => fixRowEstimate(id, est)).filter((r) => r?.inPhase1);
    const mid = rows.reduce((total, r) => total + (r!.range?.mid ?? 0), 0);
    assert.ok(est.phase1.range, "Phase 1 is priced");
    assert.ok(Math.abs(mid - est.phase1.range!.mid) <= PHASE_1_LINES.length, `${mid} vs ${est.phase1.range!.mid}`);
    assert.deepEqual(est.buyBox.range, buyBoxForPeriod(est, 365).range);
  });

  test(`${client}: each withheld row's trail counts exactly its own listings`, () => {
    for (const cause of ["price", "other"] as const) {
      const figure = fixRowFigure(BUY_BOX_CAUSE_ROW_IDS[cause], est, split, 30)!;
      const line = buyBoxCauseLine(est, cause, split, 30);
      assert.equal(figure.line, line, "cached");
      assert.equal(line.lineId, "buy_box");
      assert.equal(line.trail.coverage.total, figure.listings);
      const own = cause === "price" ? split.priceAsins : split.otherAsins;
      const asins = line.trail.listings.map((l) => l.asin);
      assert.ok(asins.length > 0 && asins.every((asin) => own.has(asin)), cause);
      assert.ok(line.trail.formula.includes("30 days, the period in the date pill"));
    }
  });
}

test("Action Items and Suppressed Listings share one withheld read and the split", () => {
  const table = readFileSync(new URL("../components/v3/live/ActionItemsFixTable.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/v3/live/SuppressedListingsPanel.tsx", import.meta.url), "utf8");
  assert.match(table, /useBuyBoxCauseSplit\(\)/);
  assert.match(table, /planWithBuyBoxCauses\(/);
  assert.match(panel, /useWithheldListings\(\)/);
  assert.match(panel, /<BuyBoxCauseCard rows=\{rows\} \/>/);
});
