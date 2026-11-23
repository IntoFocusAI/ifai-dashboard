// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/retail-bands.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RETAIL_POOR_SHARE,
  retailBandSentence,
  toneForShare,
} from "../lib/fender-canvas/retail-overview-lead.ts";
import { monitoredListingsTotal } from "../lib/fender-canvas/monitored-listings.ts";
import type { PortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";

test("the band is 5% of the card's own shown base", () => {
  assert.equal(RETAIL_POOR_SHARE, 0.05);
});

test("0 is Good, under 5% is Fair, 5% or more is Poor, on the card's own N of M", () => {
  assert.equal(toneForShare(0, 5), "success");
  assert.equal(toneForShare(0, 1000), "success");
  assert.equal(toneForShare(49, 1000), "warning", "4.9%");
  assert.equal(toneForShare(50, 1000), "danger", "5.0%");
  assert.equal(toneForShare(51, 1000), "danger", "5.1%");
});

test("the color matches the number on the card", () => {
  assert.equal(toneForShare(43, 334), "danger", "Fender splintered 12.9%");
  assert.equal(toneForShare(10, 208), "warning", "Ledlenser Buy Box 4.8%");
  assert.equal(toneForShare(1, 5), "danger", "Ledlenser splintered 20%");
});

test("a missing count or base keeps the warning", () => {
  assert.equal(toneForShare(null, 5), "warning");
  assert.equal(toneForShare(3, null), "warning");
  assert.equal(toneForShare(3, 0), "warning");
});

test("the title tooltip names the band and the card's own base", () => {
  assert.equal(retailBandSentence(334, "bundles"), "Good at 0; Fair under 5% of 334 bundles; Poor at 5% or more.");
  assert.equal(
    retailBandSentence(996, "listings with a Buy Box reading"),
    "Good at 0; Fair under 5% of 996 listings with a Buy Box reading; Poor at 5% or more.",
  );
  assert.equal(
    retailBandSentence(633, "listings with a MAP price"),
    "Good at 0; Fair under 5% of 633 listings with a MAP price; Poor at 5% or more.",
  );
  assert.equal(retailBandSentence(null, "bundles"), null);
});

test("the ranking's common base is still all monitored listings, not a card's base", () => {
  const snapshot = {
    suppressedListings: { detail: { counts: { population: 1198, current: 996 } } },
    mapLeakage: { detail: { population: 1150, decided: 633 } },
  } as unknown as PortfolioRetailSnapshot;
  assert.equal(monitoredListingsTotal(snapshot), 1198);
  assert.match(readFileSync("lib/fender-canvas/priority-rank.ts", "utf8"), /monitoredListingsTotal/);
});

test("the card title carries the tooltip, and the pie no longer repeats it", () => {
  const card = readFileSync("components/v3/live/RetailOverviewLead.tsx", "utf8");
  assert.match(card, /figureTipAttrs\(hero\.label, hero\.tip, "retail-hero-title"\)/);
  assert.doesNotMatch(card, /RetailShareDisc[^\n]*tip=/);
  assert.doesNotMatch(card, /title=/);
});
