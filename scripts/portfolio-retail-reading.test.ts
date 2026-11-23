import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listingChannelFacts,
  mapTabModel,
  missingCheckedPageLabel,
  MISSING_CHECKED_PAGE_LABEL,
  storedHttpUrl,
  type MapSourceRow,
} from "../lib/fender-canvas/map-channels.ts";
import { withRetailerPrices, retailerPriceIndex } from "../lib/fender-canvas/retailer-prices.ts";
import { cells, FENDER_RETAILERS, type CellSpec } from "./fixtures/retailer-rows.ts";

const ORDER = ["walmart", "musicians-friend"];

function row(
  overrides: Partial<MapSourceRow> & Pick<MapSourceRow, "asin">,
  retail: Record<string, CellSpec> = {},
): MapSourceRow {
  const base: MapSourceRow = {
    model_name: overrides.asin,
    title: null,
    map_price: 100,
    offer_price: 80,
    worst_leakage: -20,
    ...overrides,
  };
  return { ...base, retailers: cells(base.asin, retail, base.map_price) };
}

test("channels appear only when this read stored a price", () => {
  const model = mapTabModel(
    [
      row(
        { asin: "B000000001", offer_price: 80, worst_leakage: -20 },
        { walmart: { price: 77.5, url: "https://www.walmart.com/ip/1" }, "musicians-friend": { price: 79 } },
      ),
      row({ asin: "B000000002", offer_price: 90, worst_leakage: -10 }, { walmart: {} }),
      row({ asin: "B000000003", offer_price: 70, worst_leakage: -30 }, { walmart: { price: 65 } }),
    ],
    ORDER,
  );

  assert.equal(model.count, 3);
  assert.deepEqual(
    model.channels.map((channel) => channel.name),
    ["Amazon", "Walmart", "Musician's Friend"],
  );
  assert.equal(model.channels[1]?.count, 2);
  assert.equal(model.channels[2]?.count, 1);
  assert.deepEqual(
    model.columns.map((column) => column.key),
    ["amazon", "walmart", "musicians-friend"],
  );
  assert.equal(model.combinedGap, -60);
  assert.equal(model.averageGap, -20);
});

test("Amazon-only rows do not invent a retailer column", () => {
  const model = mapTabModel([row({ asin: "B000000004", offer_price: 40, map_price: 50, worst_leakage: -10 })], ORDER);
  assert.deepEqual(model.channels.map((channel) => channel.name), ["Amazon"]);
  assert.deepEqual(model.columns.map((column) => column.key), ["amazon"]);
});

test("a listing that is no longer returned is not counted", () => {
  const first = mapTabModel([row({ asin: "B000000001" }), row({ asin: "B000000009", worst_leakage: -30 })]);
  const next = mapTabModel([row({ asin: "B000000009", worst_leakage: -30 })]);
  assert.equal(first.count, 2);
  assert.equal(next.count, 1);
});

test("columns follow the client's retailer order, not the order rows arrive in", () => {
  const model = mapTabModel(
    [
      row({ asin: "B000000001" }, { "musicians-friend": { price: 69 } }),
      row({ asin: "B000000002" }, { walmart: { price: 70 } }),
    ],
    ORDER,
  );
  assert.deepEqual(model.columns.map((column) => column.name), ["Amazon", "Walmart", "Musician's Friend"]);
});

test("inactive retailers (Sweetwater, Reverb) stay hidden even with a stored price", () => {
  const model = mapTabModel(
    [row({ asin: "B000000001" }, { walmart: { price: 70 }, sweetwater: { price: 88.5 }, reverb: { price: 10 } })],
    ORDER,
  );
  assert.deepEqual(model.columns.map((column) => column.key), ["amazon", "walmart"]);
});

test("a retailer added by a row shows as a column, after the earlier ones in its sort order", () => {
  const list = [
    ...FENDER_RETAILERS,
    { slug: "guitar-center", display_name: "Guitar Center", map_channel: false, active: true, sort_order: 25 },
  ];
  const source = { asin: "B000000003", map_price: 100, offer_price: null, worst_leakage: null, model_name: null, title: null };
  const index = retailerPriceIndex(list, [
    { asin: "B000000003", retailer: "guitar-center", status: "priced", observed_at: "2026-11-23T00:00:00Z", price: 70, url: null, map_price: 100, leakage: null },
    { asin: "B000000003", retailer: "walmart", status: "priced", observed_at: "2026-11-23T00:00:00Z", price: 95, url: null, map_price: 100, leakage: -5 },
  ]);
  const [attached] = withRetailerPrices([source], index);
  const model = mapTabModel([attached], index.retailers.map((retailer) => retailer.key));
  assert.deepEqual(model.columns.map((column) => column.name), ["Walmart", "Guitar Center"]);
  // Guitar Center is display-only: its price shows, but it has no MAP gap and no violation.
  const gc = listingChannelFacts(attached).find((fact) => fact.key === "guitar-center");
  assert.equal(gc?.price, 70);
  assert.equal(gc?.gap, null);
  assert.deepEqual(model.channels.map((channel) => channel.name), ["Walmart"]);
  assert.equal(attached.worst_leakage, -5);
});

test("a stored price at or above MAP is not a channel count", () => {
  const model = mapTabModel(
    [
      row(
        { asin: "B000000001", map_price: 100, offer_price: 100, amz_leakage: 0 },
        { walmart: { price: 110 }, "musicians-friend": { price: 90 } },
      ),
    ],
    ORDER,
  );
  assert.deepEqual(model.channels.map((channel) => channel.name), ["Musician's Friend"]);
  assert.equal(model.channels[0]?.count, 1);
  assert.equal(model.showAmazon, true);
  assert.equal(model.columns.some((column) => column.key === "walmart"), true);
});

test("B0HJDFP2XS keeps the Musician's Friend price and does not invent a MAP gap", () => {
  const facts = listingChannelFacts(
    row(
      { asin: "B0HJDFP2XS", map_price: null, offer_price: 599.99, amz_leakage: null, worst_leakage: null },
      { "musicians-friend": { price: 599.99 } },
    ),
  );
  const musiciansFriend = facts.find((fact) => fact.name === "Musician's Friend");
  assert.equal(musiciansFriend?.price, 599.99);
  assert.equal(musiciansFriend?.gap, null);
  assert.equal(facts.every((fact) => fact.gap == null), true);
});

test("B0DYKZ4MJG keeps the Walmart price and does not invent a MAP gap", () => {
  const facts = listingChannelFacts(
    row(
      { asin: "B0DYKZ4MJG", map_price: null, offer_price: 287.93, amz_leakage: null, worst_leakage: null },
      { walmart: { price: 220.14 } },
    ),
  );
  const walmart = facts.find((fact) => fact.name === "Walmart");
  assert.equal(walmart?.price, 220.14);
  assert.equal(walmart?.gap, null);
  assert.equal(facts.some((fact) => fact.gap != null), false);
});

test("B0CMW1YK74 keeps the Amazon gap and the Musician's Friend gap apart", () => {
  const source = row(
    { asin: "B0CMW1YK74", map_price: 2497.99, offer_price: 2049.99, amz_leakage: -448, worst_leakage: -858 },
    { "musicians-friend": { price: 1639.99 } },
  );
  const facts = listingChannelFacts(source);
  const amazon = facts.find((fact) => fact.name === "Amazon");
  const musiciansFriend = facts.find((fact) => fact.name === "Musician's Friend");
  assert.equal(amazon?.price, 2049.99);
  assert.equal(amazon?.gap, -448);
  assert.equal(musiciansFriend?.price, 1639.99);
  assert.equal(musiciansFriend?.gap, -858);
  assert.equal(facts.some((fact) => fact.name === "Walmart"), false);
  assert.notEqual(amazon?.gap, source.worst_leakage);

  const model = mapTabModel([source], ORDER);
  assert.deepEqual(model.channels.map((channel) => channel.name), ["Amazon", "Musician's Friend"]);
  assert.equal(model.columns.some((column) => column.key === "walmart"), false);
});

test("a stored Musician's Friend URL is used as the checked page", () => {
  const stored = "https://www.musiciansfriend.com/guitars/fender-player-ii-jazzmaster/m11513000002000";
  const fact = listingChannelFacts(
    row({ asin: "B0D2LP2PRQ" }, { "musicians-friend": { price: 714.99, url: stored } }),
  ).find((entry) => entry.key === "musicians-friend");
  assert.equal(fact?.url, stored);
  assert.equal(fact?.requireCheckedPage, true);
  assert.equal(missingCheckedPageLabel(true, fact?.url, 714.99), null);
});

test("a missing retailer URL shows Not available* and no href", () => {
  const fact = listingChannelFacts(
    row({ asin: "B0HJDFP2XS" }, { "musicians-friend": { price: 599.99, url: null } }),
  ).find((entry) => entry.key === "musicians-friend");
  assert.equal(fact?.url, null);
  assert.equal(missingCheckedPageLabel(true, fact?.url, 599.99), MISSING_CHECKED_PAGE_LABEL);
  assert.equal(missingCheckedPageLabel(true, null, 599.99), "Not available*");
});

test("a checked page is never invented from an ASIN", () => {
  const facts = listingChannelFacts(row({ asin: "B0HJDFP2XS" }, { "musicians-friend": {} }));
  assert.equal(facts.some((fact) => fact.key === "musicians-friend"), false);
  assert.equal(storedHttpUrl(null), null);
  assert.equal(storedHttpUrl("not-a-url"), null);
});
