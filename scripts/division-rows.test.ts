import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { catalogDivisionCensus } from "../lib/fender-canvas/division-census.ts";
import {
  DIVISION_NEXT_STEP_RULE,
  divisionRowModels,
  NOT_AVAILABLE,
} from "../lib/fender-canvas/division-rows.ts";
import { loadPortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";
import type { CanvasDivisionRow } from "../lib/fender-canvas/types.ts";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function division(over: Partial<CanvasDivisionRow> & { division: string }): CanvasDivisionRow {
  return {
    monitored_skus: null,
    buybox_pct: null,
    schema_sync_pct: null,
    splinter_bundles: null,
    primary_threat: null,
    strategic_action: null,
    ...over,
  };
}

function listing(category: string | null, status: string | null, seller: string | null = null) {
  return { category, buybox_status: status, buybox_seller_name: seller };
}

const LIVE_SHAPE: CanvasDivisionRow[] = [
  division({ division: "Electric Guitar Kits", monitored_skus: 227, splinter_bundles: 196, buybox_pct: 6.1, schema_sync_pct: 0 }),
  division({ division: "Solid Body", monitored_skus: 3292, splinter_bundles: 719, buybox_pct: 5.4, schema_sync_pct: 0 }),
  division({ division: "Tuning Pegs", monitored_skus: 1, splinter_bundles: 0, buybox_pct: 0, schema_sync_pct: 0 }),
];

const CENSUS_ROWS = [
  listing("Solid Body", "Amazon 1P", "Amazon.com"),
  listing("Solid Body", "3P Confirmed", "Liberty Music Inc"),
  listing("Solid Body", "3P Confirmed", "GearTree"),
  listing("Solid Body", "No Active Offer"),
  listing(" solid body ", "3P Confirmed", "Austin Bazaar"),
  listing("Electric Guitar Kits", "3P Confirmed", "Kit Seller"),
  listing("Tuning Pegs", "No Active Offer"),
  listing(null, "Amazon 1P"),
];

test("division census counts known Buy Box holders and Amazon Retail per category", () => {
  const census = catalogDivisionCensus(CENSUS_ROWS);
  assert.ok(census);
  assert.deepEqual(census["solid body"], { listings: 5, knownHolder: 4, amazonHolds: 1 });
  assert.deepEqual(census["electric guitar kits"], { listings: 1, knownHolder: 1, amazonHolds: 0 });
  assert.deepEqual(census["tuning pegs"], { listings: 1, knownHolder: 0, amazonHolds: 0 });
  assert.equal(Object.keys(census).length, 3, "a listing with no category is not a division");
  assert.equal(catalogDivisionCensus(null), null);
});

test("each division row states its population as N of M and what was counted", () => {
  const census = catalogDivisionCensus(CENSUS_ROWS);
  const [kits, solid] = divisionRowModels(LIVE_SHAPE, census);
  assert.equal(solid.bundles.value, "21.8%");
  assert.equal(solid.bundles.count, "719 of 3,292 SKUs");
  assert.match(solid.bundles.tip, /^719 of the 3,292 Solid Body SKUs in the division read are bundle listings/);
  assert.equal(solid.buyBox.value, "25.0%");
  assert.equal(solid.buyBox.count, "1 of 4 listings");
  assert.equal(
    solid.buyBox.tip,
    "Amazon Retail holds the Buy Box on 1 of the 4 Solid Body listings whose Buy Box holder is known. 1 other listing has no known holder.",
  );
  assert.equal(kits.bundles.count, "196 of 227 SKUs");
  assert.equal(kits.buyBox.value, "0.0%");
  assert.equal(kits.buyBox.count, "0 of 1 listing");
});

test("each row has exactly one next step, chosen by the stated bundle-share rule", () => {
  const [kits, solid, pegs] = divisionRowModels(LIVE_SHAPE, catalogDivisionCensus(CENSUS_ROWS));
  assert.deepEqual(kits.next, { label: "Nest bundle listings", tab: "Catalog Governance" });
  assert.deepEqual(solid.next, { label: "Check Buy Box holders", tab: "Retail Overview" });
  assert.deepEqual(pegs.next, { label: "Check Buy Box holders", tab: "Retail Overview" });
  assert.match(DIVISION_NEXT_STEP_RULE, /at least 50% of its SKUs opens Catalog Governance/);
});

test("a missing figure reads Not available* with a tooltip, never n/a or a zero", () => {
  const [, , pegs] = divisionRowModels(LIVE_SHAPE, catalogDivisionCensus(CENSUS_ROWS));
  assert.equal(pegs.buyBox.value, NOT_AVAILABLE);
  assert.equal(pegs.buyBox.count, null);
  assert.equal(pegs.buyBox.tip, "None of the 1 Tuning Pegs listing in the retail read has a known Buy Box holder.");

  const [failed] = divisionRowModels([LIVE_SHAPE[1]], null);
  assert.equal(failed.buyBox.value, NOT_AVAILABLE);
  assert.match(failed.buyBox.tip, /The Buy Box read did not load/);

  const [absent] = divisionRowModels([division({ division: "Amps", monitored_skus: 4, splinter_bundles: 0 })], {});
  assert.equal(absent.buyBox.value, NOT_AVAILABLE);
  assert.equal(absent.buyBox.tip, "No Amps listing is in the retail read.");

  const [unstored] = divisionRowModels([division({ division: "Bass" })], {});
  assert.equal(unstored.bundles.value, NOT_AVAILABLE);
  assert.equal(unstored.bundles.tip, "The bundle count for Bass has not been stored.");

  for (const row of divisionRowModels(LIVE_SHAPE, null)) {
    for (const cell of [row.bundles, row.buyBox]) {
      assert.notEqual(cell.value.toLowerCase(), "n/a");
      assert.ok(cell.tip.length > 0);
    }
  }
});

test("the retail snapshot carries the division census from the catalog read", async () => {
  const empty = async () => ({ ok: true as const, rows: [], truncated: false });
  const snapshot = await loadPortfolioRetailSnapshot({
    suppressionRows: empty,
    mapRows: empty,
    catalogRows: async () => ({
      ok: true,
      truncated: false,
      rows: CENSUS_ROWS.map((row, i) => ({
        asin: `B00000000${i}`,
        model_name: null,
        title: null,
        bundle_name: null,
        parent_asin: null,
        product_url: null,
        is_bundle: false,
        ...row,
      })),
    }),
    catalogBundleCount: async () => null,
    specRows: empty,
  });
  assert.deepEqual(snapshot.divisionCensus?.["solid body"], { listings: 5, knownHolder: 4, amazonHolds: 1 });

  const failed = await loadPortfolioRetailSnapshot({
    suppressionRows: empty,
    mapRows: empty,
    catalogRows: async () => ({ ok: false }),
    catalogBundleCount: async () => null,
    specRows: empty,
  });
  assert.equal(failed.divisionCensus, null);
});

test("divisions table drops headline counts and constant columns and keeps rows unclickable", () => {
  const table = read("components/v3/live/FenderDivisionsTable.tsx");
  assert.match(table, /tableClassName="table-no-row-hover"/);
  assert.doesNotMatch(table, /onClick/);
  assert.doesNotMatch(table, /tag-badge|divisions\.length|\}\s*divisions/);
  assert.doesNotMatch(table, /Schema Sync|Primary Threat|"n\/a"|Performance Matrix/);
  assert.match(table, /data-ifai-open="ecommerce"/);
  assert.match(table, /data-ifai-tab=\{row\.next\.tab\}/);
  assert.match(table, /usePortfolioRetailSnapshot\(\)/);
  assert.doesNotMatch(table, /<[a-z][^>]*\stitle=/);

  const hook = read("components/v3/live/usePortfolioRetailSnapshot.ts");
  assert.match(hook, /let sharedLoad/);
  assert.match(hook, /if \(mountedCallers === 0\) sharedLoad = null/);
});
