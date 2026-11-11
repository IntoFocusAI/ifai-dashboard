// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/table-toolbar.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  describeTableSearch,
  describeTableSort,
  filterRowsBySearch,
  rowSearchText,
  searchTerms,
} from "../lib/fender-canvas/table-search.ts";
import { orderedRowKeys, sourceRowKey } from "../components/v3/live/table-controls.ts";
import { parseShownRequest, shownCsv } from "../lib/export/shown.ts";
import { EXPORT_TABLE_IDS, exportFileName, exportHref, isExportTable } from "../lib/export/tables.ts";
import type { ExportSource } from "../lib/export/types.ts";

type Row = { asin: string; title: string; map: number; note?: string };
const ROWS: Row[] = [
  { asin: "B0STRAT001", title: "Player Stratocaster", map: 2999.99, note: "hidden strat note" },
  { asin: "B0TELE0002", title: "Player Telecaster", map: 899 },
  { asin: "B0JAZZ0003", title: "Jazz Bass", map: 1249.5 },
];
const COLUMNS = ["listing", "map"];
const value = (row: Row, id: string) => (id === "listing" ? row.title : id === "map" ? row.map : null);

test("search matches every word against visible values and the row's ASIN", () => {
  assert.deepEqual(searchTerms("  Player   STRAT "), ["player", "strat"]);
  assert.deepEqual(
    filterRowsBySearch(ROWS, "player strat", COLUMNS, value).map((row) => row.asin),
    ["B0STRAT001"],
  );
  assert.deepEqual(filterRowsBySearch(ROWS, "b0jazz", COLUMNS, value).map((row) => row.asin), ["B0JAZZ0003"]);
  assert.equal(filterRowsBySearch(ROWS, "", COLUMNS, value), ROWS);
});

test("search ignores dollar signs, commas, and percent signs", () => {
  assert.deepEqual(filterRowsBySearch(ROWS, "$2,999", COLUMNS, value).map((row) => row.asin), ["B0STRAT001"]);
  assert.deepEqual(filterRowsBySearch(ROWS, "1249.50", COLUMNS, value).map((row) => row.asin), ["B0JAZZ0003"]);
});

test("search does not match fields the table does not show", () => {
  assert.doesNotMatch(rowSearchText(ROWS[0], COLUMNS, value), /hidden/);
  assert.deepEqual(filterRowsBySearch(ROWS, "hidden", COLUMNS, value), []);
});

test("search text is cached per row object", () => {
  const cache = new WeakMap<object, string>();
  let calls = 0;
  const counted = (row: Row, id: string) => {
    calls += 1;
    return value(row, id);
  };
  filterRowsBySearch(ROWS, "player", COLUMNS, counted, cache);
  const first = calls;
  filterRowsBySearch(ROWS, "jazz", COLUMNS, counted, cache);
  assert.equal(calls, first);
});

test("sort and search sentences for the download", () => {
  const columns = [
    { id: "listing", name: "Listing", sort: "text" as const },
    { id: "map", name: "MAP", sort: "number" as const },
    { id: "checked", name: "Checked", sort: "date" as const },
    { id: "setaside", name: "Status" },
  ];
  assert.equal(describeTableSort(null, columns), null);
  assert.equal(describeTableSort({ columnId: "map", direction: "desc" }, columns), "MAP, highest first");
  assert.equal(describeTableSort({ columnId: "listing", direction: "asc" }, columns), "Listing, A to Z");
  assert.equal(describeTableSort({ columnId: "checked", direction: "desc" }, columns), "Checked, newest first");
  assert.equal(describeTableSort({ columnId: "setaside", direction: "asc" }, columns), null);
  assert.equal(describeTableSearch("  strat  "), 'Search "strat".');
  assert.equal(describeTableSearch(" "), null);
});

test("row keys come from the ASIN or page address, and from React's key form", () => {
  assert.deepEqual(orderedRowKeys(ROWS), ["B0STRAT001", "B0TELE0002", "B0JAZZ0003"]);
  assert.deepEqual(orderedRowKeys([{ url: "https://www.fender.com/a" }]), ["https://www.fender.com/a"]);
  assert.equal(orderedRowKeys([{ asin: "B0X" }, { name: "no key" }]), null);
  assert.equal(sourceRowKey(".$B0STRAT001"), "B0STRAT001");
  assert.equal(sourceRowKey(".0:$B0STRAT001"), "B0STRAT001");
  assert.equal(sourceRowKey(".$https=2//x.com/a=0b"), "https://x.com/a=b");
  assert.equal(sourceRowKey("#3"), "#3");
});

const SOURCE: ExportSource = {
  table: "map-listings",
  header: ["Listing", "ASIN", "MAP"],
  rows: ROWS.map((row) => ({ key: row.asin, cells: [row.title, row.asin, `$${row.map}`] })),
  filter: "Priced below MAP.",
  sort: "Worst leakage, lowest first.",
  population: "3 of 10 listings are priced below MAP",
  asOf: "Nov 9, 2026, 5:58 PM UTC",
  setAsideCheck: "map_pricing",
};

test("download keeps the rows on screen in screen order with the four facts first", () => {
  const csv = shownCsv(
    SOURCE,
    parseShownRequest({ keys: ["B0JAZZ0003", "MISSING", "B0STRAT001"], search: "player", sort: "MAP, highest first" }),
    new Map([["B0JAZZ0003", "Done"]]),
  );
  const lines = csv.trim().split("\n");
  assert.deepEqual(lines.slice(0, 4), [
    'Filter,"Priced below MAP. Search ""player""."',
    'Sort,"MAP, highest first."',
    'As of,"Nov 9, 2026, 5:58 PM UTC"',
    "Population,3 of 10 listings are priced below MAP. This file holds 2 of 3 rows.",
  ]);
  assert.equal(lines[4], "Listing,ASIN,MAP,Status");
  assert.equal(lines[5], "Jazz Bass,B0JAZZ0003,$1249.5,Done");
  assert.equal(lines[6], "Player Stratocaster,B0STRAT001,$2999.99,");
  assert.equal(lines.length, 7);
});

test("download with no keys is every row in read order; a view filter is named", () => {
  const all = shownCsv(SOURCE, parseShownRequest({ keys: null }), null).trim().split("\n");
  assert.equal(all[0], "Filter,Priced below MAP.");
  assert.equal(all[1], 'Sort,"Worst leakage, lowest first."');
  assert.equal(all.length, 4 + 1 + 3);
  const narrowed = shownCsv({ ...SOURCE, filter: null }, parseShownRequest({ keys: ["B0TELE0002"] }), null);
  assert.match(narrowed, /^Filter,Filtered on screen\.$/m);
  const labeled = shownCsv(
    { ...SOURCE, filter: null },
    parseShownRequest({ keys: ["B0TELE0002"], filter: "Line: Electric guitars" }),
    null,
  );
  assert.match(labeled, /^Filter,Line: Electric guitars\.$/m);
});

test("a failed set-aside read marks the Status column Not available*", () => {
  const csv = shownCsv(SOURCE, parseShownRequest({ keys: ["B0TELE0002"] }), "failed");
  assert.match(csv, /^Status,Not available\*\. The Done and set-aside read failed\.$/m);
  assert.match(csv, /^Player Telecaster,B0TELE0002,\$899,Not available\*$/m);
});

test("malformed bodies fall back to every row", () => {
  assert.deepEqual(parseShownRequest(null), { keys: null, search: "", sort: null, filter: null, scope: null });
  assert.deepEqual(parseShownRequest({ keys: [1, "B0X"], search: 4 }).keys, ["B0X"]);
});

test("export table ids, hrefs, and file names", () => {
  assert.ok(isExportTable("map-listings"));
  assert.ok(isExportTable("ai-simulations"), "the AI Search tables have server loaders");
  assert.ok(!isExportTable("no-such-table"));
  assert.equal(exportHref("map-listings", "fender"), "/dashboard/export/map-listings");
  assert.equal(exportHref("map-listings", "ledlenser"), "/dashboard/export/map-listings?client=ledlenser");
  assert.equal(exportFileName("stock-loss", new Date("2026-11-09T12:00:00Z")), "stock-loss-2026-11-09.csv");
  const loader = readFileSync(new URL("../lib/export/load-table.ts", import.meta.url), "utf8");
  for (const id of EXPORT_TABLE_IDS) assert.match(loader, new RegExp(`"${id}":`), id);
});

test("the export route is POST only, client-scoped, and stashed from the static build", () => {
  const route = readFileSync(new URL("../app/(canvas)/dashboard/export/[table]/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /runWithClient\(client/);
  const stash = readFileSync(new URL("./prepare-static-export.mjs", import.meta.url), "utf8");
  assert.match(stash, /"app\/\(canvas\)\/dashboard\/export"/);
});
