// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/retail-overview-lead.test.ts
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
import {
  buyBoxHero,
  catalogHero,
  mapHero,
  retailOverviewHeroes,
} from "../lib/fender-canvas/retail-overview-lead.ts";

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

test("Buy Box hero is withheld of current readings, not the monitored catalog", () => {
  const reading = suppressedListingsFinding([
    suppression(),
    present(),
    present(),
    notChecked(),
    notChecked(),
  ]);
  assert.equal(reading.detail?.counts.withheld, 1);
  assert.equal(reading.detail?.counts.current, 3);
  assert.equal(reading.detail?.counts.population, 5);

  const hero = buyBoxHero(snapshot({ suppressedListings: reading }));
  assert.equal(hero.numerator, 1);
  assert.equal(hero.denominator, 3);
  assert.equal(hero.percent, formatPct(100 / 3));
  assert.equal(hero.ratio, formatRatio(1, 3));
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 3);
  assert.equal(
    hero.pie.slices.reduce((sum, slice) => sum + slice.count, 0),
    3,
    "unchecked listings must not appear on the Buy Box pie",
  );
  assert.doesNotMatch(hero.tip ?? "", /of 5/);
  assert.doesNotMatch(hero.explainer, /1,049 of 1,089|1049 of 1089|monitored listings/);
  assert.match(hero.explainer, /no one-click offer/i);
});

test("MAP hero is below-MAP of listings with a stored MAP price", () => {
  const reading = mapLeakageFinding([
    mapRow(),
    mapRow({ amz_leakage: 0, offer_price: 100 }),
    mapRow({ amz_leakage: 5, offer_price: 105 }),
    mapRow({ amz_leakage: null, offer_price: 90, map_price: null }),
  ]);
  assert.equal(reading.issueCount, 1);
  assert.equal(reading.detail?.decided, 3);
  assert.equal(reading.detail?.population, 4);

  const hero = mapHero(
    snapshot({
      suppressedListings: suppressedListingsFinding([present()]),
      mapLeakage: reading,
    }),
  );
  assert.equal(hero.numerator, 1);
  assert.equal(hero.denominator, 3);
  assert.equal(hero.percent, formatPct(100 / 3));
  assert.equal(hero.ratio, formatRatio(1, 3));
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 3);
  assert.match(hero.explainer, /below MAP/i);
  assert.doesNotMatch(hero.tip ?? "", /of 4/);
});

test("Catalog hero is unnested of bundles in this read, not catalog bundles", () => {
  const reading = unnestedBundlesFinding(
    [
      bundle({ asin: "B0000000A1", parent_asin: null }),
      bundle({ asin: "B0000000A2", parent_asin: "B0000000ZZ" }),
      bundle({ asin: "B0000000A3", parent_asin: "B0000000YY" }),
    ],
    { catalogBundleCount: 20 },
  );
  assert.equal(reading.issueCount, 1);
  assert.equal(reading.detail?.bundlesInRead, 3);
  assert.equal(reading.detail?.catalogBundles, 20);

  const hero = catalogHero(
    snapshot({
      suppressedListings: suppressedListingsFinding([present()]),
      unnestedBundles: reading,
    }),
  );
  assert.equal(hero.numerator, 1);
  assert.equal(hero.denominator, 3);
  assert.equal(hero.percent, formatPct(100 / 3));
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 3);
  assert.doesNotMatch(hero.explainer, /448 of 946|this read includes/i);
  assert.match(hero.explainer, /reviews stay split/i);
});

test("a missing count shows Not available* and invents no zero", () => {
  const heroes = retailOverviewHeroes(
    snapshot({
      suppressedListings: suppressedListingsFinding(null),
      mapLeakage: mapLeakageFinding(null),
      unnestedBundles: unnestedBundlesFinding(null),
    }),
  );
  assert.equal(heroes.length, 3);
  for (const hero of heroes) {
    assert.equal(hero.percent, "Not available*");
    assert.equal(hero.ratio, null);
    assert.equal(hero.pie, null);
    assert.equal(hero.numerator, null);
  }
});

test("Retail Overview places three heroes before the essay and drops the stacked cards", () => {
  const overview = read("components/v3/live/RetailOverview.tsx");
  const lead = read("components/v3/live/RetailOverviewLead.tsx");
  const commerce = read("components/v3/live/CommerceConsensusPanel.tsx");
  const model = read("lib/fender-canvas/retail-overview-lead.ts");
  const readings = read("components/v3/live/FeaturedOfferReadings.tsx");

  assert.match(overview, /CommerceConsensusPanel/);
  assert.match(overview, /Seller type: \{RETAIL_SELLER_TYPE\}/);
  assert.match(overview, /const RETAIL_SELLER_TYPE = "Partner-led"/);
  assert.match(overview, /authorizedSellerControlOffered\(RETAIL_SELLER_TYPE\)/);
  assert.match(overview, /AuthorizedSellersControl/);
  assert.match(overview, /How do these retail findings change AI search\?/);
  assert.match(overview, /FeaturedOfferReadings/);
  assert.doesNotMatch(overview, /RetailFindingVisual/);
  assert.doesNotMatch(overview, /retail-finding-grid/);

  const heroAt = overview.indexOf("<CommerceConsensusPanel");
  const essayAt = overview.indexOf("How do these retail findings change AI search?");
  assert.ok(heroAt >= 0 && essayAt > heroAt, "essay stays under the heroes");

  // AI Commerce sits in the same band as the three share pies.
  assert.match(commerce, /RetailOverviewLead/);
  assert.match(commerce, /CommerceHeroCard/);
  assert.match(lead, /leading/);
  assert.match(lead, /retailOverviewHeroes/);
  assert.match(lead, /ai-lead-figure/);
  assert.match(lead, /CitationPieDisc/);
  assert.match(lead, /data-ifai-open="ecommerce"/);
  assert.match(lead, /data-ifai-tab=\{hero\.tab\}/);
  assert.match(lead, /retail-overview-heroes/);
  assert.match(model, /Not available\*/);
  assert.match(model, /counts\?\.withheld/);
  assert.match(model, /counts\.current/);
  assert.match(model, /detail\.decided/);
  assert.match(model, /bundlesInRead/);

  assert.doesNotMatch(readings, /confirmedSuppressionSentence/);
  assert.doesNotMatch(readings, /classificationCoverageSentence/);
  assert.match(readings, /benchmarkCoverageSentence/);
  assert.match(readings, /Buy Box readings/);

  assert.doesNotMatch(overview, /\u2014/);
  assert.doesNotMatch(lead, /\u2014/);
  assert.doesNotMatch(model, /\u2014/);
  assert.doesNotMatch(lead, /(?<![\w-])title=\{|(?<![\w-])title="/);
});

test("Suppressed Listings still keeps the withheld-cause sentence", () => {
  const panel = read("components/v3/live/SuppressedListingsPanel.tsx");
  assert.match(panel, /confirmedSuppressionSentence/);
});
