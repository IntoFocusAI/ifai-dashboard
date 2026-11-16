// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/full-result-sort.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { listingChannelFacts, type MapSourceRow } from "../lib/fender-canvas/map-channels.ts";
import { exploreListingSortValue } from "../lib/fender-canvas/listing-table-sort.ts";
import {
  applyColumnSort,
  loadFilteredPages,
  orderFullResult,
  pageSlice,
} from "../lib/fender-canvas/full-result-sort.ts";
import { specReadinessSortValue } from "../lib/fender-canvas/spec-table-sort.ts";
import type { CanvasRetailListingRow, CanvasSpecReadinessRow } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");
const PAGE = 50;

function listing(partial: Partial<CanvasRetailListingRow> & { asin: string }): CanvasRetailListingRow {
  return {
    model_name: partial.asin,
    title: null,
    bundle_name: null,
    buybox_seller_name: null,
    map_price: null,
    offer_price: null,
    worst_leakage: null,
    reviews_count: null,
    channels: null,
    buybox_status: null,
    is_map_violation: true,
    is_bundle: false,
    wmt_price: null,
    wmt_leakage: null,
    wmt_url: null,
    mf_price: null,
    mf_leakage: null,
    ...partial,
  };
}

function asMapRow(row: CanvasRetailListingRow): MapSourceRow {
  return {
    asin: row.asin,
    model_name: row.model_name,
    title: row.title,
    map_price: row.map_price,
    offer_price: row.offer_price,
    amz_leakage: row.amz_leakage ?? null,
    worst_leakage: row.worst_leakage,
    wmt_price: row.wmt_price,
    wmt_leakage: row.wmt_leakage,
    wmt_url: row.wmt_url,
    mf_price: row.mf_price,
    mf_leakage: row.mf_leakage,
  };
}

function displayedAmazon(row: CanvasRetailListingRow): number | null {
  return listingChannelFacts(asMapRow(row)).find((fact) => fact.key === "amazon")?.price ?? null;
}

function exploreValue(row: CanvasRetailListingRow, columnId: string, extras?: Map<string, number>) {
  return exploreListingSortValue(row, columnId, (id) => {
    if (id === "amazon") return displayedAmazon(row);
    return extras?.get(row.asin) ?? null;
  });
}

test("a paged fetch keeps the filtered population, and a column sort orders all of it", async () => {
  const serverOrder: CanvasRetailListingRow[] = [
    listing({ asin: "B-MISSING-PRICE", offer_price: 0, reviews_count: 8 }),
    listing({ asin: "B-UNREAD", offer_price: 80, reviews_count: 0 }),
    listing({ asin: "B-TIE", offer_price: 40, reviews_count: 3 }),
    listing({ asin: "A-TIE", offer_price: 40, reviews_count: 3 }),
    listing({ asin: "B-DROP", offer_price: 1, reviews_count: 9, is_map_violation: false }),
  ];
  for (let index = serverOrder.length; index < 60; index += 1) {
    serverOrder.push(listing({ asin: `B-FILL-${String(index).padStart(2, "0")}`, offer_price: 100 + index, reviews_count: 2 }));
  }
  serverOrder[59] = listing({ asin: "B-GLOBAL-MIN", offer_price: 5, reviews_count: 6 });
  serverOrder[58] = listing({ asin: "B-GLOBAL-MAX", offer_price: 900, reviews_count: 4 });

  let calls = 0;
  const loaded = await loadFilteredPages(async (page, size) => {
    calls += 1;
    const matched = serverOrder.filter((row) => row.is_map_violation === true);
    return {
      data: matched.slice(page * size, page * size + size),
      error: null,
      count: matched.length,
    };
  }, PAGE);

  assert.equal(calls, 2);
  assert.equal(loaded.error, null);
  assert.equal(loaded.total, 59);
  assert.equal(loaded.rows.length, 59);
  assert.equal(loaded.rows.some((row) => row.asin === "B-DROP"), false);
  assert.equal(loaded.rows[0]?.asin, "B-MISSING-PRICE");

  const pageOnly = orderFullResult(
    loaded.rows.slice(0, PAGE),
    "number",
    "asc",
    (row) => exploreValue(row, "amazon"),
    (row) => row.asin,
  );
  assert.notEqual(pageOnly[0]?.asin, "B-GLOBAL-MIN");

  const asc = orderFullResult(
    loaded.rows,
    "number",
    "asc",
    (row) => exploreValue(row, "amazon"),
    (row) => row.asin,
  );
  const desc = orderFullResult(
    loaded.rows,
    "number",
    "desc",
    (row) => exploreValue(row, "amazon"),
    (row) => row.asin,
  );
  assert.equal(asc[0]?.asin, "B-GLOBAL-MIN");
  assert.equal(desc[0]?.asin, "B-GLOBAL-MAX");
  assert.equal(asc.at(-1)?.asin, "B-MISSING-PRICE");
  assert.equal(desc.at(-1)?.asin, "B-MISSING-PRICE");

  const ascPage1 = pageSlice(asc, 0, PAGE);
  const ascPage2 = pageSlice(asc, 1, PAGE);
  assert.equal(ascPage1[0]?.asin, asc[0]?.asin);
  assert.equal(ascPage1.at(-1)?.asin, asc[PAGE - 1]?.asin);
  assert.equal(ascPage2[0]?.asin, asc[PAGE]?.asin);
  assert.ok((ascPage1.at(-1)?.offer_price ?? 0) <= (ascPage2[0]?.offer_price ?? 0));
  assert.equal(ascPage1.some((row) => row.asin === "B-MISSING-PRICE"), false);

  const tieAsc = asc.filter((row) => row.offer_price === 40).map((row) => row.asin);
  const tieDesc = desc.filter((row) => row.offer_price === 40).map((row) => row.asin);
  assert.deepEqual(tieAsc, ["A-TIE", "B-TIE"]);
  assert.deepEqual(tieDesc, ["A-TIE", "B-TIE"]);

  const reviews = orderFullResult(
    loaded.rows,
    "number",
    "asc",
    (row) => exploreValue(row, "reviews"),
    (row) => row.asin,
  );
  assert.equal(reviews.at(-1)?.asin, "B-UNREAD");
  assert.notEqual(reviews[0]?.reviews_count, 0);

  const fromPage = 4;
  const firstSort = applyColumnSort(null, "amazon");
  assert.equal(firstSort.page, 0);
  assert.deepEqual(firstSort.sort, { columnId: "amazon", direction: "asc" });
  assert.equal(fromPage === 4 && firstSort.page === 0, true);
  const flipped = applyColumnSort(firstSort.sort, "amazon");
  assert.equal(flipped.page, 0);
  assert.equal(flipped.sort.direction, "desc");
  const switched = applyColumnSort(flipped.sort, "reviews");
  assert.equal(switched.page, 0);
  assert.equal(switched.sort.columnId, "reviews");
});

test("an extra-channel price from the second read sorts with the full listing population", () => {
  const rows = Array.from({ length: 55 }, (_, index) => listing({ asin: `B-CH-${index}`, offer_price: 20 }));
  const extras = new Map<string, number>([
    ["B-CH-1", 30],
    ["B-CH-54", 400],
  ]);
  const desc = orderFullResult(
    rows,
    "number",
    "desc",
    (row) => exploreValue(row, "sweetwater", extras),
    (row) => row.asin,
  );
  assert.equal(desc[0]?.asin, "B-CH-54");
  assert.equal(desc.at(-1)?.asin === "B-CH-1" || desc.at(-1)?.offer_price === 20, true);
  assert.equal(pageSlice(desc, 0, PAGE).some((row) => row.asin === "B-CH-54"), true);
  const pageOnly = orderFullResult(
    rows.slice(0, PAGE),
    "number",
    "desc",
    (row) => exploreValue(row, "sweetwater", extras),
    (row) => row.asin,
  );
  assert.notEqual(pageOnly[0]?.asin, "B-CH-54");
});

test("spec readiness and schema gaps sort the filtered population across pages", () => {
  const specs: CanvasSpecReadinessRow[] = Array.from({ length: 60 }, (_, index) => ({
    asin: `S${String(index).padStart(3, "0")}`,
    title: `Model ${String(index).padStart(3, "0")}`,
    amazon_completeness_pct: 50,
    fender_completeness_pct: null,
    fender_found: false,
    fender_url: null,
    amazon_missing_fields: "SCALE_LENGTH",
  }));
  specs[0] = { ...specs[0], asin: "S-MISSING", amazon_completeness_pct: null, amazon_missing_fields: "  ", fender_found: null };
  specs[2] = { ...specs[2], asin: "S-DROP", amazon_completeness_pct: 1, fender_found: true };
  specs[54] = { ...specs[54], asin: "S-MIN", title: "Alpha model", amazon_completeness_pct: 4, fender_found: false };
  specs[53] = { ...specs[53], asin: "S-MAX", amazon_completeness_pct: 96, fender_found: false };
  specs[8] = { ...specs[8], asin: "S-TIE-B", amazon_completeness_pct: 40 };
  specs[9] = { ...specs[9], asin: "S-TIE-A", amazon_completeness_pct: 40 };

  const filtered = specs.filter((row) => row.fender_found === false);
  const asc = orderFullResult(filtered, "number", "asc", (row) => specReadinessSortValue(row, "amazon"), (row) => row.asin);
  const desc = orderFullResult(filtered, "number", "desc", (row) => specReadinessSortValue(row, "amazon"), (row) => row.asin);
  assert.equal(asc[0]?.asin, "S-MIN");
  assert.equal(desc[0]?.asin, "S-MAX");
  assert.equal(asc.some((row) => row.asin === "S-DROP"), false);
  assert.equal(asc.some((row) => row.asin === "S-MISSING"), false);
  const page1 = pageSlice(asc, 0, PAGE);
  const page2 = pageSlice(asc, 1, PAGE);
  assert.equal(page1.at(-1)?.asin, asc[PAGE - 1]?.asin);
  assert.equal(page2[0]?.asin, asc[PAGE]?.asin);
  assert.ok((page1.at(-1)?.amazon_completeness_pct ?? 0) <= (page2[0]?.amazon_completeness_pct ?? 0));

  const ties = asc.filter((row) => row.amazon_completeness_pct === 40).map((row) => row.asin);
  assert.deepEqual(ties, ["S-TIE-A", "S-TIE-B"]);

  const byModel = orderFullResult(filtered, "text", "asc", (row) => specReadinessSortValue(row, "model"), (row) => row.asin);
  assert.equal(byModel[0]?.asin, "S-MIN");

  const blanks = orderFullResult(specs, "text", "asc", (row) => specReadinessSortValue(row, "missing"), (row) => row.asin);
  assert.equal(blanks.at(-1)?.asin, "S-MISSING");
  const found = orderFullResult(specs, "text", "desc", (row) => specReadinessSortValue(row, "found"), (row) => row.asin);
  assert.equal(found.at(-1)?.asin, "S-MISSING");

  assert.equal(pageSlice(byModel, 1, PAGE)[0]?.asin, byModel[PAGE]?.asin);
  const reset = applyColumnSort({ columnId: "asin", direction: "asc" }, "model");
  assert.equal(reset.page, 0);
  assert.equal(reset.sort.direction, "asc");
});

test("sticky headers and column resizing stay in place while the full population sorts", () => {
  for (const [path, tableId, height] of [
    ["components/v3/live/FenderListingsTable.tsx", "explore-listings", /maxHeight=\{520\}/],
    ["components/v3/live/FenderSpecPanel.tsx", "spec-readiness", /maxHeight=\{SPEC_TABLE_MAX_HEIGHT\}/],
  ] as const) {
    const source = read(path);
    assert.match(source, new RegExp(`tableId="${tableId}"`));
    assert.match(source, /freezeHeader/);
    assert.match(source, height);
    assert.match(source, /loadFilteredPages/);
    assert.doesNotMatch(source, /useClientTableSort/);
  }
  assert.match(read("components/v3/live/FenderSpecPanel.tsx"), /SPEC_TABLE_MAX_HEIGHT = 420/);
  // Machine Readability loads every page first, so its client sort already covers the full population.
  const pages = read("components/v3/live/MachineReadabilityPageTable.tsx");
  assert.match(pages, /tableId="machine-readability-pages"/);
  assert.match(pages, /freezeHeader/);
  assert.match(pages, /sorted\.rows\.slice\(shown \* PAGE/);
  const resize = read("components/v3/live/ResizableTable.tsx");
  assert.match(resize, /col-resize-handle/);
  assert.match(resize, /aria-sort/);
  assert.match(resize, /columnWidthStorageKey/);
  const queries = read("lib/canvasData.ts");
  assert.match(queries, /export function listingsQuery\(\s*page = 0,\s*size = 50,/);
  assert.match(queries, /\.order\("worst_leakage", \{ ascending: true, nullsFirst: false \}\)/);
  assert.match(queries, /\.order\("amazon_completeness_pct", \{ ascending: true \}\)/);
  assert.match(read("lib/fender-canvas/machine-readability.ts"), /\.order\("asin", \{ ascending: true \}\)/);
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.match(css, /\.table-freeze-head \.resizable-th \{[^}]*position:\s*sticky[^}]*top:\s*0/s);
});
