// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/buy-box-cause.test.ts
//
// Audit recommendation 3: Buy Box withheld split by its stored cause. The split rules, the lower
// outside price for price-caused listings, and the two fix-list rows: they replace the Buy Box row,
// add up to line 2, and keep the fix list adding up to Phase 1 for both fixture clients.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildClientEstimates } from "../lib/estimates/live-inputs.ts";
import { PHASE_1_LINES } from "../lib/estimates/rollup.ts";
import {
  BUY_BOX_CAUSE_ROW_IDS,
  BUY_BOX_ROW_ID,
  buyBoxCauseLine,
  buyBoxRowAction,
  earlierBuyBoxListings,
  fixRowFigure,
  planWithBuyBoxCauses,
} from "../lib/fender-canvas/action-items-buybox-rows.ts";
import { FIX_ROW_LINES } from "../lib/fender-canvas/action-items-fix-list.ts";
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

test("the Buy Box row becomes two cause rows in its place, ranks renumbered", () => {
  const plan = [item("finding:map_leakage", 1), item(BUY_BOX_ROW_ID, 2), item("signal:out_of_stock", 3, { kind: "signal" })];
  const split = splitOf(
    Array.from({ length: 51 }, (_, i) => `P${i}`),
    Array.from({ length: 9 }, (_, i) => `O${i}`),
  );
  const next = planWithBuyBoxCauses(plan, split);
  assert.deepEqual(next.map((i) => i.id), ["finding:map_leakage", BUY_BOX_CAUSE_ROW_IDS.price, BUY_BOX_CAUSE_ROW_IDS.other, "signal:out_of_stock"]);
  assert.deepEqual(next.map((i) => i.rank), [1, 2, 3, 4]);
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
  const est = buildClientEstimates(fx.listings, { rankCategory: fx.rankCategory, dataAsOf: fx.readOn });
  // Every third listing of line 2 priced above the reference price; one listing outside line 2 withheld for another cause.
  const line2 = [...est.byListing.values()].filter((entry) => "buy_box" in entry.lines).map((entry) => entry.asin);
  const split = splitOf(line2.filter((_, i) => i % 3 === 0), [...line2.filter((_, i) => i % 3 === 1), "NOT-IN-LINE-2"]);

  test(`${client}: the three Buy Box rows add up to line 2, and the fix list still adds up to Phase 1`, () => {
    assert.ok(line2.length > 2, "the fixture has line 2 listings");
    const whole = fixRowFigure(BUY_BOX_ROW_ID, est, split)!;
    const parts = GROUPS.map((group) => fixRowFigure(BUY_BOX_CAUSE_ROW_IDS[group], est, split)!);
    assert.equal(parts.reduce((n, p) => n + p.listings, 0), whole.listings);
    assert.equal(parts[2]!.listings, earlierBuyBoxListings(est, split));
    assert.equal(parts[1]!.listings, split.other - 1, "the listing outside line 2 adds no dollar");
    for (const key of ["low", "mid", "high"] as const) {
      const sum = parts.reduce((total, p) => total + (p.range?.[key] ?? 0), 0);
      assert.ok(Math.abs(sum - (whole.range?.[key] ?? 0)) < 0.01, `${key}: ${sum} vs ${whole.range?.[key]}`);
    }
    const plan = planWithBuyBoxCauses([item(BUY_BOX_ROW_ID, 1)], split, est);
    assert.deepEqual(plan.map((i) => i.id), GROUPS.map((group) => BUY_BOX_CAUSE_ROW_IDS[group]), "the earlier row ranks below the other two");
    assert.equal(plan[2]!.action, buyBoxRowAction("earlier", parts[2]!.listings));
    const ids = [...Object.keys(FIX_ROW_LINES).filter((id) => id !== BUY_BOX_ROW_ID), ...GROUPS.map((group) => BUY_BOX_CAUSE_ROW_IDS[group])];
    const rows = ids.map((id) => fixRowFigure(id, est, split)).filter((r) => r?.inPhase1);
    const mid = rows.reduce((total, r) => total + (r!.range?.mid ?? 0), 0);
    assert.ok(est.phase1.range, "Phase 1 is priced");
    assert.ok(Math.abs(mid - est.phase1.range!.mid) <= PHASE_1_LINES.length, `${mid} vs ${est.phase1.range!.mid}`);
  });

  test(`${client}: each Buy Box row's trail lists exactly its own listings`, () => {
    const groupOf = (asin: string) => (split.priceAsins.has(asin) ? "price" : split.otherAsins.has(asin) ? "other" : "earlier");
    for (const cause of GROUPS) {
      const figure = fixRowFigure(BUY_BOX_CAUSE_ROW_IDS[cause], est, split)!;
      const line = buyBoxCauseLine(est, cause, split);
      assert.equal(figure.line, line, "cached");
      assert.equal(line.lineId, "buy_box");
      assert.equal(line.trail.coverage.total, figure.listings);
      const asins = line.trail.listings.map((l) => l.asin);
      assert.ok(asins.length > 0 && asins.every((asin) => groupOf(asin) === cause), cause);
      if (figure.range && line.range) assert.ok(Math.abs(figure.range.mid - line.range.mid) <= 1);
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
