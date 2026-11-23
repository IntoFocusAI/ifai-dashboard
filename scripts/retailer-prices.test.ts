import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeRetailers,
  applyFirstMissRule,
  byWorstLeakage,
  retailerPriceIndex,
  retailerSettingKey,
  withRetailerPrices,
  type RetailHistoryRow,
  type RetailPriceRow,
} from "../lib/fender-canvas/retailer-prices.ts";
import { loadRetailerPrices } from "../lib/fender-canvas/retailer-prices-read.ts";
import { FENDER_RETAILERS, LEDLENSER_RETAILERS } from "./fixtures/retailer-rows.ts";

const MISS_1 = "2026-11-23T20:54:27Z";
const MISS_2 = "2026-11-24T20:54:27Z";
const PRICED_AT = "2026-11-22T04:54:05Z";

function latest(overrides: Partial<RetailPriceRow> & Pick<RetailPriceRow, "asin">): RetailPriceRow {
  return {
    retailer: "walmart",
    status: "no_match",
    observed_at: MISS_1,
    price: null,
    url: null,
    map_price: 300,
    leakage: null,
    ...overrides,
  };
}

function hist(overrides: Partial<RetailHistoryRow> & Pick<RetailHistoryRow, "asin" | "status" | "observed_at">): RetailHistoryRow {
  return { retailer: "walmart", price: null, url: null, ...overrides };
}

// B0DYKS9M5B on 23 Nov 2026: priced at $258.99 on 22 Nov, then one no_match at 20:54.
const FIRST_MISS_HISTORY = [
  hist({ asin: "B0DYKS9M5B", status: "priced", observed_at: PRICED_AT, price: "258.99", url: "https://www.walmart.com/ip/18009572514" }),
  hist({ asin: "B0DYKS9M5B", status: "no_match", observed_at: MISS_1 }),
];

test("first miss: the listing stays priced at its last price, checked at the miss, and is never also missing", () => {
  const [row] = applyFirstMissRule([latest({ asin: "B0DYKS9M5B" })], FIRST_MISS_HISTORY);
  assert.equal(row.status, "priced");
  assert.equal(row.price, 258.99);
  assert.equal(row.url, "https://www.walmart.com/ip/18009572514");
  assert.equal(row.observed_at, MISS_1);
  assert.equal(row.leakage, -41.01);
  assert.equal(row.firstMiss, true);

  const index = retailerPriceIndex(FENDER_RETAILERS, [latest({ asin: "B0DYKS9M5B" })], FIRST_MISS_HISTORY);
  const cells = index.byAsin.get("B0DYKS9M5B") ?? [];
  assert.equal(cells.length, 1, "one cell per listing and retailer");
  assert.equal(cells[0].price, 258.99);
  assert.equal(cells[0].gap, -41.01);
  assert.equal(cells[0].checkedAt, MISS_1);

  const [listing] = withRetailerPrices([{ asin: "B0DYKS9M5B", amz_leakage: null }], index);
  assert.equal(listing.is_map_violation, true);
  assert.equal(listing.worst_leakage, -41.01);
});

test("second straight miss: the listing is missing", () => {
  const history = [...FIRST_MISS_HISTORY, hist({ asin: "B0DYKS9M5B", status: "no_match", observed_at: MISS_2 })];
  const [row] = applyFirstMissRule([latest({ asin: "B0DYKS9M5B", observed_at: MISS_2 })], history);
  assert.equal(row.status, "no_match");
  assert.equal(row.price, null);
  assert.equal(row.firstMiss, false);
  const cells = retailerPriceIndex(FENDER_RETAILERS, [latest({ asin: "B0DYKS9M5B", observed_at: MISS_2 })], history);
  assert.equal(cells.byAsin.get("B0DYKS9M5B")?.[0].price, null);
});

test("failed checks and price searches between the price and the miss do not count as misses", () => {
  // check_failed rows are never read by the rule, and the reader leaves out price_search rows.
  const [row] = applyFirstMissRule(
    [latest({ asin: "B0DYKS9M5B" })],
    [...FIRST_MISS_HISTORY, hist({ asin: "B0DYKS9M5B", status: "check_failed", observed_at: "2026-11-23T10:00:00Z" })],
  );
  assert.equal(row.status, "priced");
});

test("a listing that was never priced stays missing, and a priced listing is untouched", () => {
  const rows = applyFirstMissRule(
    [
      latest({ asin: "B000NEVER1" }),
      latest({ asin: "B000PRICED", status: "priced", price: "99.00", leakage: "-1.00", observed_at: PRICED_AT }),
    ],
    [hist({ asin: "B000NEVER1", status: "no_match", observed_at: MISS_1 })],
  );
  assert.equal(rows[0].status, "no_match");
  assert.equal(rows[1].status, "priced");
  assert.equal(rows[1].price, "99.00");
  assert.equal(rows[1].firstMiss, false);
});

test("a first miss at one retailer does not borrow another retailer's price", () => {
  const [row] = applyFirstMissRule(
    [latest({ asin: "B0DYKS9M5B", retailer: "musicians-friend" })],
    FIRST_MISS_HISTORY,
  );
  assert.equal(row.status, "no_match");
});

test("a retailer with no checks adds no cell, no column and no gap", () => {
  const list = [
    ...FENDER_RETAILERS,
    { slug: "guitar-center", display_name: "Guitar Center", map_channel: false, active: true, sort_order: 25 },
  ];
  const index = retailerPriceIndex(list, [
    latest({ asin: "B000000001", status: "priced", price: 90, leakage: -10, map_price: 100 }),
  ]);
  assert.deepEqual(index.retailers.map((retailer) => retailer.key), ["walmart", "musicians-friend", "guitar-center"]);
  assert.deepEqual(index.byAsin.get("B000000001")?.map((cell) => cell.key), ["walmart"]);
  const [listing] = withRetailerPrices([{ asin: "B000000001", amz_leakage: 5 }], index);
  assert.equal(listing.worst_leakage, -10);
  const [unchecked] = withRetailerPrices([{ asin: "B000000002", amz_leakage: null }], index);
  assert.deepEqual(unchecked.retailers, []);
  assert.equal(unchecked.worst_leakage, null);
  assert.equal(unchecked.is_map_violation, false);
});

test("a display-only retailer below MAP is shown but never counted as a violation", () => {
  const list = [{ slug: "guitar-center", display_name: "Guitar Center", map_channel: false, active: true, sort_order: 5 }];
  const index = retailerPriceIndex(list, [
    latest({ asin: "B000000001", retailer: "guitar-center", status: "priced", price: 50, map_price: 100, leakage: null }),
  ]);
  const cell = index.byAsin.get("B000000001")?.[0];
  assert.equal(cell?.price, 50);
  assert.equal(cell?.gap, null);
  const [listing] = withRetailerPrices([{ asin: "B000000001", amz_leakage: null }], index);
  assert.equal(listing.is_map_violation, false);
  assert.equal(listing.worst_leakage, null);
});

test("worst leakage and violation match the old LEAST / COALESCE rule", () => {
  const index = retailerPriceIndex(FENDER_RETAILERS, [
    latest({ asin: "B1", status: "priced", price: 95, leakage: -5, map_price: 100 }),
    latest({ asin: "B1", retailer: "musicians-friend", status: "priced", price: 120, leakage: 20, map_price: 100 }),
    latest({ asin: "B2", status: "priced", price: 110, leakage: 10, map_price: 100 }),
  ]);
  const rows = withRetailerPrices(
    [
      { asin: "B1", amz_leakage: -2 },
      { asin: "B2", amz_leakage: null },
      { asin: "B3", amz_leakage: null },
      { asin: "B4", amz_leakage: -30 },
    ],
    index,
  );
  assert.deepEqual(rows.map((row) => [row.asin, row.worst_leakage, row.is_map_violation]), [
    ["B1", -5, true],
    ["B2", 10, false],
    ["B3", null, false],
    ["B4", -30, true],
  ]);
  assert.deepEqual(rows.slice().sort(byWorstLeakage).map((row) => row.asin), ["B4", "B1", "B2", "B3"]);
});

test("retailer list: inactive left out, sort order kept, settings key drops hyphens", () => {
  assert.deepEqual(activeRetailers(FENDER_RETAILERS).map((retailer) => retailer.name), ["Walmart", "Musician's Friend"]);
  assert.deepEqual(activeRetailers(LEDLENSER_RETAILERS).map((retailer) => retailer.key), ["walmart"]);
  assert.equal(retailerSettingKey("musicians-friend"), "musiciansfriend");
  assert.equal(retailerSettingKey("walmart"), "walmart");
});

/** A fake PostgREST client: records each request's filters and answers from fixed rows. */
function fakeClient(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ view: string; filters: string[] }> = [];
  const from = (view: string) => {
    const filters: string[] = [];
    let rows = [...(tables[view] ?? [])];
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push(`${column}=eq.${value}`);
        rows = rows.filter((row) => row[column] === value);
        return chain;
      },
      neq: (column: string, value: unknown) => {
        filters.push(`${column}=neq.${value}`);
        rows = rows.filter((row) => row[column] !== value);
        return chain;
      },
      gte: (column: string, value: string) => {
        filters.push(`${column}=gte.${value}`);
        rows = rows.filter((row) => String(row[column]) >= value);
        return chain;
      },
      in: (column: string, values: unknown[]) => {
        filters.push(`${column}=in.(${values.length})`);
        rows = rows.filter((row) => values.includes(row[column]));
        return chain;
      },
      range: (from: number, to: number) => {
        calls.push({ view, filters });
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
      },
    };
    return chain;
  };
  return { client: { from }, calls };
}

test("the read applies the first-miss rule from two small history reads, without price searches", async () => {
  const history = [
    { id: 1, asin: "B0DYKS9M5B", retailer: "walmart", status: "priced", observed_at: "2026-11-22T04:54:05Z", price: 258.99, url: "https://www.walmart.com/ip/18009572514", source: "backfill" },
    { id: 2, asin: "B0DYKS9M5B", retailer: "walmart", status: "no_match", observed_at: "2026-11-23T20:54:27Z", price: null, url: null, source: "retailer_checker" },
    // A later R-15 search result is not a retailer check and must not end the miss run.
    { id: 3, asin: "B0DYKS9M5B", retailer: "walmart", status: "priced", observed_at: "2026-11-23T21:00:00Z", price: 1, url: null, source: "price_search" },
    { id: 4, asin: "B000NEVER1", retailer: "walmart", status: "no_match", observed_at: "2026-11-23T20:54:27Z", price: null, url: null, source: "retailer_checker" },
  ];
  const { client, calls } = fakeClient({
    canvas_retailers: FENDER_RETAILERS as unknown as Array<Record<string, unknown>>,
    canvas_retail_prices: [
      { asin: "B0DYKS9M5B", retailer: "walmart", status: "no_match", observed_at: "2026-11-23T20:54:27Z", price: null, url: null, map_price: 300, leakage: null },
      { asin: "B000NEVER1", retailer: "walmart", status: "no_match", observed_at: "2026-11-23T20:54:27Z", price: null, url: null, map_price: 300, leakage: null },
    ],
    canvas_retail_price_history: history,
  });
  const index = await loadRetailerPrices(client, Date.parse("2026-11-24T00:00:00Z"));
  assert.equal(index.byAsin.get("B0DYKS9M5B")?.[0].price, 258.99);
  assert.equal(index.byAsin.get("B0DYKS9M5B")?.[0].firstMiss, true);
  assert.equal(index.byAsin.get("B000NEVER1")?.[0].price, null);
  const historyCalls = calls.filter((call) => call.view === "canvas_retail_price_history");
  assert.equal(historyCalls.length, 2);
  for (const call of historyCalls) assert.ok(call.filters.includes("source=neq.price_search"));
});

test("a failed retailer read throws instead of reading as zero", async () => {
  const client = {
    from: () => {
      const chain = {
        select: () => chain,
        order: () => chain,
        range: () => Promise.resolve({ data: null, error: { message: "permission denied" } }),
      };
      return chain;
    },
  };
  await assert.rejects(loadRetailerPrices(client), /permission denied/);
});
