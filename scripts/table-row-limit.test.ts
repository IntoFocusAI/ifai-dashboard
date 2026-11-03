// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/table-row-limit.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CLIENT_TABLE_PAGE_SIZE } from "../lib/fender-canvas/full-result-sort.ts";
import {
  TABLE_ROW_STEP,
  initialRowLimit,
  nextRowLimit,
  rowsShown,
  sameRowKeys,
} from "../lib/fender-canvas/table-row-limit.ts";

const keys = (n: number, prefix = "r") => Array.from({ length: n }, (_, index) => `${prefix}${index}`);

test("a table opens on its first 25 rows and each Show more adds 25", () => {
  assert.equal(TABLE_ROW_STEP, 25);
  const start = initialRowLimit();
  const all = keys(6628);
  const limit = nextRowLimit(start, all);
  assert.equal(rowsShown(limit, all.length), 25);
  assert.equal(rowsShown(limit + TABLE_ROW_STEP, all.length), 50);
  assert.equal(rowsShown(Number.POSITIVE_INFINITY, all.length), 6628);
  assert.equal(rowsShown(25, 10), 10, "a short table shows every row");
});

test("a new sort or filter opens the table on its first rows again", () => {
  const rows = keys(100);
  const expanded = { limit: 75, keys: rows };
  assert.equal(nextRowLimit(expanded, [...rows].reverse()), 25, "re-sorted");
  assert.equal(nextRowLimit(expanded, rows.filter((_, index) => index % 2 === 0)), 25, "filtered");
  assert.equal(nextRowLimit({ limit: Number.POSITIVE_INFINITY, keys: rows }, keys(100, "x")), 25, "new data");
});

test("the same rows keep the rows the reader opened", () => {
  const rows = keys(100);
  assert.equal(nextRowLimit({ limit: 75, keys: rows }, rows), 75);
  assert.equal(nextRowLimit({ limit: Number.POSITIVE_INFINITY, keys: rows }, rows), Number.POSITIVE_INFINITY);
  // Rows past the visible ones may change without resetting what the reader sees.
  assert.equal(nextRowLimit({ limit: 25, keys: rows }, [...rows.slice(0, 25), ...keys(10, "late")]), 25);
});

test("a loading row followed by the data opens on 25", () => {
  assert.equal(nextRowLimit({ limit: 25, keys: [".0"] }, keys(500)), 25);
  assert.equal(nextRowLimit(initialRowLimit(), keys(500)), 25);
  assert.equal(nextRowLimit({ limit: 25, keys: keys(10) }, keys(5000)), 25, "a short first batch never opens every row");
});

test("a table with its own Show more keeps every row it adds", () => {
  // CitationEvidenceTable passes 25, then 50, then 75 rows of the same order.
  const all = keys(80);
  let state = { limit: 25, keys: all.slice(0, 25) };
  for (const next of [50, 75, 80]) {
    const limit = nextRowLimit(state, all.slice(0, next));
    assert.equal(rowsShown(limit, next), next, `shows all ${next} rows the table asked for`);
    state = { limit, keys: all.slice(0, next) };
  }
  // Its own reset (new sort) passes 25 rows again, and nothing is hidden.
  assert.equal(rowsShown(nextRowLimit(state, [...all].reverse().slice(0, 25)), 25), 25);
});

test("row keys compare by order", () => {
  assert.equal(sameRowKeys(["a", "b"], ["a", "b"]), true);
  assert.equal(sameRowKeys(["a", "b"], ["b", "a"]), false);
  assert.equal(sameRowKeys(["a"], ["a", "b"]), false);
});

test("paged tables page by the same 25 rows, so a page never nests a Show more", () => {
  assert.equal(CLIENT_TABLE_PAGE_SIZE, TABLE_ROW_STEP);
});

test("ResizableTable limits drawn rows once, for every table", () => {
  const table = readFileSync("components/v3/live/ResizableTable.tsx", "utf8");
  assert.match(table, /const rowLimit = useTableRowLimit\(children\);/);
  assert.match(table, /\{rowLimit\.children\}\s*<\/table>/);
  assert.match(table, /<>\s*\{scroller\}\s*\{rowLimit\.footer\}\s*<\/>/);
  assert.ok(table.split("\n").length <= 400, "ResizableTable stays at or under 400 lines");
  const limit = readFileSync("components/v3/live/TableRowLimit.tsx", "utf8");
  assert.match(limit, /Showing \{formatInt\(shown\)\} of \{formatInt\(total\)\} rows/);
  assert.match(limit, /Show \{formatInt\(more\)\} more/);
  assert.match(limit, /Show all \{formatInt\(total\)\}/);
  assert.match(limit, /node\.type === "tbody"/);
  assert.doesNotMatch(limit, /\stitle=|\u2014/);
});
