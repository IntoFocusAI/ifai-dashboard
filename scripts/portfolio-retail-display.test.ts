// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/portfolio-retail-display.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";
import {
  catalogBubble,
  catalogHealthMainFace,
  headlineBubble,
  headlineSentence,
  headlineSurface,
  mapBubble,
  RETAIL_PANEL_TABS,
  retailBubbleFaces,
  shortCoverageLine,
  suppressedBubble,
} from "../lib/fender-canvas/portfolio-retail-display.ts";
import { formatPct } from "../lib/fender-canvas/format.ts";
import {
  MAP_PRICES_NOT_STORED,
  mapLeakageFinding,
  RETAIL_FINDING_LABELS,
  selectRetailHeadline,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailFindings,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";

/* Seller-share jargon stays off bubble surfaces. Buy Box is the client purchasing-button
   name. Partner-led belongs on the Retail Overview seller-type line, not these pills. */
const FORBIDDEN = /partner-led|\b1p\b|unknown seller|(?<!no )active offers?\b/i;

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

/** Confirmed withheld above a benchmark from the same observation. */
function suppressed(price = 200): SuppressionSupportRow {
  return {
    asin: "B0EQ000000",
    offer_price: price,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: 20000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

function present(): SuppressionSupportRow {
  return {
    ...suppressed(),
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_observed_price_cents: 9000,
  };
}

function notChecked(): SuppressionSupportRow {
  return {
    ...suppressed(),
    featured_offer_state: null,
    featured_offer_withheld: null,
    featured_offer_source: null,
    featured_offer_checked_at: null,
    featured_offer_attempted_at: null,
    competitive_external_price_state: null,
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
  };
}

function mapRow(leak: number | null): MapLeakageRow {
  return {
    map_price: 100,
    offer_price: 80,
    amz_leakage: leak,
    wmt_leakage: null,
    mf_leakage: null,
  };
}

function bundle(asin: string, parent: string | null): CatalogBundleRow {
  return {
    asin,
    model_name: asin,
    title: null,
    bundle_name: null,
    parent_asin: parent,
    product_url: null,
    is_bundle: true,
    featured_offer_state: "present",
  };
}

function findings(partial: Partial<PortfolioRetailFindings> = {}): PortfolioRetailFindings {
  return {
    suppressedListings: suppressedListingsFinding([suppressed(), notChecked()]),
    mapLeakage: mapLeakageFinding([mapRow(-12.5), mapRow(4)]),
    unnestedBundles: unnestedBundlesFinding([bundle("B000000001", null), bundle("B000000002", "B000000099")]),
    amazonSpecGaps: { status: "unavailable", issueCount: null, missingMessage: "Amazon spec-field readings have not been stored.", detail: null },
    ...partial,
  };
}

function visible(face: {
  title: string;
  stats: string[];
  meta?: string;
  tooltip: { title: string; desc: string };
  heroValue?: { value: string; label: string };
}) {
  return [
    face.title,
    face.meta ?? "",
    face.tooltip.title,
    face.tooltip.desc,
    face.heroValue?.value ?? "",
    face.heroValue?.label ?? "",
    ...face.stats,
  ].join(" ");
}

test("panel tab labels keep the reading slugs", () => {
  assert.deepEqual(RETAIL_PANEL_TABS, [
    "Retail Overview",
    "Suppressed Listings",
    "MAP Leakage",
    "Catalog Governance",
    "Out of Stock",
  ]);
  assert.equal(tabSlug(RETAIL_FINDING_LABELS.suppressed_listings), "suppressed-listings");
  assert.equal(tabSlug(RETAIL_FINDING_LABELS.map_leakage), "map-leakage");
  assert.equal(tabSlug(RETAIL_FINDING_LABELS.unnested_bundles), "catalog-governance");
  assert.equal(tabSlug("Retail Overview"), "retail-overview");
});

test("the headline bubble shows the finding and the issue count only", () => {
  const source = findings();
  const headline = selectRetailHeadline(source);
  const face = headlineBubble(source);
  assert.equal(headline?.label, "Suppressed Listings");
  assert.equal(face.subTab, "Retail Overview");
  assert.equal(source.suppressedListings.issueCount, 1);
  assert.deepEqual(face.stats, ["1 listing withheld above outside price"]);
  assert.equal(face.meta, undefined);
  assert.doesNotMatch(face.stats.join(" "), /\d[\d,]* of \d/);
  // The headline bubble carries its own count; it keeps no hover explainer.
  assert.equal(face.tooltip.title, "");
  assert.equal(face.tooltip.desc, "");
  assert.doesNotMatch(visible(face), /incomplete|unavailable/i);
  assert.doesNotMatch(visible(face), FORBIDDEN);

  const satellite = suppressedBubble(source.suppressedListings);
  // Next-best hero: confirmed high-price share (Catalog Health already leads with Buy Box withheld).
  assert.equal(satellite.heroValue?.label, "confirmed high-price");
  assert.match(satellite.heroValue?.value ?? "", /%/);
  assert.notEqual(satellite.heroValue?.label, face.heroValue?.label ?? "Buy Box withheld");
  assert.equal(satellite.tooltip.desc, "");
  assert.equal(satellite.stats[0], "1 listing");
  assert.ok((satellite.stats.length ?? 0) > 1);
  assert.notEqual(satellite.stats.join(" "), face.stats.join(" "));
});

test("the headline pill follows the stored finding and its count", () => {
  const withheldOnly = findings({
    suppressedListings: suppressedListingsFinding([
      {
        ...suppressed(),
        asin: "B0EQNOBEN1",
        competitive_external_price_state: "unavailable",
        competitive_price_threshold_cents: null,
      },
      {
        ...suppressed(),
        asin: "B0EQNOBEN2",
        competitive_external_price_state: "unavailable",
        competitive_price_threshold_cents: null,
      },
    ]),
  });
  const withheldFace = headlineBubble(withheldOnly);
  assert.equal(withheldOnly.suppressedListings.issueCount, 2);
  assert.deepEqual(withheldFace.stats, ["2 Buy Boxes withheld"]);
  assert.equal(withheldFace.stats.length, 1);

  const mapSource = findings({
    suppressedListings: suppressedListingsFinding([present()]),
  });
  const mapFace = headlineBubble(mapSource);
  assert.equal(mapSource.mapLeakage.issueCount, 1);
  assert.deepEqual(mapFace.stats, ["1 listing below MAP"]);
  assert.equal(mapBubble(mapSource.mapLeakage).stats[0], "1 below MAP");
});

test("a stored zero stays zero and an unavailable reading names what is missing", () => {
  const zero = suppressedListingsFinding([present()]);
  assert.equal(zero.issueCount, 0);
  const zeroFace = suppressedBubble(zero);
  assert.equal(zeroFace.heroValue?.value, "0.0%");
  assert.equal(zeroFace.heroValue?.label, "confirmed high-price");
  assert.equal(zeroFace.tooltip.desc, "");
  assert.deepEqual(zeroFace.stats, ["0 listings"]);

  const missing = suppressedListingsFinding(null);
  const missingFace = suppressedBubble(missing);
  assert.equal(missing.issueCount, null);
  assert.doesNotMatch(missingFace.heroValue?.value ?? "", /\b0(\.0)?%/);
  assert.match(missingFace.heroValue?.value ?? "", /not stored a reading/i);
  assert.equal(missingFace.tooltip.desc, "");
  assert.doesNotMatch(missingFace.stats.join(" "), /\b0\b/);
  assert.match(missingFace.stats.join(" "), /not stored a reading/i);
  assert.equal(missingFace.stats.join(" "), shortCoverageLine(missing.missingMessage));
});

test("MAP shows the violation count and the price gap, and catalog does not repeat it", () => {
  const source = findings();
  const map = mapBubble(source.mapLeakage);
  assert.match(map.stats[0] ?? "", /1 below MAP/);
  assert.match(map.stats.join(" "), /-\$12\.50 gap/);
  assert.equal(map.heroValue?.label, "", "the title names the figure");
  assert.match(map.heroValue?.value ?? "", /%/);
  assert.equal(map.tooltip.desc, "");
  assert.equal(map.subTab, "MAP Leakage");

  const catalog = catalogBubble(source.unnestedBundles);
  assert.equal(catalog.heroValue?.label, "Splintered Listings");
  assert.match(catalog.heroValue?.value ?? "", /%/);
  assert.match(catalog.stats[0] ?? "", /of 2 bundles with a live offer/);
  assert.match(catalog.tooltip.desc, /offer for sale/);
  assert.doesNotMatch(visible(catalog), /12\.50|below MAP|listing below/);
  assert.equal(catalog.subTab, "Catalog Governance");
});

test("MAP satellite names missing prices and does not count or average a gap", () => {
  const reading = mapLeakageFinding([
    { ...mapRow(null), map_price: null, offer_price: 599.99, amz_leakage: null },
    { ...mapRow(null), map_price: null, offer_price: 287.93, amz_leakage: null },
  ]);
  const map = mapBubble(reading);
  const text = visible(map);
  assert.equal(reading.missingMessage, MAP_PRICES_NOT_STORED);
  assert.match(text, /Fender MAP prices have not been stored/);
  assert.equal(map.heroValue?.value, shortCoverageLine(MAP_PRICES_NOT_STORED));
  assert.equal(map.tooltip.desc, "");
  assert.equal(map.subTab, "MAP Leakage");
  assert.doesNotMatch(text, /below MAP|gap|\$|\d/);
});

test("a higher unfinished reading is not replaced by a later count", () => {
  const source = findings({
    suppressedListings: suppressedListingsFinding(null),
    mapLeakage: mapLeakageFinding([mapRow(-4), mapRow(-6)]),
  });
  const face = headlineBubble(source);
  assert.equal(face.subTab, "Retail Overview");
  // An unfinished reading keeps its own coverage line visible as a second stat, not in a hover.
  assert.equal(face.stats[0], "Suppressed Listings");
  assert.equal(
    face.stats[1],
    shortCoverageLine(source.suppressedListings.missingMessage),
  );
  assert.equal(face.tooltip.desc, "");
  assert.doesNotMatch(face.stats.join(" "), /2 listings/);
});

test("the shared headline keeps the count, the missing message, and the command-center tab", () => {
  const source = findings();
  const surface = headlineSurface({ phase: "ready", snapshot: { ...source, headline: null } });
  assert.equal(surface.label, "Buy Box withheld above Amazon's outside price");
  assert.equal(surface.countLabel, "1 listing");
  assert.equal(surface.missingMessage, source.suppressedListings.missingMessage);
  assert.equal(surface.tab, "Suppressed Listings");
  assert.equal(surface.commandTab, "Retail Overview");
  const sentence = headlineSentence(surface);
  assert.match(sentence, /1 listing/);
  assert.ok(sentence.includes(source.suppressedListings.missingMessage ?? ""));
  assert.doesNotMatch(sentence, FORBIDDEN);

  const mapHeadline = headlineSurface({
    phase: "ready",
    snapshot: {
      ...findings({
        suppressedListings: suppressedListingsFinding([present()]),
      }),
      headline: null,
    },
  });
  assert.equal(mapHeadline.label, "MAP Leakage");
  assert.equal(mapHeadline.commandTab, "MAP Leakage");
  assert.equal(mapHeadline.tab, "MAP Leakage");
});

test("Catalog Health main spoke leads with Buy Box withheld share", () => {
  const reading = suppressedListingsFinding([
    {
      ...suppressed(),
      competitive_external_price_state: "unavailable",
      competitive_price_threshold_cents: null,
    },
    present(),
    present(),
  ]);
  const face = catalogHealthMainFace({
    phase: "ready",
    snapshot: { ...findings({ suppressedListings: reading }), headline: null },
  });
  assert.equal(reading.detail?.counts.withheld, 1);
  assert.equal(reading.detail?.counts.current, 3);
  assert.deepEqual(face.heroValue, {
    value: formatPct(100 / 3),
    label: "Buy Box withheld",
  });
  assert.deepEqual(face.stats, []);
  assert.equal(face.status, "danger");
  assert.equal(face.subTab, "Retail Overview");
  const snap = { ...findings({ suppressedListings: reading }), headline: null };
  assert.equal(retailBubbleFaces({ phase: "ready", snapshot: snap }).main.heroValue?.label, "Buy Box withheld");
});

test("loading and error faces do not invent a count", () => {
  for (const phase of ["loading", "error"] as const) {
    const faces = retailBubbleFaces({ phase });
    const text = [faces.main, faces.suppressed, faces.map, faces.catalog].map(visible).join(" ");
    assert.doesNotMatch(text, /\d/);
    assert.doesNotMatch(text, FORBIDDEN);
  }
  assert.deepEqual(retailBubbleFaces({ phase: "loading" }).main.heroValue, {
    value: "Loading",
    label: "Buy Box withheld",
  });
  const failed = retailBubbleFaces({ phase: "error" });
  assert.deepEqual(failed.main.heroValue, { value: "Not available*", label: "Buy Box withheld" });
  for (const face of [failed.main, failed.suppressed, failed.map, failed.catalog]) {
    assert.equal(face.status, "neutral", `${face.title} carries no status color`);
    assert.match(face.tooltip.desc, /retail read did not load/);
  }
});

test("channel price cells use a stored Musician's Friend URL or Not available*", async () => {
  const { readFileSync } = await import("node:fs");
  const mapTable = readFileSync(
    new URL("../components/v3/live/MapListingsTable.tsx", import.meta.url),
    "utf8",
  );
  const exploreTable = readFileSync(
    new URL("../components/v3/live/FenderListingsTable.tsx", import.meta.url),
    "utf8",
  );
  const {
    MISSING_CHECKED_PAGE_DESC,
    MISSING_CHECKED_PAGE_LABEL,
    musiciansFriendCheckedPageUrl,
    channelPriceLookup,
    missingCheckedPageLabel,
  } = await import("../lib/fender-canvas/map-channels.ts");

  // Decision 82: the empty other-retailer price table is not read on screen, so a shown
  // Musician's Friend price keeps its Not available* mark until a page URL is stored.
  for (const table of [mapTable, exploreTable]) {
    assert.match(table, /requireCheckedPage/);
    assert.doesNotMatch(table, /listingChannelPricesQuery|channelPriceLookup|loadChannelPrices/);
  }
  assert.doesNotMatch(mapTable, /musiciansfriend\.com\/search/i);
  assert.doesNotMatch(exploreTable, /musiciansfriend\.com\/search/i);

  const stored =
    "https://www.musiciansfriend.com/guitars/fender-player-ii/m11513000002000";
  const withUrl = channelPriceLookup([
    {
      asin: "B0D2LP2PRQ",
      channel: "musicians-friend",
      price: 714.99,
      url: stored,
      checked_at: "2026-10-07T00:00:00Z",
    },
  ]);
  assert.equal(musiciansFriendCheckedPageUrl(withUrl, "B0D2LP2PRQ"), stored);
  assert.equal(missingCheckedPageLabel(true, stored, 714.99), null);

  const missing = musiciansFriendCheckedPageUrl(channelPriceLookup([]), "B0HJDFP2XS");
  assert.equal(missing, null);
  assert.equal(missingCheckedPageLabel(true, missing, 599.99), MISSING_CHECKED_PAGE_LABEL);
  assert.equal(MISSING_CHECKED_PAGE_LABEL, "Not available*");
  assert.match(MISSING_CHECKED_PAGE_DESC, /No checked page was stored/i);
});
