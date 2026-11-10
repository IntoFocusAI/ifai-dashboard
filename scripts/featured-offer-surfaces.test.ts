// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/featured-offer-surfaces.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";
import { buildLiveCommandCenter } from "../lib/fender-canvas/command-center-from-live.ts";
import {
  headlineSentence,
  headlineSurface,
  type RetailCanvasRead,
} from "../lib/fender-canvas/portfolio-retail-display.ts";
import {
  MAP_PRICES_NOT_STORED,
  RETAIL_FINDING_LABELS,
  mapLeakageFinding,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  type PortfolioRetailSnapshot,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { retailTemplateVars } from "../lib/fender-canvas/retail-copy.ts";
import { buildLiveTourSteps } from "../lib/fender-canvas/tour-from-live.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function withheld(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return {
    asin: "B0D8G43XJP",
    offer_price: 433.06,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 37198,
    featured_offer_observed_price_cents: 43306,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
    ...overrides,
  };
}

function notChecked(): SuppressionSupportRow {
  return withheld({
    asin: "B0EQNOTCHK",
    featured_offer_state: null,
    featured_offer_withheld: null,
    featured_offer_source: null,
    featured_offer_checked_at: null,
    featured_offer_attempted_at: null,
    competitive_external_price_state: null,
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
  });
}

function snapshot(): PortfolioRetailSnapshot {
  return {
    suppressedListings: suppressedListingsFinding([withheld(), notChecked()]),
    mapLeakage: mapLeakageFinding([
      { map_price: null, offer_price: 433.06, amz_leakage: null, wmt_leakage: null, mf_leakage: null },
    ]),
    unnestedBundles: unnestedBundlesFinding([
      {
        asin: "B000000001",
        model_name: "Starter pack",
        title: null,
        bundle_name: "Starter kit",
        parent_asin: null,
        product_url: null,
        is_bundle: true,
        featured_offer_state: "present",
      },
    ]),
    amazonSpecGaps: {
      status: "unavailable",
      issueCount: null,
      missingMessage: "Amazon spec-field readings have not been stored.",
      detail: null,
    },
    headline: null,
  };
}

const READ: RetailCanvasRead = { phase: "ready", snapshot: snapshot() };

function bundle(): CanvasBundle {
  return {
    m: {
      catalog_skus: 3613,
      catalog_bundles: 941,
      seller_harvested: 1017,
      seller_harvested_pct: 28.1,
      division_count: 13,
      bb_total: 1017,
      bb_1p: 81,
      bb_3p: 874,
      bb_unharvested: 61,
      bb_no_offer: 48,
      bb_1p_pct: 8,
      bb_3p_pct: 86,
      bb_unharvested_pct: 6,
      map_violation_skus: 0,
      amz_below_map: 0,
      amz_avg_drift: null,
      bundle_reviews: null,
      spec_skus: 925,
      spec_fender_found: 123,
      spec_fender_found_pct: 13.3,
      spec_amazon_pct: 91.6,
      spec_fender_pct: 87.5,
      sim_total: 60,
      sim_resolved: 45,
      sim_wins: 33,
      sim_win_pct: 73.3,
      sim_hallucinations: 6,
      weakest_category: "beginner",
      weakest_win_pct: 33.3,
    } as CanvasBundle["m"],
    cats: [],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: [
      { job_key: "catalog_harvester", last_run_at: "2026-10-12T13:00:52.000Z" },
      { job_key: "featured_offer_keepa", last_run_at: "2026-10-12T12:41:16.000Z" },
    ],
  } as CanvasBundle;
}

test("every copied surface carries the same Buy Box label and count", () => {
  const surface = headlineSurface(READ);
  assert.equal(surface.label, "Buy Box withheld above Amazon's outside price");
  assert.equal(surface.countLabel, "1 listing");
  const sentence = headlineSentence(surface);

  // Command center priority, guided tour, and the briefing var.
  const command = buildLiveCommandCenter(bundle(), READ);
  const priority = command.items.find((item) => item.id === "buybox-suppression");
  assert.equal(priority?.title, `${surface.label}: ${surface.countLabel}`);
  assert.ok(command.summary.includes(sentence));

  const nodes = buildLiveNodes(bundle(), buildLiveMetrics(bundle()), READ);
  const roadmap = nodes.find((node) => node.id === "spoke-roadmap");
  assert.equal(roadmap?.meta, undefined);
  assert.equal(Object.hasOwn(roadmap ?? {}, "meta"), false);
  assert.equal(roadmap?.tooltip?.desc, "");

  const tour = buildLiveTourSteps(bundle(), READ);
  assert.ok(
    tour.some((step) => step.displays?.some((line) => line.startsWith(`${surface.label}: ${surface.countLabel}`))),
  );

  const vars = retailTemplateVars(bundle(), READ);
  assert.equal(vars.retail_headline, sentence);

  // The technical coverage sentence never lands in an unrelated client priority.
  const unrelated = command.items.filter((item) => item.id !== "buybox-suppression");
  for (const item of unrelated) {
    assert.doesNotMatch(item.why ?? "", /Buy Box audit has a current reading/);
    assert.doesNotMatch(item.title ?? "", /Buy Box audit/);
  }
});

test("the client-facing label holds even when the confirmed count clears", () => {
  // Every priority, bubble, and spec that opens this evidence matches on this phrase,
  // so it must not revert to the tab title once the count reaches zero.
  const present = withheld({
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_observed_price_cents: 30000,
  });
  const cleared = suppressedListingsFinding([present]);
  assert.equal(cleared.status, "available_with_zero");
  assert.equal(cleared.issueCount, 0);
  assert.equal(cleared.headlineLabel, "Buy Box withheld");

  const partial = suppressedListingsFinding([withheld(), notChecked()]);
  assert.match(partial.headlineLabel ?? "", /^Buy Box withheld/);

  // No reading at all makes no claim about withheld listings.
  assert.equal(suppressedListingsFinding(null).headlineLabel, undefined);
});

test("the suppressed tab keeps its slug so old deep links still resolve", () => {
  assert.equal(RETAIL_FINDING_LABELS.suppressed_listings, "Suppressed Listings");
  assert.equal(tabSlug(RETAIL_FINDING_LABELS.suppressed_listings), "suppressed-listings");
  assert.equal(tabSlug(RETAIL_FINDING_LABELS.map_leakage), "map-leakage");
  assert.equal(tabSlug(RETAIL_FINDING_LABELS.unnested_bundles), "catalog-governance");
  // The label on screen changed; the tab the link opens did not.
  assert.equal(headlineSurface(READ).tab, "Suppressed Listings");
});

test("MAP wording and MAP fields are untouched by the Featured Offer reading", () => {
  assert.equal(MAP_PRICES_NOT_STORED, "Fender MAP prices have not been stored.");
  const mapReading = snapshot().mapLeakage;
  assert.equal(mapReading.missingMessage, MAP_PRICES_NOT_STORED);

  const featuredOffer = readFileSync("lib/fender-canvas/featured-offer.ts", "utf8");
  const featuredOfferCopy = readFileSync("lib/fender-canvas/featured-offer-copy.ts", "utf8");
  // The Featured Offer reading never reads or writes a MAP field.
  assert.doesNotMatch(featuredOffer, /map_price|map_leakage|mf_leakage|wmt_leakage/);
  // And never calls the outside benchmark a MAP price.
  assert.doesNotMatch(featuredOfferCopy, /\bMAP\b/);

  const migration = readFileSync(
    "supabase/migrations/20261012133000_featured_offer_state.sql",
    "utf8",
  );
  assert.doesNotMatch(migration, /(UPDATE|SET|INSERT)[^;]*\bmap_price\b/i);
  assert.match(migration, /never MAP/);
});

test("definition terms use the custom tooltip attributes, never a bare title", () => {
  const files = [
    "components/v3/live/FeaturedOfferRow.tsx",
    "components/v3/live/FeaturedOfferReadings.tsx",
    "components/v3/live/SuppressedListingsPanel.tsx",
    "components/v3/live/RetailOverview.tsx",
  ];
  // Bare native title attrs only. data-ifai-tooltip-title is the custom chrome.
  const bareTitle = /(?<![\w-])title=\{|(?<![\w-])title="/;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, bareTitle, file);
  }
  const overview = readFileSync("components/v3/live/RetailOverview.tsx", "utf8");
  assert.match(overview, /className="ifai-term"/);
  assert.match(overview, /data-ifai-tooltip-title="Buy Box"/);
  assert.match(overview, /Amazon also calls it the Featured Offer\./);
});

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/* Oversized before this work and untouched by it. The component size rule treats these
   as tech debt to split when that area is next edited, not as a blocker here. */
const PRE_EXISTING_OVERSIZED = [
  "components/intofocus-portal/PortalView.tsx",
  "components/sdk/docs/DesignSystemContent.tsx",
  "components/sdk/sdk-canvas-spec.tsx",
  "lib/canvas-sdk/CanvasShell.tsx",
  "lib/canvas-sdk/GraphPrimitives.tsx",
];

test("every TSX file stays at or under 400 lines", () => {
  const oversized = tsxFiles(".")
    .map((file) => ({ file, lines: readFileSync(file, "utf8").split("\n").length }))
    .filter((entry) => entry.lines > 400)
    .map((entry) => entry.file)
    .sort();
  assert.deepEqual(oversized, PRE_EXISTING_OVERSIZED);
});

test("the Featured Offer components stay well under the size limit", () => {
  for (const file of [
    "components/v3/live/FeaturedOfferRow.tsx",
    "components/v3/live/FeaturedOfferReadings.tsx",
    "components/v3/live/SuppressedListingsPanel.tsx",
    "components/v3/live/RetailOverview.tsx",
    "components/v3/live/FenderListingsTable.tsx",
    "components/v3/live/ChannelPriceCell.tsx",
    "components/v3/live/DataFreshnessBar.tsx",
    "components/v3/build-live-spokes.tsx",
  ]) {
    const lines = readFileSync(file, "utf8").split("\n").length;
    assert.ok(lines <= 400, `${file} has ${lines} lines`);
  }
});
