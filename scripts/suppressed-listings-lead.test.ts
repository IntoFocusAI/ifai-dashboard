// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/suppressed-listings-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { formatPct, formatRatio } from "../lib/fender-canvas/format.ts";
import {
  mapLeakageFinding,
  selectRetailHeadline,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailSnapshot,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { buyBoxHero } from "../lib/fender-canvas/retail-overview-lead.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function suppression(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return {
    asin: "B0EQ000000",
    offer_price: 949.99,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 84999,
    featured_offer_observed_price_cents: 94999,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
    ...overrides,
  };
}

function present(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return suppression({
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_observed_price_cents: 84999,
    featured_offer_observed_seller: "ATVPDKIKX0DER",
    ...overrides,
  });
}

function notChecked(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return suppression({
    featured_offer_state: null,
    featured_offer_withheld: null,
    featured_offer_source: null,
    featured_offer_checked_at: null,
    featured_offer_attempted_at: null,
    competitive_external_price_state: null,
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
    ...overrides,
  });
}

function mapRow(overrides: Partial<MapLeakageRow> = {}): MapLeakageRow {
  return {
    map_price: 100,
    offer_price: 80,
    amz_leakage: -20,
    wmt_leakage: null,
    mf_leakage: null,
    ...overrides,
  };
}

function bundle(overrides: Partial<CatalogBundleRow> & Pick<CatalogBundleRow, "asin">): CatalogBundleRow {
  return {
    model_name: "Player II Stratocaster",
    title: "Fender Player II Stratocaster",
    bundle_name: "Starter kit",
    parent_asin: null,
    product_url: "https://www.amazon.com/dp/B0D8TFXHHT",
    is_bundle: true,
    featured_offer_state: "present",
    ...overrides,
  };
}

function snapshot(overrides: Partial<PortfolioRetailSnapshot> = {}): PortfolioRetailSnapshot {
  const findings = {
    suppressedListings: suppressedListingsFinding([present()]),
    mapLeakage: mapLeakageFinding([mapRow({ amz_leakage: 0, offer_price: 100 })]),
    unnestedBundles: unnestedBundlesFinding([
      bundle({ asin: "B000000001", parent_asin: "B0000000ZZ" }),
    ]),
    amazonSpecGaps: {
      status: "unavailable" as const,
      issueCount: null,
      missingMessage: "Amazon spec-field readings have not been stored.",
      detail: null,
    },
  };
  const merged = { ...findings, ...overrides };
  return { ...merged, headline: selectRetailHeadline(merged) };
}

test("ready snapshot lead strings equal buyBoxHero percent and ratio", () => {
  const reading = suppressedListingsFinding([
    suppression(),
    present(),
    present(),
    notChecked(),
  ]);
  assert.equal(reading.detail?.counts.withheld, 1);
  assert.equal(reading.detail?.counts.current, 3);

  const snap = snapshot({ suppressedListings: reading });
  const hero = buyBoxHero(snap);

  assert.equal(hero.percent, formatPct(100 / 3));
  assert.equal(hero.ratio, formatRatio(1, 3));
  assert.equal(hero.percent, buyBoxHero(snap).percent);
  assert.equal(hero.ratio, buyBoxHero(snap).ratio);
  assert.notEqual(hero.percent, "Not available*");
  assert.notEqual(hero.percent, formatPct(0));
  assert.doesNotMatch(hero.percent, /^0/);
});

test("missing Buy Box reading shows Not available* without a zero share", () => {
  const snap = snapshot({
    suppressedListings: suppressedListingsFinding(null),
  });
  const hero = buyBoxHero(snap);
  assert.equal(hero.percent, "Not available*");
  assert.equal(hero.ratio, null);
  assert.equal(hero.pie, null);
  assert.doesNotMatch(hero.percent, /^0/);
});

test("Suppressed Listings places one callout body beside the share", () => {
  const panel = read("components/v3/live/SuppressedListingsPanel.tsx");

  assert.match(panel, /buyBoxHero/);
  assert.match(panel, /data-suppressed-listings-lead/);
  assert.match(panel, /data-suppressed-listings-notes/);
  assert.match(panel, /data-suppressed-listings-top/);
  assert.match(panel, /data-suppressed-listings-table/);
  assert.match(panel, /RetailShareDisc/);
  assert.match(read("components/v3/live/RetailOverviewFigure.tsx"), /citation-pie-disc citation-pie-disc-retail/);
  assert.match(panel, /hero\.label/);
  assert.match(panel, /hero\.percent/);
  assert.match(panel, /hero\.ratio/);
  assert.match(panel, /hero\.tip/);
  assert.match(panel, /hero\.explainer/);
  assert.match(panel, /width:\s*"fit-content"/);
  assert.match(panel, /Why can a listing lose the Buy Box\?/);
  assert.match(panel, /confirmedSuppressionSentence/);
  assert.match(panel, /benchmarkCoverageSentence/);
  assert.match(panel, /featuredOfferFreshnessSentence/);
  assert.match(
    panel,
    /The observed offer and the Competitive External Price come from the same Amazon/,
  );

  const topAt = panel.indexOf("data-suppressed-listings-top");
  const leadAt = panel.indexOf("<SuppressedListingsLead");
  const notesAt = panel.indexOf("<SuppressedListingsNotes");
  const tableAt = panel.indexOf("data-suppressed-listings-table");
  assert.ok(topAt >= 0 && leadAt > topAt && notesAt > leadAt, "notes sit with the lead in one row");
  assert.ok(tableAt > notesAt, "listings table stays under the share-and-notes row");

  assert.match(panel, /className="ceo-callout"/);
  assert.match(panel, /className="ceo-callout-body"/);
  assert.equal(
    (panel.match(/className="ceo-callout-body"/g) ?? []).length,
    1,
    "one callout body holds the why text and reading sentences",
  );
  assert.match(panel, /\.join\(" "\)/);
  assert.doesNotMatch(
    panel,
    /retail-missing">\{confirmedSuppressionSentence|retail-missing">\{benchmarkCoverageSentence|retail-missing">\s*\{featuredOfferFreshnessSentence/,
  );
  assert.doesNotMatch(panel, /data-suppressed-listings-notes=""[\s\S]*className="content-box"/);
  assert.doesNotMatch(panel, /content-box-title/);
  assert.doesNotMatch(panel, /suppressed-count/);
  assert.doesNotMatch(panel, /<span>Buy Box withheld<\/span>/);
  assert.match(panel, /hero\.label/, "one share label comes from buyBoxHero");

  assert.doesNotMatch(panel, /data-ifai-open=/);
  assert.doesNotMatch(panel, /data-ifai-tab=/);
  assert.doesNotMatch(panel, /\u2014/);
  assert.doesNotMatch(panel, /(?<![\w-])title=\{|(?<![\w-])title="/);

  const lines = panel.split("\n").length;
  assert.ok(lines <= 400, `SuppressedListingsPanel.tsx is ${lines} lines`);
});
