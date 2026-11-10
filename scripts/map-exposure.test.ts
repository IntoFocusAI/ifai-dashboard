// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/map-exposure.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { MapSourceRow } from "../lib/fender-canvas/map-channels.ts";
import {
  ANALYST_ESTIMATE_LABEL,
  AWAITING_INPUTS_LABEL,
  MAP_EXPOSURE_LABEL,
  MAP_AWAITING_RULE,
  amazonGapBelowMap,
  mapAwaitingCount,
  mapAwaitingSentence,
  mapExposure,
  mapExposureCoverage,
  mapExposureOrder,
  mapExposureSummary,
  mapExposureSummaryTip,
  mapExposureTip,
  mapUnitsLookup,
  type MapUnitsRow,
} from "../lib/fender-canvas/map-exposure.ts";
import { withoutApprovedExceptions } from "../lib/fender-canvas/map-approved-exceptions.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* FDD R-09: MAP exposure is violations N of M, price gap, estimated monthly units, and
   discounted retail value (gap times units), labeled analyst estimate and never lost revenue.
   A listing without units is awaiting inputs, never $0. */

function row(asin: string, overrides: Partial<MapSourceRow> = {}): MapSourceRow {
  return {
    asin,
    model_name: `Listing ${asin}`,
    title: null,
    map_price: 100,
    offer_price: 80,
    amz_leakage: -20,
    worst_leakage: -20,
    wmt_price: null,
    wmt_leakage: null,
    wmt_url: null,
    mf_price: null,
    mf_leakage: null,
    ...overrides,
  };
}

function units(asin: string, value: number | null, snapshot: string | null = "2026-11-09"): MapUnitsRow {
  return { asin, smartscout_monthly_units: value, smartscout_snapshot_date: snapshot };
}

const ROWS: MapSourceRow[] = [
  row("B000000001"), // $20 x 10 units
  row("B000000002", { offer_price: 95, amz_leakage: -5, worst_leakage: -5 }), // $5 x 4 units
  row("B000000003"), // no SmartScout record
  row("B000000004"), // SmartScout record, no unit estimate
  row("B000000005"), // zero units
  // Below MAP at Walmart only: Amazon sells at MAP.
  row("B000000006", { offer_price: 100, amz_leakage: 0, wmt_price: 70, wmt_leakage: -30, worst_leakage: -30 }),
];

const LOOKUP = mapUnitsLookup([
  units("B000000001", 10),
  units("B000000002", 4),
  units("B000000004", null),
  units("B000000005", 0),
  units("B000000006", 50),
]);

test("discounted retail value is the Amazon gap times SmartScout monthly units", () => {
  const exposure = mapExposure(ROWS[0], LOOKUP);
  assert.deepEqual(exposure, { status: "estimated", gap: 20, units: 10, value: 200, snapshotDate: "2026-11-09" });
  const tip = mapExposureTip(exposure);
  assert.match(tip, /\$20\.00 below MAP on Amazon × 10 estimated monthly units \(SmartScout\) = \$200\.00 a month/);
  assert.match(tip, /Analyst estimate/);
  assert.match(tip, /SmartScout read Nov 9, 2026/);
});

test("the Amazon gap comes from stored leakage, then from MAP minus the Amazon price", () => {
  assert.equal(amazonGapBelowMap(row("A", { amz_leakage: -12.5 })), 12.5);
  assert.equal(amazonGapBelowMap(row("A", { amz_leakage: null, map_price: 100, offer_price: 91 })), 9);
  assert.equal(amazonGapBelowMap(row("A", { amz_leakage: 0 })), null);
  assert.equal(amazonGapBelowMap(row("A", { amz_leakage: 15 })), null);
  assert.equal(amazonGapBelowMap(row("A", { amz_leakage: null, offer_price: null })), null);
});

test("a listing without usable units is awaiting inputs with its reason, never $0", () => {
  const reasons = ROWS.slice(2).map((item) => {
    const exposure = mapExposure(item, LOOKUP);
    assert.equal(exposure.status, "awaiting");
    assert.equal("value" in exposure, false, "an awaiting listing carries no dollar value");
    return exposure.status === "awaiting" ? exposure.reason : null;
  });
  assert.deepEqual(reasons, ["no_units_source", "no_units_estimate", "no_units_sold", "other_retailer_only"]);
  for (const item of ROWS.slice(2)) {
    const tip = mapExposureTip(mapExposure(item, LOOKUP));
    assert.match(tip, new RegExp(`^${AWAITING_INPUTS_LABEL}\\.`));
    assert.doesNotMatch(tip, /\$0\.00/);
  }
});

test("a gap at another retailer is not multiplied by Amazon units", () => {
  const exposure = mapExposure(ROWS[5], LOOKUP);
  assert.equal(exposure.status, "awaiting");
  // The stored SmartScout estimate still shows in the units column.
  assert.equal(exposure.units, 50);
  assert.match(mapExposureTip(exposure), /unit estimate is for Amazon/);
});

test("the summary counts estimated and awaiting listings and totals one source", () => {
  const summary = mapExposureSummary(ROWS, LOOKUP);
  assert.equal(summary.violations, 6);
  assert.equal(summary.estimated, 2);
  assert.equal(summary.awaiting, 4);
  assert.equal(summary.totalValue, 220);
  assert.equal(summary.totalUnits, 14);
  assert.equal(summary.source, "SmartScout");
  assert.equal(summary.latestSnapshot, "2026-11-09");
  assert.deepEqual(summary.awaitingByReason, {
    no_units_source: 1,
    no_units_estimate: 1,
    no_units_sold: 1,
    other_retailer_only: 1,
  });
  assert.equal(mapExposureCoverage(summary), "Covers 2 of 6 listings below MAP.");
  assert.equal(mapAwaitingCount(summary), "4 are awaiting inputs.");
  assert.match(mapAwaitingSentence(summary) ?? "", /^4 are awaiting inputs and are not counted as \$0: /);
  const tip = mapExposureSummaryTip(summary, "1 listing set aside as an approved exception is left out of this count.");
  assert.match(tip, /price gap below MAP on Amazon times its SmartScout estimated monthly units/);
  assert.match(tip, /Covers 2 of 6 listings below MAP\./);
  // The tooltip says what is awaited: units exist only for Amazon, and zero units count as awaiting.
  assert.match(tip, /Unit estimates exist only for Amazon/);
  assert.match(tip, /only at another retailer/);
  assert.match(tip, /zero estimated units, is awaiting inputs/);
  assert.equal(tip.includes(MAP_AWAITING_RULE), true);
  assert.match(tip, /analyst estimate/);
  assert.match(tip, /approved exception is left out/);
});

test("no estimated listing leaves the total empty, never $0", () => {
  const summary = mapExposureSummary(ROWS.slice(2), LOOKUP);
  assert.equal(summary.estimated, 0);
  assert.equal(summary.totalValue, null);
  assert.equal(summary.totalUnits, null);
  const none = mapExposureSummary([], LOOKUP);
  assert.equal(none.totalValue, null);
  assert.equal(mapAwaitingSentence(none), null);
  assert.equal(mapAwaitingCount(none), null);
});

test("an approved exception leaves the exposure total (R-12)", () => {
  const counted = withoutApprovedExceptions(ROWS, new Set(["B000000001"]));
  const summary = mapExposureSummary(counted, LOOKUP);
  assert.equal(summary.violations, 5);
  assert.equal(summary.estimated, 1);
  assert.equal(summary.totalValue, 20);
});

test("the table leads with the largest estimate, then awaiting listings in the read order", () => {
  const order = mapExposureOrder([ROWS[2], ROWS[1], ROWS[5], ROWS[0]], LOOKUP).map((item) => item.asin);
  assert.deepEqual(order, ["B000000001", "B000000002", "B000000003", "B000000006"]);
});

test("the exposure is labeled analyst estimate and never lost revenue", () => {
  assert.equal(ANALYST_ESTIMATE_LABEL, "analyst estimate");
  assert.equal(MAP_EXPOSURE_LABEL, "Discounted retail value");
  const sources = [
    "components/v3/live/MapExposureCard.tsx",
    "components/v3/live/MapListingsTable.tsx",
    "components/v3/live/MapChannelPanel.tsx",
    "lib/export/map-export.ts",
  ].map(read);
  for (const source of sources) {
    assert.doesNotMatch(source, /lost revenue|lost sales/i);
    assert.doesNotMatch(source, /duration/i, "no duration column until MAP history is stored");
  }
  const lib = read("lib/fender-canvas/map-exposure.ts");
  // The one mention is the comment that rules the label out.
  assert.equal((lib.match(/lost revenue/gi) ?? []).length, 1);
  const card = read("components/v3/live/MapExposureCard.tsx");
  assert.match(card, /ANALYST_ESTIMATE_LABEL/);
  assert.match(card, /PartialFigureMark/);
  assert.match(card, /AWAITING_INPUTS_LABEL/);
  const table = read("components/v3/live/MapListingsTable.tsx");
  assert.match(table, /MAP_UNITS_COLUMN_ID/);
  assert.match(table, /MAP_EXPOSURE_COLUMN_ID/);
  assert.match(table, /SET_ASIDE_SORT_COLUMN/);
});

test("the CSV carries the same exposure columns and population sentence", () => {
  const source = read("lib/export/map-export.ts");
  assert.match(source, /loadMapUnits/);
  assert.match(source, /mapExposureOrder/);
  assert.match(source, /MAP_EXPOSURE_ORDER/);
  assert.match(source, /withoutApprovedExceptions/);
  assert.match(source, /mapAwaitingSentence/);
});
