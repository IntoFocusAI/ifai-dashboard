// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/table-header-floors.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  fitResizableColumnWidths,
  mergeColumnWidths,
  withHeaderFloors,
} from "../lib/fender-canvas/retail-column-layout.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");
const flat = (path: string) => read(path).replace(/\s+/g, " ");

/** Category Battlecards: the Errors column was fitted to 87px, which split "ERRORS". */
const battleColumns = [
  { id: "category", width: 160, minWidth: 110 },
  { id: "unbranded_discovery", width: 190, minWidth: 140 },
  { id: "branded_consideration", width: 190, minWidth: 140 },
  { id: "competitor", width: 170, minWidth: 120 },
  { id: "leads", width: 150, minWidth: 110 },
  { id: "leader", width: 110, minWidth: 80 },
  { id: "errors", width: 90, minWidth: 72 },
];

test("a header floor raises the minimum and the default width, never lowers them", () => {
  const floored = withHeaderFloors(battleColumns, { errors: 96.4, leader: 70, competitor: Number.NaN });
  const byId = Object.fromEntries(floored.map((column) => [column.id, column]));
  assert.deepEqual(byId.errors, { id: "errors", width: 97, minWidth: 97 });
  assert.equal(byId.leader, battleColumns[5]);
  assert.equal(byId.competitor, battleColumns[3]);
  assert.equal(byId.category, battleColumns[0]);
  const wide = withHeaderFloors([{ id: "leads", width: 150, minWidth: 110 }], { leads: 120 });
  assert.deepEqual(wide, [{ id: "leads", width: 150, minWidth: 120 }]);
});

test("the fitted Errors column is never narrower than its header word", () => {
  const contentMins = { unbranded_discovery: 180, branded_consideration: 180, competitor: 150, leads: 140, leader: 100, errors: 87 };
  const before = fitResizableColumnWidths(battleColumns, 1100, { contentMins });
  assert.equal(before.errors, 87);
  const after = fitResizableColumnWidths(withHeaderFloors(battleColumns, { errors: 97 }), 1100, { contentMins });
  assert.equal(after.errors, 97);
  assert.equal(after.leader, before.leader);
  assert.equal(
    Object.values(after).reduce((sum, width) => sum + width, 0),
    1100,
    "the fill column gives back the extra width",
  );
});

test("a saved width is kept unless it would break the header inside a word", () => {
  const saved = { category: 220, errors: 74, leads: 260 };
  const shown = mergeColumnWidths(withHeaderFloors(battleColumns, { errors: 97, leads: 130 }), saved);
  assert.equal(shown.category, 220);
  assert.equal(shown.leads, 260);
  assert.equal(shown.errors, 97);
  assert.equal(shown.leader, 110);
});

test("ResizableTable floors fit, saved widths, and the drag minimum at the header word", () => {
  const table = flat("components/v3/live/ResizableTable.tsx");
  assert.match(table, /import "@\/components\/v3\/live\/resizable-table\.css";/);
  assert.match(table, /const headerFloors = useHeaderFloors\(tableRef, signature, containerWidth\);/);
  assert.match(table, /const floored = withHeaderFloors\(columns, headerFloors\);/);
  assert.match(table, /manual \? mergeColumnWidths\(floored, widths\) : fitResizableColumnWidths\(floored, containerWidth,/);
  assert.match(table, /\{floored\.map\(\(column\) => \{/);
  assert.match(table, /minWidth=\{column\.minWidth \?\? 72\}/);

  const css = flat("components/v3/live/resizable-table.css");
  assert.match(
    css,
    /\.resizable-table \.resizable-th \.ifai-sort-btn, \.resizable-table \.resizable-th \.resizable-th-label \{ overflow-wrap: normal; word-break: normal; \}/,
  );

  const measure = read("lib/fender-canvas/table-column-measure.ts");
  assert.match(measure, /const root = beside \? \(table\.parentElement \?\? canvas\) : canvas;/);
  assert.match(measure, /withProbeHost\(table, true, \(host\) => \{\s+Array\.from\(header\.cells\)/, "headers use the panel's header font");
  assert.match(measure, /withProbeHost\(table, false, \(host\) => \{\s+let bodySeen/, "body floors keep the canvas font");
  assert.match(measure, /width:1px/);
});
