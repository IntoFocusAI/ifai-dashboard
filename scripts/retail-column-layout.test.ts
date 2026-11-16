// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/retail-column-layout.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  MAP_LISTING_COLUMN_MEASURED_WIDTH,
  MAP_LISTING_COLUMN_WIDTH,
  columnWidthStorageKey,
  filledColumnWidths,
  fitResizableColumnWidths,
  mergeColumnWidths,
  pickFillColumnId,
} from "../lib/fender-canvas/retail-column-layout.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const mapColumns = [
  { id: "listing", width: MAP_LISTING_COLUMN_WIDTH, minWidth: 96 },
  { id: "asin", width: 118, minWidth: 108 },
];

const suppressedColumns = [
  { id: "listing", width: 240, minWidth: 140 },
  { id: "offer", width: 120, minWidth: 100 },
];

const runDetailColumns = [
  { id: "prompt", width: 280, minWidth: 160 },
  { id: "outcome", width: 220, minWidth: 140 },
  { id: "engine", width: 120, minWidth: 90 },
  { id: "model", width: 150, minWidth: 100 },
  { id: "category", width: 160, minWidth: 110 },
  { id: "fact", width: 180, minWidth: 120 },
  { id: "cited", width: 110, minWidth: 90 },
  { id: "checked", width: 180, minWidth: 130 },
];

const factCheckColumns = [
  { id: "question", width: 240, minWidth: 140 },
  { id: "engine", width: 140, minWidth: 100 },
  { id: "result", width: 240, minWidth: 160 },
  { id: "fact", width: 260, minWidth: 140 },
  { id: "checked", width: 170, minWidth: 120 },
];

test("the MAP listing default is about 60 percent of the measured column", () => {
  const ratio = MAP_LISTING_COLUMN_WIDTH / MAP_LISTING_COLUMN_MEASURED_WIDTH;
  assert.ok(ratio > 0.55 && ratio < 0.65, `ratio ${ratio}`);
});

test("each table keeps its own stored widths", () => {
  assert.notEqual(columnWidthStorageKey("map-listings"), columnWidthStorageKey("suppressed-listings"));
  assert.notEqual(columnWidthStorageKey("catalog-bundles"), columnWidthStorageKey("catalog-specs"));
  assert.notEqual(columnWidthStorageKey("catalog-bundles"), columnWidthStorageKey("explore-listings"));

  const stored = { listing: 180, asin: 40, extra: 900 };
  const map = mergeColumnWidths(mapColumns, stored);
  const suppressed = mergeColumnWidths(suppressedColumns, stored);
  assert.equal(map.listing, 180);
  assert.equal(map.asin, 108);
  assert.equal("extra" in map, false);
  assert.equal(suppressed.listing, 180);
  assert.equal(suppressed.offer, 120);
  assert.notEqual(map.asin, suppressed.offer);
});

test("a missing or broken store falls back to the defaults", () => {
  assert.deepEqual(mergeColumnWidths(mapColumns, null), {
    listing: MAP_LISTING_COLUMN_WIDTH,
    asin: 118,
  });
  assert.deepEqual(mergeColumnWidths(mapColumns, "nope"), {
    listing: MAP_LISTING_COLUMN_WIDTH,
    asin: 118,
  });
});

test("pickFillColumnId uses the preferred id or the first column", () => {
  assert.equal(pickFillColumnId(runDetailColumns), "prompt");
  assert.equal(pickFillColumnId(factCheckColumns), "question");
  assert.equal(pickFillColumnId(runDetailColumns, "outcome"), "outcome");
  assert.equal(pickFillColumnId(runDetailColumns, "missing"), "prompt");
});

test("fitResizableColumnWidths fills the panel and sizes short columns from content floors", () => {
  const panel = 1109;
  const contentMins = {
    outcome: 222,
    engine: 90,
    model: 100,
    category: 110,
    fact: 120,
    cited: 100,
    checked: 175,
  };
  const widths = fitResizableColumnWidths(runDetailColumns, panel, { contentMins });
  assert.equal(widths.outcome, 222);
  assert.equal(widths.checked, 175);
  // Declared engine width was 120; content floor may shrink it to minWidth.
  assert.equal(widths.engine, 90);
  const others = Object.entries(widths)
    .filter(([id]) => id !== "prompt")
    .reduce((sum, [, width]) => sum + width, 0);
  assert.equal(widths.prompt, panel - others);
  assert.ok(widths.prompt >= 160);
  assert.equal(Object.values(widths).reduce((sum, width) => sum + width, 0), panel);

  const facts = fitResizableColumnWidths(factCheckColumns, 1589, {
    contentMins: {
      engine: 93,
      result: 294,
      fact: 636,
      checked: 175,
    },
  });
  // Question is the fill column; short columns keep one-line floors.
  assert.equal(facts.engine, 100);
  assert.equal(facts.result, 294);
  assert.equal(facts.fact, 636);
  assert.equal(facts.checked, 175);
  assert.equal(facts.question, 1589 - (100 + 294 + 636 + 175));
  assert.ok(facts.question >= 140);
  assert.equal(Object.values(facts).reduce((sum, width) => sum + width, 0), 1589);
});

test("a stored drag wins over the shared fit rule", () => {
  const stored = { prompt: 200, outcome: 180 };
  const widths = fitResizableColumnWidths(runDetailColumns, 1400, {
    stored,
    contentMins: { outcome: 310, checked: 220 },
  });
  assert.equal(widths.prompt, 200);
  assert.equal(widths.outcome, 180);
  assert.equal(widths.checked, 180);
  assert.deepEqual(
    widths,
    filledColumnWidths(runDetailColumns, "prompt", 1400, stored, { outcome: 310 }),
  );
});

test("ResizableTable applies the shared fit rule without a call-site fillColumnId", () => {
  const table = read("components/v3/live/ResizableTable.tsx");
  assert.match(table, /fitResizableColumnWidths/);
  assert.match(table, /measureColumnOneLineMins/);
  assert.match(table, /pickFillColumnId/);
  assert.doesNotMatch(table, /fillColumnId && !manual \? filledColumnWidths/);
  assert.doesNotMatch(read("components/v3/live/ai-search/SimulationsExplorer.tsx"), /fillColumnId=/);
});

/* Worker 27.9: at a 1280 px window with a browser scrollbar, one-line cells made the Run Summary
   engine table and the Category Battlecards table wider than their panel. A row too wide for the
   panel now gives width back toward each column's word floor, so cells wrap instead of scrolling. */
test("a row too wide for the panel shrinks to fit, no column below its floor", () => {
  const battle = [
    { id: "category", width: 160, minWidth: 110 },
    { id: "unbranded", width: 196, minWidth: 150 },
    { id: "branded", width: 196, minWidth: 150 },
    { id: "top", width: 140, minWidth: 100 },
    { id: "leads", width: 140, minWidth: 100 },
    { id: "leader", width: 110, minWidth: 92 },
    { id: "errors", width: 90, minWidth: 89 },
  ];
  const contentMins = { unbranded: 170, branded: 170, top: 135, leads: 148, leader: 102, errors: 89 };
  const wordMins = { unbranded: 60, top: 120 };
  const wide = fitResizableColumnWidths(battle, 1200, { contentMins, wordMins });
  const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
  assert.equal(sum(wide), 1200, "a panel with room is filled, as before");
  assert.equal(wide.unbranded, 170);

  const widths = fitResizableColumnWidths(battle, 880, { contentMins, wordMins });
  assert.equal(sum(widths), 880);
  for (const column of battle) {
    const floor = Math.max(column.minWidth, (wordMins as Record<string, number>)[column.id] ?? 0);
    assert.ok(widths[column.id] >= floor, `${column.id} ${widths[column.id]} >= ${floor}`);
  }
  assert.equal(widths.errors, 89);
  assert.ok(widths.top >= 120);

  // Floors that cannot fit are kept: the table scrolls rather than break a word.
  const tight = fitResizableColumnWidths(battle, 600, { contentMins, wordMins });
  assert.equal(tight.category, 110);
  assert.equal(tight.top, 120);
});

test("a saved width is never shrunk", () => {
  const stored = { prompt: 400, outcome: 400, engine: 400 };
  const widths = fitResizableColumnWidths(runDetailColumns, 600, { stored });
  assert.equal(widths.outcome, 400);
});
