/* Worker 29.24 (PM29 demo fixes): fact-check quotes, brand-led Buy Box split, brand site label. */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { evidenceQuote, FACT_CHECK_VERDICTS_IN_DECK } from "../lib/ai-search/drift.ts";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";
import { brandSite } from "../lib/brand-copy.ts";
import { buyBoxSellerCensus, controlledBuyBoxFinding, controlledBuyBoxFromCensus } from "../lib/fender-canvas/consensus-scores.ts";
import { EMPTY_METRICS_ROW } from "../lib/fender-canvas/canvas-reads.ts";
import { activeOfferClarity, activeOfferSplit } from "../lib/fender-canvas/offer-clarity.ts";

afterEach(() => resetActiveClientForTests(null));

test("a stored answer window that starts and ends mid-word shows whole sentences or whole words", () => {
  // Stored Grok API evidence, 17 Nov 2026.
  assert.equal(
    evidenceQuote(
      'nny feel of American Professional II / Player Plus frets.\n\nThis is the standard Player II Strat, not Player Plus (12" radius, narrow tall frets) or American Professional II (9.5" radius, narrow tall frets',
    ),
    'This is the standard Player II Strat, not Player Plus (12" radius, narrow tall frets) or American Professional II (9.5" radius, narrow tall...',
  );
  // Stored ChatGPT evidence, 29 Oct 2026: no sentence start inside the window, so the cut word goes.
  assert.equal(
    evidenceQuote("r a guitar amp that has a real tube sound , or are you just curious whether the Mustang Micro contains actual vacuum tubes? 😊"),
    "...a guitar amp that has a real tube sound, or are you just curious whether the Mustang Micro contains actual vacuum tubes?",
  );
  assert.equal(
    evidenceQuote('**No** — the Fender Player Plus Stratocaster does not have noiseless pickups.\n\nIt ships with a set of three **Custom Shop-made "Player Plus Alnico 5'),
    "No — the Fender Player Plus Stratocaster does not have noiseless pickups.",
  );
  assert.equal(evidenceQuote("A whole answer."), "A whole answer.");
  assert.equal(evidenceQuote(null), "");
});

test("unreviewed fact-check verdicts stay out of the deck", () => {
  assert.equal(FACT_CHECK_VERDICTS_IN_DECK, false);
});

const LEDLENSER_ROW = { ...EMPTY_METRICS_ROW, bb_brand: 68, bb_1p: 0, bb_3p: 111, bb_unharvested: 11, bb_no_offer: 14 };

test("brand-led: the brand's own store is its own side of the active-offer split", () => {
  resetActiveClientForTests("ledlenser");
  const split = activeOfferSplit(LEDLENSER_ROW);
  assert.deepEqual(split, { brand: 68, oneP: 0, threeP: 111, unknown: 11, noOffer: 14, active: 190 });
  const text = activeOfferClarity(LEDLENSER_ROW);
  assert.match(text, /^190 listings have an active Amazon offer\./);
  assert.match(text, /Ledlenser's own store holds the Buy Box on 68 of 190 \(35\.8%\)\./);
  assert.match(text, /Amazon holds the Buy Box on 0 of 190/);
  assert.match(text, /A third-party seller holds the Buy Box on 111 of 190/);
  // Without the brand count a brand-led split is not shown at all, never with the brand folded into another side.
  assert.equal(activeOfferSplit({ ...LEDLENSER_ROW, bb_brand: null }), null);
});

test("partner-led: the split and its wording are unchanged", () => {
  resetActiveClientForTests("fender");
  const row = { ...EMPTY_METRICS_ROW, bb_1p: 71, bb_3p: 874, bb_unharvested: 61, bb_no_offer: 164 };
  assert.equal(activeOfferSplit(row)?.active, 1006);
  assert.doesNotMatch(activeOfferClarity(row), /own store/);
});

test("brand_seller_ids: the brand's own seller counts as controlled and is not a third-party seller choice", () => {
  resetActiveClientForTests("ledlenser");
  const rows = [
    { buybox_status: "Brand Seller", buybox_seller_name: "Ledlenser USA", buybox_seller_id: "A1A8DQ0I1V6KE5" },
    // A second brand account the collector labelled 3P is still the brand's own store.
    { buybox_status: "3P Confirmed", buybox_seller_name: "River City Tools, LLC", buybox_seller_id: "A2MFGMIGS5UPZJ" },
    { buybox_status: "3P Confirmed", buybox_seller_name: "Phonograph", buybox_seller_id: "AB0UTK7JSHBRX" },
  ];
  assert.deepEqual(controlledBuyBoxFinding(rows), { controlled: 2, known: 3, population: 3 });
  const census = buyBoxSellerCensus(rows)!;
  assert.equal(census.brandStore, 2);
  assert.deepEqual(census.sellers.map((s) => s.name), ["Phonograph"]);
  assert.equal(controlledBuyBoxFromCensus(census, []).controlled, 2);
});

test("Ledlenser's brand site is ledlenserusa.com, where its pages are found", () => {
  resetActiveClientForTests("ledlenser");
  assert.equal(brandSite(), "ledlenserusa.com");
});
