// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/table-usability.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { columnWidthStorageKey, mergeColumnWidths } from "../lib/fender-canvas/retail-column-layout.ts";
import {
  ariaSortValue,
  nextTableSort,
  sortRowsByColumn,
  tableScrollClass,
  unreadCount,
} from "../lib/fender-canvas/table-sort.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(hex.slice(1 + index, 3 + index), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(background: string, ink: string): number {
  const [lighter, darker] = [luminance(background), luminance(ink)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function themeColors(css: string, marker: string): { background: string; color: string } {
  const at = css.indexOf(marker);
  assert.ok(at >= 0, marker);
  const body = css.slice(at, at + 500);
  const background = body.match(/background-color:\s*(#[0-9a-fA-F]{6})/)?.[1];
  const color = body.match(/[^-\w]color:\s*(#[0-9a-fA-F]{6})/)?.[1];
  assert.ok(background && color, marker);
  return { background, color };
}

test("the Suppressed Listings header freezes inside its own scroll area", () => {
  const panel = read("components/v3/live/SuppressedListingsPanel.tsx");
  assert.match(panel, /tableId="suppressed-listings"/);
  assert.match(panel, /freezeHeader/);
  assert.match(panel, /maxHeight=\{520\}/);
  assert.equal(tableScrollClass(true), "table-scroll table-freeze-head");
  assert.match(read("components/v3/live/ResizableTable.tsx"), /tableScrollClass\(freezeHeader\)/);
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.match(css, /\.table-freeze-head \.resizable-th \{[^}]*position:\s*sticky[^}]*top:\s*0/s);
});

test("a missing price sorts as missing rather than zero", () => {
  const rows = [
    { id: "missing", price: null as number | null },
    { id: "zero", price: 0 },
    { id: "ten", price: 10 },
    { id: "two", price: 2 },
  ];
  const asc = sortRowsByColumn(rows, "number", "asc", (row) => row.price).map((row) => row.id);
  const desc = sortRowsByColumn(rows, "number", "desc", (row) => row.price).map((row) => row.id);
  assert.deepEqual(asc, ["zero", "two", "ten", "missing"]);
  assert.deepEqual(desc, ["ten", "two", "zero", "missing"]);
  assert.equal(unreadCount(0), null);
  const reviews = sortRowsByColumn(
    [
      { id: "unread", reviews: 0 },
      { id: "three", reviews: 3 },
      { id: "two", reviews: 2 },
    ],
    "number",
    "asc",
    (row) => unreadCount(row.reviews),
  ).map((row) => row.id);
  assert.deepEqual(reviews, ["two", "three", "unread"]);
});

test("a numeric column sorts by value", () => {
  const amounts = sortRowsByColumn(
    [
      { id: "ten", amount: 10 },
      { id: "two", amount: 2 },
      { id: "nine", amount: 9.5 },
    ],
    "number",
    "asc",
    (row) => row.amount,
  ).map((row) => row.id);
  assert.deepEqual(amounts, ["two", "nine", "ten"]);

  const dates = sortRowsByColumn(
    [
      { id: "aug", at: "August 1, 2024" },
      { id: "jan", at: "January 1, 2024" },
      { id: "missing", at: null as string | null },
    ],
    "date",
    "asc",
    (row) => row.at,
  ).map((row) => row.id);
  assert.deepEqual(dates, ["jan", "aug", "missing"]);
});

test("sort direction is visible to assistive tech and toggles", () => {
  assert.equal(ariaSortValue(null, "offer"), "none");
  const asc = nextTableSort(null, "offer");
  assert.equal(asc.direction, "asc");
  assert.equal(ariaSortValue(asc, "offer"), "ascending");
  const desc = nextTableSort(asc, "offer");
  assert.equal(desc.direction, "desc");
  assert.equal(ariaSortValue(desc, "offer"), "descending");
  const resize = read("components/v3/live/ResizableTable.tsx");
  assert.match(resize, /aria-sort=\{column\.sort \? ariaSortValue/);
  assert.match(resize, /data-sort-dir=/);
  assert.match(resize, /ArrowLeft/);
  assert.match(resize, /ArrowRight/);
  assert.match(resize, /ifai-sort-chevron/);
  assert.match(resize, /retail-explore-chevron/);
  assert.doesNotMatch(resize, /[↑↓]/);
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.match(css, /\.ifai-sort-btn\[data-sort-dir="asc"\] \.ifai-sort-chevron/);
  assert.match(css, /\.ifai-sort-btn\[data-sort-dir="desc"\] \.ifai-sort-chevron/);
  assert.doesNotMatch(css, /\.ifai-sort-btn\[data-sort-dir="asc"\]::after/);
  assert.doesNotMatch(css, /content:\s*" ↑"/);
});

test("Suppressed Listings omits constant Buy Box and Source columns", () => {
  const row = read("components/v3/live/FeaturedOfferRow.tsx");
  assert.match(row, /SUPPRESSED_LISTINGS_TABLE_COLUMNS/);
  assert.doesNotMatch(row, /id: "state"/);
  assert.doesNotMatch(row, /id: "source"/);
  assert.doesNotMatch(row, /name: "Buy Box"/);
  assert.doesNotMatch(row, /showBuyBox|showSource|FEATURED_OFFER_TABLE_COLUMNS/);
  const panel = read("components/v3/live/SuppressedListingsPanel.tsx");
  assert.match(panel, /SUPPRESSED_LISTINGS_TABLE_COLUMNS/);
  assert.doesNotMatch(panel, /showBuyBox|showSource/);
  assert.doesNotMatch(panel, /FEATURED_OFFER_TABLE_COLUMNS/);
  assert.doesNotMatch(panel, /columnId === "source"/);
  assert.match(panel, /Amazon listing read/);
});

test("simulation dropdowns keep contrast in dark mode and in light mode", () => {
  const filters = read("components/v3/live/ai-search/SimulationFilters.tsx");
  assert.doesNotMatch(filters, /<select[\s\S]*?style=\{/);
  assert.doesNotMatch(filters, /selectStyle/);
  for (const label of ["Engine", "Model", "Category", "Outcome", "Fact-check result"]) {
    assert.match(filters, new RegExp(`aria-label="${label}"`));
  }
  const css = read("lib/canvas-sdk/iom-theme.css");
  for (const marker of ["sim-filter-dark", "sim-filter-light"]) {
    const colors = themeColors(css, marker);
    const ratio = contrast(colors.background, colors.color);
    assert.ok(ratio >= 4.5, `${marker} contrast ${ratio.toFixed(2)} for ${colors.color} on ${colors.background}`);
    const rule = css.slice(css.indexOf(marker), css.indexOf(marker) + 500);
    assert.match(rule, /select option/);
    assert.match(rule, /\bselect,/);
  }
});

test("resized widths stay on their own table", () => {
  assert.notEqual(columnWidthStorageKey("ai-simulations"), columnWidthStorageKey("suppressed-listings"));
  assert.notEqual(columnWidthStorageKey("product-fact-checks"), columnWidthStorageKey("spec-readiness"));
  assert.notEqual(columnWidthStorageKey("map-listings"), columnWidthStorageKey("explore-listings"));
  const stored = { prompt: 320, offer: 180 };
  const simulations = mergeColumnWidths([{ id: "prompt", width: 280, minWidth: 160 }], stored);
  const suppressed = mergeColumnWidths([{ id: "offer", width: 130, minWidth: 100 }], stored);
  assert.equal(simulations.prompt, 320);
  assert.equal("offer" in simulations, false);
  assert.equal(suppressed.offer, 180);
  assert.equal("prompt" in suppressed, false);
});

test("TSX files in this pass stay at or under 400 lines", () => {
  const files = [
    "components/v3/build-live-spokes.tsx",
    "components/v3/live/CatalogGovernancePanel.tsx",
    "components/v3/live/CatalogReadinessSpec.tsx",
    "components/v3/live/FeaturedOfferRow.tsx",
    "components/v3/live/FenderListingsTable.tsx",
    "components/v3/live/FenderSpecPanel.tsx",
    "components/v3/live/MapChannelPanel.tsx",
    "components/v3/live/MapListingsTable.tsx",
    "components/v3/live/ResizableTable.tsx",
    "components/v3/live/MachineReadabilityPageTable.tsx",
    "components/v3/live/MachineReadabilityPanel.tsx",
    "components/v3/live/AplusMatrixPanel.tsx",
    "components/v3/live/ListingContentTable.tsx",
    "components/v3/live/ShareHeroCard.tsx",
    "components/v3/live/SuppressedListingsPanel.tsx",
    "components/v3/live/useFullPopulationSort.ts",
    "components/v3/live/ai-search/CategoryBattlecardsPanel.tsx",
    "components/v3/live/ai-search/CitationEcosystemPanel.tsx",
    "components/v3/live/ai-search/CitationEvidenceTable.tsx",
    "components/v3/live/ai-search/CompetitorWinsPanel.tsx",
    "components/v3/live/ai-search/EngineComparisonLead.tsx",
    "components/v3/live/ai-search/EngineComparisonPanel.tsx",
    "components/v3/live/ai-search/EngineUnbrandedGraph.tsx",
    "components/v3/live/ai-search/FactCheckTable.tsx",
    "components/v3/live/ai-search/RunSummaryPanel.tsx",
    "components/v3/live/ai-search/SimulationFilters.tsx",
    "components/v3/live/ai-search/SimulationsExplorer.tsx",
  ];
  for (const path of files) {
    // Match wc -l: a trailing newline does not count as an extra blank line.
    const lines = read(path).replace(/\n$/, "").split("\n").length;
    assert.ok(lines <= 400, `${path} is ${lines} lines`);
  }
});
