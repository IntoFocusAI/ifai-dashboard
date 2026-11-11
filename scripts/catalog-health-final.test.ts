// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/catalog-health-final.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isExportTable, stockEpisodesAsin, stockEpisodesTableId, EXPORT_TABLE_IDS } from "../lib/export/tables.ts";
import { sellerTypeDefinition } from "../lib/fender-canvas/authorized-sellers.ts";
import { anyListingReviewCount } from "../lib/fender-canvas/listing-reviews.ts";
import {
  channelPriceLookup,
  exploreChannelColumns,
  shownChannelGap,
  type ChannelSourceRow,
} from "../lib/fender-canvas/map-channels.ts";
import { heroFigureColor, heroFigureTone } from "../lib/fender-canvas/retail-overview-lead.ts";
import {
  awaitingInputsBreakdown,
  EPISODE_COLUMNS,
  episodeEndLabel,
  episodeKey,
} from "../lib/fender-canvas/stock-loss.ts";
import { CLIENTS } from "../lib/client/active-client.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* Worker 24.3: Catalog Health in its final form for both clients. */

function listing(asin: string, overrides: Partial<ChannelSourceRow> = {}): ChannelSourceRow {
  return {
    asin,
    model_name: asin,
    title: null,
    map_price: 100,
    offer_price: 90,
    amz_leakage: -10,
    worst_leakage: -10,
    wmt_price: null,
    wmt_leakage: null,
    wmt_url: null,
    ...overrides,
  };
}

test("R-02: each seller type has a neutral definition and its Controlled Buy Box rule", () => {
  for (const client of Object.values(CLIENTS)) {
    const definition = sellerTypeDefinition(client.sellerModel);
    assert.ok(definition, `${client.sellerModel} has a definition`);
    assert.match(definition, /counts as controlled/);
    assert.doesNotMatch(definition, /better|worse|inferior|weaker|stronger/i);
  }
  assert.match(sellerTypeDefinition("Partner-led") ?? "", /Amazon Retail or an authorized partner/);
  assert.match(sellerTypeDefinition("Brand-led") ?? "", /the brand's own seller account/);
  assert.equal(sellerTypeDefinition("Hybrid"), null);
  const overview = read("components/v3/live/RetailOverview.tsx");
  assert.match(overview, /data-seller-type=\{RETAIL_SELLER_TYPE\}/);
});

test("a missing share carries no status color, mark, or word", () => {
  const ready = { numerator: 3, denominator: 10, tone: "danger" as const, color: "var(--danger-red)" };
  const missing = { numerator: null, denominator: null, tone: "warning" as const, color: "var(--warning-amber)" };
  assert.equal(heroFigureTone(ready), "danger");
  assert.equal(heroFigureColor(ready), "var(--danger-red)");
  assert.equal(heroFigureTone(missing), null);
  assert.equal(heroFigureColor(missing), "var(--text-muted)");
});

test("X-34: Catalog Health leads use the status mark and the chart tokens, not the red and green pie", () => {
  const figure = read("components/v3/live/RetailOverviewFigure.tsx");
  assert.match(figure, /CHART_COLORS\.measured/);
  assert.match(figure, /CHART_COLORS\.rest/);
  assert.match(figure, /StatusMark/);
  for (const file of [
    "components/v3/live/RetailOverviewLead.tsx",
    "components/v3/live/SuppressedListingsPanel.tsx",
    "components/v3/live/MapChannelPanel.tsx",
    "components/v3/live/CatalogGovernancePanel.tsx",
    "components/v3/live/StockLossHero.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /RetailShareDisc/, file);
    assert.doesNotMatch(source, /CitationPieDisc/, file);
  }
  for (const file of [
    "components/v3/live/RetailOverviewLead.tsx",
    "components/v3/live/SuppressedListingsPanel.tsx",
    "components/v3/live/MapChannelPanel.tsx",
    "components/v3/live/CatalogGovernancePanel.tsx",
  ]) {
    assert.match(read(file), /RetailStatusMark tone=\{heroFigureTone\(hero\)\}/, file);
  }
});

test("X-27: no Catalog Health file sets a weight above 600", () => {
  for (const file of [
    "components/v3/live/FeaturedOfferRow.tsx",
    "components/v3/live/ChannelPriceCell.tsx",
    "components/v3/live/MapExposureCard.tsx",
    "components/v3/live/catalog-health.css",
  ]) {
    assert.doesNotMatch(read(file), /font-?[wW]eight:\s*["']?(700|800|900|bold)/, file);
  }
});

test("Catalog Health uses the custom tooltip, never a native title", () => {
  const bareTitle = /(?<![\w-])title=\{|(?<![\w-])title="/;
  for (const file of [
    "components/v3/live/SourceTag.tsx",
    "components/v3/live/SetAsideTable.tsx",
    "components/v3/live/StockLossPanel.tsx",
    "components/v3/live/MapListingsTable.tsx",
    "components/v3/live/MapExposureCard.tsx",
  ]) {
    assert.doesNotMatch(read(file), bareTitle, file);
  }
});

test("X-33: the Status column sorts where the table reads the set-aside overlay", () => {
  const setAside = read("components/v3/live/SetAsideTable.tsx");
  assert.match(setAside, /export const SET_ASIDE_SORT_COLUMN: RetailColumn = \{ \.\.\.SET_ASIDE_COLUMN, sort: "text" \}/);
  assert.match(setAside, /export function setAsideSortValue/);
  for (const file of ["components/v3/live/MapListingsTable.tsx", "components/v3/live/SuppressedListingsPanel.tsx"]) {
    const source = read(file);
    assert.match(source, /SET_ASIDE_SORT_COLUMN/, file);
    assert.match(source, /setAsideSortValue\(setAsides/, file);
  }
});

test("X-33: tables that wrap their sort handler hand the toolbar its controls", () => {
  for (const file of [
    "components/v3/live/CatalogGovernanceBundleTable.tsx",
    "components/v3/live/CatalogGovernanceSpecTable.tsx",
  ]) {
    assert.match(read(file), /controls=\{sorted\.controls\}/, file);
  }
});

test("X-33 / X-10: the dated stretches under an Out of Stock row are a table with its own CSV", () => {
  const detail = read("components/v3/live/StockLossDetail.tsx");
  assert.match(detail, /<ResizableTable/);
  assert.match(detail, /stockEpisodesTableId\(asin\)/);
  assert.doesNotMatch(detail, /<table className="stock-episodes"/);
  assert.deepEqual(
    EPISODE_COLUMNS.map((column) => [column.name, column.sort]),
    [
      ["What happened", "text"],
      ["Started", "date"],
      ["Ended", "date"],
      ["Days", "number"],
    ],
  );
  assert.equal(stockEpisodesTableId("B0F3YZSSCL"), "stock-episodes-B0F3YZSSCL");
  assert.equal(stockEpisodesAsin("stock-episodes-B0F3YZSSCL"), "B0F3YZSSCL");
  assert.equal(stockEpisodesAsin("stock-episodes-not an asin"), null);
  assert.equal(stockEpisodesAsin("stock-loss"), null);
  assert.ok(isExportTable("stock-episodes-B0F3YZSSCL"));
  assert.ok(!isExportTable("stock-episodes-"));
  assert.equal(episodeKey({ state: "out_of_stock", start_day: "2026-10-13" }), "out_of_stock-2026-10-13");
  assert.equal(episodeEndLabel({ ongoing: true, end_day: "2026-11-05" }), "Still going");
  assert.equal(episodeEndLabel({ ongoing: false, end_day: "2026-11-05" }), "Nov 5, 2026");
  const loader = read("lib/export/load-table.ts");
  assert.match(loader, /stockEpisodesAsin\(table\)/);
  assert.match(loader, /loadStockEpisodesSource\(asin\)/);
});

test("X-33 / X-10: Explore all listings has a server CSV", () => {
  assert.ok((EXPORT_TABLE_IDS as readonly string[]).includes("explore-listings"));
  const table = read("components/v3/live/FenderListingsTable.tsx");
  assert.match(table, /tableId="explore-listings"/);
  assert.match(table, /filterLabel=\{filterLabel\(filter\)\}/);
  const loader = read("lib/export/explore-listings-export.ts");
  assert.match(loader, /exploreChannelColumns/);
  assert.match(loader, /anyListingReviewCount/);
});

test("a retailer column appears only when the client stores a price for it", () => {
  const prices = channelPriceLookup([
    { asin: "B000000002", channel: "sweetwater", price: 80, url: null, checked_at: null },
  ]);
  // Ledlenser shape: Amazon and Walmart, and no Musician's Friend fields at all.
  const ledlenser = [listing("B000000001", { wmt_price: 95, wmt_leakage: -5 }), listing("B000000002")];
  assert.deepEqual(
    exploreChannelColumns(ledlenser, prices).map((column) => column.key),
    ["amazon", "walmart", "sweetwater"],
  );
  // Fender shape: one Musician's Friend price brings the column.
  const fender = [listing("B000000001", { mf_price: 100, mf_leakage: 0 })];
  assert.deepEqual(
    exploreChannelColumns(fender, new Map()).map((column) => column.name),
    ["Amazon", "Musician's Friend"],
  );
  assert.deepEqual(exploreChannelColumns([], new Map()), []);
});

test("the Reviews column waits for a stored review count", () => {
  assert.equal(anyListingReviewCount([{ reviews_count: 0 }, { reviews_count: null }, {}]), false);
  assert.equal(anyListingReviewCount([{ reviews_count: 0 }, { reviews_count: 12 }]), true);
  const table = read("components/v3/live/FenderListingsTable.tsx");
  assert.match(table, /showReviews \? <td>/);
});

test("let the data speak: what a figure is not lives in a tooltip on Catalog Health", () => {
  const onScreen = [
    read("components/v3/live/StockLossPanel.tsx"),
    read("components/v3/live/SuppressedListingsPanel.tsx"),
    read("components/v3/live/FeaturedOfferReadings.tsx"),
    read("lib/fender-canvas/catalog-governance-copy.ts").replace(/\/\*\*[\s\S]*?\*\//g, ""),
  ].join("\n");
  for (const phrase of [
    "not reported sales",
    "not which seller ran out",
    "not $0",
    "not a gap of zero",
    "not a confirmed price problem",
    "not counted as present",
    "not the full catalog",
    "not a failed check",
  ]) {
    assert.equal(onScreen.includes(phrase), false, phrase);
  }
  const copy = read("lib/fender-canvas/featured-offer-copy.ts");
  assert.match(copy, /BENCHMARK_UNPUBLISHED_TIP/);
  assert.match(copy, /NO_COMPARABLE_PAIR_TIP/);
  assert.match(copy, /COVERAGE_EXCEPTIONS_TIP/);
  const hero = read("components/v3/live/StockLossHero.tsx");
  assert.match(hero, /It is an analyst estimate, not reported sales\./);
});

test("X-18: the tab reads MAP Leakage and the figure reads Splintered Listings", () => {
  const retail = read("lib/fender-canvas/portfolio-retail.ts");
  assert.match(retail, /map_leakage: "MAP Leakage"/);
  const url = read("lib/canvas-sdk/canvas-url-state.ts");
  assert.match(url, /map: "map-leakage"/);
  const governance = read("components/v3/live/CatalogGovernancePanel.tsx");
  assert.match(governance, /SPLINTERED_LISTINGS_LABEL = "Splintered Listings"/);
  assert.doesNotMatch(governance, /Splintered listings/);
});

test("every Catalog Health TSX file stays at or under 400 lines", () => {
  for (const file of [
    "CatalogGovernanceBundleTable",
    "CatalogGovernancePanel",
    "CatalogGovernanceSpecTable",
    "FeaturedOfferReadings",
    "FeaturedOfferRow",
    "FenderListingsTable",
    "MapChannelPanel",
    "MapExposureCard",
    "MapListingsTable",
    "RetailOverview",
    "RetailOverviewFigure",
    "RetailOverviewLead",
    "SetAsideTable",
    "StockLossDetail",
    "StockLossHero",
    "StockLossPanel",
    "SuppressedListingsPanel",
  ]) {
    const lines = read(`components/v3/live/${file}.tsx`).split("\n").length;
    assert.ok(lines <= 400, `${file}.tsx is ${lines} lines`);
  }
});

/* PM24 review, 10 Nov 2026. */

test("at 1280 wide every Catalog Health table is fitted, and listing names clamp to two lines", () => {
  for (const file of [
    "components/v3/live/MapListingsTable.tsx",
    "components/v3/live/StockLossPanel.tsx",
    "components/v3/live/FenderListingsTable.tsx",
    "components/v3/live/SuppressedListingsPanel.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /wrapColumnIds=\{wrapColumnIdsAfterFirst\(/, file);
    assert.match(source, /RETAIL_FIT_TABLE/, file);
  }
  for (const file of [
    "components/v3/live/MapListingsTable.tsx",
    "components/v3/live/StockLossPanel.tsx",
    "components/v3/live/FenderListingsTable.tsx",
    "components/v3/live/FeaturedOfferRow.tsx",
    "components/v3/live/CatalogGovernanceBundleTable.tsx",
    "components/v3/live/CatalogGovernanceSpecTable.tsx",
  ]) {
    assert.match(read(file), /<ListingName name=/, file);
  }
  const css = read("components/v3/live/catalog-health.css");
  assert.match(css, /\.listing-name \{[^}]*-webkit-line-clamp: 2/s);
  assert.match(css, /\.retail-fit \.sourced-label \{[^}]*flex-direction: column/s);
  assert.doesNotMatch(read("components/v3/live/MapListingsTable.tsx"), /listing-title-scroll/);
});

test("Out of Stock leads with a partial total labeled analyst estimate (X-25)", () => {
  const hero = read("components/v3/live/StockLossHero.tsx");
  assert.match(hero, /PartialFigureMark partial=\{partial\}/);
  assert.match(hero, /const ANALYST_ESTIMATE = "analyst estimate"/);
  assert.doesNotMatch(hero, />\s*Estimate\s*</);
  const tag = read("components/v3/live/SourceTag.tsx");
  assert.match(tag, /Estimate: "analyst estimate"/);
  assert.match(tag, /data-source=\{source\}/);
});

test("the awaiting-inputs breakdown names each reason and never counts $0", () => {
  type Row = Parameters<typeof awaitingInputsBreakdown>[0][number];
  const row = (overrides: Partial<Row>): Row =>
    ({
      asin: "B000000001",
      revenue_source: null,
      est_lost_revenue_oos_365: null,
      awaiting_inputs_reason: "no_sales_source",
      ...overrides,
    }) as Row;
  const rows = [
    row({ revenue_source: "smartscout", est_lost_revenue_oos_365: 120, awaiting_inputs_reason: null }),
    row({}),
    row({}),
    row({ awaiting_inputs_reason: "smartscout_reports_no_sales" }),
  ];
  assert.equal(
    awaitingInputsBreakdown(rows),
    "3 of 4 out-of-stock listings have no sales estimate yet, so they are left out of the total. Reasons: 2 with no sales source; 1 where SmartScout reports no sales.",
  );
  assert.equal(awaitingInputsBreakdown(rows.slice(0, 1)), null);
});

test("the AI Commerce card on Retail Overview matches its siblings", () => {
  const panel = read("components/v3/live/CommerceConsensusPanel.tsx");
  assert.match(panel, /retail-finding retail-overview-hero retail-commerce-hero/);
  assert.match(panel, /data-consensus-commerce-hero="commerce"/);
  assert.match(panel, /<RetailStatusMark tone=\{tone\} \/>/);
  assert.match(panel, /<RetailShareDisc pie=\{pie\} measuredKey="matched"/);
  const css = read("components/v3/live/catalog-health.css");
  assert.match(css, /\.retail-overview-hero \.retail-overview-hero-row \{[^}]*flex-wrap: nowrap/s);
});

test("the panel shell sets no native title on the tab strip or the explanation toggle", () => {
  assert.doesNotMatch(read("lib/canvas-sdk/CanvasShell.tsx"), /\(new\)`/);
  assert.doesNotMatch(read("lib/canvas-sdk/panel-interactions.ts"), /toggle\.title\s*=/);
});

/* PM24 review, round 2. */

test("a price exactly at MAP prints alone, on screen and in the CSV", () => {
  assert.equal(shownChannelGap(0), null);
  assert.equal(shownChannelGap(null), null);
  assert.equal(shownChannelGap(undefined), null);
  assert.equal(shownChannelGap(-40), -40);
  assert.equal(shownChannelGap(20), 20);
  for (const file of [
    "components/v3/live/ChannelPriceCell.tsx",
    "lib/export/map-export.ts",
    "lib/export/explore-listings-export.ts",
  ]) {
    assert.match(read(file), /shownChannelGap\(/, file);
  }
});

test("population sentences use plain words, not the internal term retail read", () => {
  for (const file of [
    "lib/export/explore-listings-export.ts",
    "lib/export/map-export.ts",
    "lib/export/stock-episodes-export.ts",
  ]) {
    assert.doesNotMatch(read(file), /population:[^\n]*(retail|sales) read/, file);
  }
  assert.doesNotMatch(read("lib/export/retail-export.ts"), /in the sales read/);
  assert.match(read("lib/fender-canvas/retail-overview-lead.ts"), /"monitored listing" : "monitored listings"/);
  assert.match(read("lib/fender-canvas/portfolio-retail.ts"), /"monitored listing" : "monitored listings"/);
});
