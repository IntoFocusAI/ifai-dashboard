// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/c6-client-constants.test.ts
/* Parity chunk C6 (X-35, decision 105; audit P-11, P-13 to P-16, P-29, P-30): Catalog Health and
   AI Readiness constants come from the client settings record, never from the client's name.
   Fender and Ledlenser read exactly what they read before the move. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { resetActiveClientForTests } from "@/lib/client/active-client";
import { mapChannelWhy, mapPricesNotStoredWhy } from "@/lib/fender-canvas/command-center-from-live";
import { requiredMarketplaceSpecShare, requiredSpecsPlaceholderTooltip } from "@/lib/fender-canvas/consensus-scores";
import { dataSourceFreshness } from "@/lib/fender-canvas/data-source-freshness";
import type { MapSourceRow } from "@/lib/fender-canvas/map-channels";
import { mapChannelStale } from "@/lib/fender-canvas/map-reading-status";
import { catalogBundleLineLabel } from "@/lib/fender-canvas/portfolio-retail";
import { retailerRecheckDays } from "@/lib/fender-canvas/row-stale";
import { cells, LEDLENSER_RETAILERS } from "./fixtures/retailer-rows.ts";
import { placeholderSpecGroups, specBlockPhrase } from "@/lib/findability/placeholder-spec-fields";
import { findabilityColumns } from "@/lib/findability/queries";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function as<T>(client: string, fn: () => T): T {
  resetActiveClientForTests(client);
  try {
    return fn();
  } finally {
    resetActiveClientForTests(null);
  }
}

const C6_FILES = [
  "lib/fender-canvas/row-stale.ts",
  "lib/fender-canvas/data-source-freshness.ts",
  "lib/fender-canvas/map-reading-status.ts",
  "lib/fender-canvas/command-center-from-live.ts",
  "lib/fender-canvas/portfolio-retail.ts",
  "lib/fender-canvas/consensus-scores.ts",
  "components/v3/live/StockLossPanel.tsx",
  "lib/fender-canvas/stock-loss.ts",
  "components/v3/live/SpecNarratives.tsx",
  "lib/findability/queries.ts",
];

test("C6: no Catalog Health or AI Readiness file branches on a client name", () => {
  for (const path of C6_FILES) {
    const source = read(path);
    assert.doesNotMatch(source, /isFenderClient\(/, path);
    assert.doesNotMatch(source, /\.key\s*[!=]==\s*["'](fender|ledlenser)["']/, path);
    assert.doesNotMatch(source, /walmartFender|walmartLedlenser|AUTHORIZED_BUY_BOX_PARTNERS/, path);
  }
});

test("P-14: retailer recheck days come from the retailers setting", () => {
  assert.deepEqual(as("fender", () => [retailerRecheckDays("walmart"), retailerRecheckDays("musiciansfriend")]), [1, 3]);
  assert.deepEqual(as("ledlenser", () => [retailerRecheckDays("walmart"), retailerRecheckDays("musiciansfriend")]), [2, null]);

  const NOW = Date.parse("2026-11-17T12:00:00Z");
  const at = new Date(NOW - 3 * 86_400_000).toISOString();
  const base = {
    asin: "B0TEST",
    model_name: null,
    title: null,
    map_price: 100,
    offer_price: 90,
    worst_leakage: 10,
    featured_offer_checked_at: at,
  };
  const row: MapSourceRow = {
    ...base,
    retailers: cells("B0TEST", { walmart: { price: 90, checkedAt: at }, "musicians-friend": { price: 90, checkedAt: at } }, 100),
  };
  const ledlenserRow: MapSourceRow = {
    ...base,
    retailers: cells("B0TEST", { walmart: { price: 90, checkedAt: at } }, 100, LEDLENSER_RETAILERS),
  };
  // Three days old: stale against Fender's 1-day Walmart rule (2-day window), fresh against Ledlenser's 2-day rule.
  const fender = as("fender", () => mapChannelStale([row], NOW));
  const ledlenser = as("ledlenser", () => mapChannelStale([ledlenserRow], NOW));
  assert.ok(fender.Walmart);
  assert.equal(ledlenser.Walmart, null);
  assert.equal(fender["Musician's Friend"], null, "3 days is inside the 6-day Musician's Friend window");
  assert.equal(ledlenser["Musician's Friend"] ?? null, null, "Ledlenser has no Musician's Friend check");

  const rows = [
    { job_key: "map_leakage_walmart", last_run_at: at },
    { job_key: "map_parity_musiciansfriend", last_run_at: at },
  ];
  const freshness = (client: string) =>
    as(client, () => dataSourceFreshness(rows as never, NOW).map((s) => `${s.id}:${s.intervalDays}:${s.outOfDate}`));
  assert.deepEqual(freshness("fender"), ["walmart:1:true", "musiciansfriend:3:false"]);
  assert.deepEqual(freshness("ledlenser"), ["walmart:2:false"]);
});

test("P-13: the MAP sentences name Amazon plus the client's retailers, read per call", () => {
  assert.equal(
    as("fender", mapChannelWhy),
    "Open the MAP Leakage tab for the current below-MAP listings. Amazon, Walmart, and Musician's Friend appear only when this read stored a price for that channel. Any other retailer appears only when a stored price exists for that channel.",
  );
  assert.equal(
    as("fender", mapPricesNotStoredWhy),
    "Fender MAP prices have not been stored. Amazon, Walmart, and Musician's Friend prices still show when a price is stored for that channel. A missing price stays blank.",
  );
  assert.match(as("ledlenser", mapChannelWhy), /\. Amazon and Walmart appear only when/);
  assert.match(as("ledlenser", mapPricesNotStoredWhy), /^Ledlenser MAP prices have not been stored\. Amazon and Walmart prices/);
});

test("P-15: the Out of Stock seller sentence keys on seller_type", () => {
  const source = read("lib/fender-canvas/stock-loss.ts");
  assert.match(source, /seller_type === "partner_led"/);
  assert.doesNotMatch(source, /Fender sells through dealers/);
});

test("P-16: short bundle labels come from category_short_labels", () => {
  assert.equal(as("fender", () => catalogBundleLineLabel("Electric Guitar Kits")), "Kits");
  assert.equal(as("fender", () => catalogBundleLineLabel("Hollow & Semi-Hollow Body")), "Hollow");
  assert.equal(as("fender", () => catalogBundleLineLabel("Solid Body")), "Solid Body");
  assert.equal(as("ledlenser", () => catalogBundleLineLabel("Electric Guitar Kits")), "Electric Guitar Kits");
  assert.equal(as("ledlenser", () => catalogBundleLineLabel("Handheld Flashlights")), "Handheld Flashlights");
});

test("P-29, P-30: placeholder field sets and spec copy follow the product_types setting", () => {
  assert.deepEqual(as("fender", () => placeholderSpecGroups().map((g) => g.label)), ["guitar and instrument"]);
  assert.deepEqual(as("ledlenser", () => placeholderSpecGroups().map((g) => g.label)), ["lighting"]);
  assert.equal(
    as("fender", requiredSpecsPlaceholderTooltip),
    "Placeholder: this list is a default until required specs are approved by category. The guitar and instrument fields are scale length, handedness, weight, dimensions, strings, fretboard, bridge, pickups, neck, part number, body, color, and UPC.",
  );
  assert.equal(
    as("ledlenser", requiredSpecsPlaceholderTooltip),
    "Placeholder: this list is a default until required specs are approved by category. The lighting fields are max lumens, beam distance, runtime, water resistance, battery type, power source, light source, weight, dimensions, material, color, UPC, and part number.",
  );
  assert.equal(as("fender", specBlockPhrase), "neck, pickup, and hardware specs");
  assert.equal(as("ledlenser", specBlockPhrase), "detailed product specs");
  // A product type with no placeholder set gives no figure, never another client's set.
  assert.deepEqual(placeholderSpecGroups(["FISHING_ROD"]), []);
  const gaps = [{ missingFields: ["beam_distance"] }, { missingFields: ["scale_length"] }];
  assert.deepEqual(as("fender", () => requiredMarketplaceSpecShare(gaps, 10)), { numerator: 9, denominator: 10 });
  assert.deepEqual(as("ledlenser", () => requiredMarketplaceSpecShare(gaps, 10)), { numerator: 9, denominator: 10 });
});

test("findability columns: on_brand_sheet only for a client with a brand sheet", () => {
  assert.doesNotMatch(as("fender", findabilityColumns), /on_brand_sheet/);
  assert.match(as("ledlenser", findabilityColumns), /,on_brand_sheet$/);
});
