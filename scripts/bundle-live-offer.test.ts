// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/bundle-live-offer.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { briefingFindingsLead } from "../lib/fender-canvas/briefing-retail-lead.ts";
import type { MinimalContext } from "../lib/fender-canvas/minimal-metric-kit.ts";
import { RETAIL_ENTRIES } from "../lib/fender-canvas/minimal-metrics-retail.ts";
import {
  bundlePopulationTip,
  hasLiveOffer,
  LIVE_OFFER_BUNDLES,
  LIVE_OFFER_RULE,
  RETAIL_CATALOG_GOVERNANCE_COLUMNS,
  selectRetailHeadline,
  unnestedBundlesFinding,
  type CatalogBundleRow,
  type PortfolioRetailSnapshot,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { catalogBubble } from "../lib/fender-canvas/portfolio-retail-display.ts";
import { catalogHero } from "../lib/fender-canvas/retail-overview-lead.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

let seq = 0;
function bundle(state: string | null, parent: string | null = null): CatalogBundleRow {
  seq += 1;
  return {
    asin: `B${String(seq).padStart(9, "0")}`,
    model_name: "Kit",
    title: null,
    bundle_name: null,
    parent_asin: parent,
    product_url: null,
    is_bundle: true,
    featured_offer_state: state,
  };
}

/** Mirrors the live shape on 4 Nov 2026: present and withheld are for sale; no_active_offer and unread are not. */
function rows(): CatalogBundleRow[] {
  return [
    bundle("present"),
    bundle("present"),
    bundle("present", "B0PARENT01"),
    bundle("present", "B0PARENT01"),
    bundle("withheld"),
    bundle("withheld", "B0PARENT02"),
    bundle("no_active_offer"),
    bundle("no_active_offer"),
    bundle(null),
    { ...bundle("present"), is_bundle: false },
  ];
}

function snapshot(): PortfolioRetailSnapshot {
  const findings = {
    suppressedListings: { status: "unavailable" as const, issueCount: null, missingMessage: "x", detail: null },
    mapLeakage: { status: "unavailable" as const, issueCount: null, missingMessage: "x", detail: null },
    unnestedBundles: unnestedBundlesFinding(rows(), { catalogBundleCount: 945 }),
    amazonSpecGaps: { status: "unavailable" as const, issueCount: null, missingMessage: "x", detail: null },
  };
  return { ...findings, headline: selectRetailHeadline(findings) } as PortfolioRetailSnapshot;
}

test("present and withheld are live offers; no active offer and no reading are not", () => {
  assert.equal(hasLiveOffer({ featured_offer_state: "present" }), true);
  assert.equal(hasLiveOffer({ featured_offer_state: "withheld" }), true);
  assert.equal(hasLiveOffer({ featured_offer_state: " Withheld " }), true);
  assert.equal(hasLiveOffer({ featured_offer_state: "no_active_offer" }), false);
  assert.equal(hasLiveOffer({ featured_offer_state: null }), false);
  assert.equal(hasLiveOffer({}), false);
});

test("the bundle figure counts only bundles with a live offer", () => {
  const reading = unnestedBundlesFinding(rows(), { catalogBundleCount: 945 });
  assert.equal(reading.status, "available_with_issues");
  assert.equal(reading.issueCount, 3);
  assert.equal(reading.detail?.bundlesInRead, 6);
  assert.equal(reading.detail?.flaggedInRead, 9);
  assert.equal(reading.detail?.offerUnread, 1);
  assert.equal(reading.detail?.catalogBundles, 945);
  assert.ok(reading.detail?.opportunities.every((row) => row.justification.isBundle));
  assert.equal(reading.detail?.opportunities.length, 3);
});

test("a read with bundle flags but no offer state is unavailable, not a zero", () => {
  const reading = unnestedBundlesFinding([
    { ...bundle(null), featured_offer_state: undefined },
    { ...bundle(null), featured_offer_state: undefined },
  ]);
  assert.equal(reading.status, "unavailable");
  assert.equal(reading.issueCount, null);
  assert.match(reading.missingMessage ?? "", /live offer/i);
});

test("the catalog governance read selects the offer state the rule needs", () => {
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /featured_offer_state/);
});

test("the tooltip names the counted set, the rule, and the wider totals", () => {
  const tip = bundlePopulationTip(unnestedBundlesFinding(rows(), { catalogBundleCount: 945 })) ?? "";
  assert.match(tip, /^3 of 6 bundles with a live offer have no usable parent ASIN\./);
  assert.ok(tip.includes(LIVE_OFFER_RULE));
  assert.match(tip, /9 monitored listings are flagged as bundles, out of 945 the catalog flags\./);
  assert.match(tip, /1 of them has no offer reading yet\./);
  assert.doesNotMatch(tip, /not a random|not proof|fee|retainer/i);
});

test("every bundle surface shows the same N of M with the live-offer label and the rule in its tooltip", () => {
  const snap = snapshot();
  const hero = catalogHero(snap);
  assert.equal(hero.numerator, 3);
  assert.equal(hero.denominator, 6);
  assert.equal(hero.ratio, `3 of 6 ${LIVE_OFFER_BUNDLES}`);
  assert.ok(hero.tip?.includes(LIVE_OFFER_RULE));
  assert.equal(hero.pie?.total, 6);

  const briefing = briefingFindingsLead({ phase: "ready", snapshot: snap }, { phase: "loading" }, { phase: "loading" });
  const splintered = briefing.findings.find((finding) => finding.id === "splintered_bundles");
  assert.equal(splintered?.ratio, hero.ratio);
  assert.equal(splintered?.tip, hero.tip);
  assert.equal(splintered?.denominator, 6);

  const bubble = catalogBubble(snap.unnestedBundles);
  assert.equal(bubble.stats[0], `3 of 6 ${LIVE_OFFER_BUNDLES}`);
  assert.equal(bubble.heroValue?.value, hero.percent);
  assert.equal(bubble.tooltip.desc, hero.tip);

  const entry = RETAIL_ENTRIES.find((candidate) => candidate.id === "sat-asin");
  assert.ok(entry);
  const ctx = {
    retail: { phase: "ready", snapshot: snap },
    node: () => ({ heroValue: { value: hero.percent }, status: "warning" }),
  } as unknown as MinimalContext;
  const slot = entry.read(ctx);
  assert.equal(slot.ratio, `3 of 6 ${LIVE_OFFER_BUNDLES}`);
  assert.equal(slot.tip, hero.tip);
});

test("Catalog Governance puts the rule on the labelled ratio with the shared tooltip", () => {
  const panel = read("components/v3/live/CatalogGovernancePanel.tsx");
  assert.match(panel, /figureTipAttrs\(SPLINTERED_LISTINGS_LABEL, hero\.tip, "bundle-population"\)\}>\{hero\.ratio\}/);
  assert.doesNotMatch(panel, /\stitle="/);
});
