// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/withheld-offer-seller.test.ts
//
// R-15 decision (a): the seller(s) holding a withheld Amazon offer name the partner-led next step.
// Same view and code for every client; the wording follows the seller_type setting only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { priceMatchNextStep, type PriceMatchScopeRow } from "@/lib/fender-canvas/price-match";
import {
  sellerListLabel,
  withOfferSellers,
  withheldOfferSellers,
  type WithheldOfferSellerRow,
} from "@/lib/fender-canvas/withheld-offer-seller";

const rows: WithheldOfferSellerRow[] = [
  { asin: "B000000001", seller_ids: ["A1"], seller_names: ["Austin Bazaar"], featured_offer_state: "withheld" },
  {
    asin: "B000000002",
    seller_ids: ["A1", "A2", "A3", "A4", "A5"],
    seller_names: ["GearTree", "Sweetwater Sound", null, "Butler Music LLC", "Kellards"],
    featured_offer_state: "withheld",
  },
  { asin: "B000000003", seller_ids: ["A9"], seller_names: [null], featured_offer_state: "withheld" },
  { asin: "B000000004", seller_ids: ["A1"], seller_names: ["Austin Bazaar"], featured_offer_state: "present" },
  { asin: "B000000005", seller_ids: [], seller_names: [], featured_offer_state: "withheld" },
];

const scopeRow = (asin: string): PriceMatchScopeRow => ({ asin, label: asin, benchmarkCents: 71499, offerSeller: null });

test("sellers are kept only for listings still withheld, with at least one seller", () => {
  const map = withheldOfferSellers(rows);
  assert.deepEqual([...map.keys()], ["B000000001", "B000000002", "B000000003"]);
  assert.deepEqual(map.get("B000000002"), { names: ["GearTree", "Sweetwater Sound", "Butler Music LLC", "Kellards"], total: 5 });
  assert.deepEqual(map.get("B000000003"), { names: [], total: 1 });
});

test("seller list label: one, two, three, and more (unnamed sellers count in more)", () => {
  assert.equal(sellerListLabel(["A"], 1), "A");
  assert.equal(sellerListLabel(["A", "B"], 2), "A and B");
  assert.equal(sellerListLabel(["A", "B", "C"], 3), "A, B and C");
  assert.equal(sellerListLabel(["A", "B", "C", "D"], 5), "A, B, C and 2 more");
  assert.equal(sellerListLabel(["A"], 2), "A and 1 more");
  assert.equal(sellerListLabel([], 2), null);
});

test("partner-led next step names the seller(s); no name falls back; brand-led is unchanged", () => {
  const scope = withOfferSellers(["B000000001", "B000000002", "B000000003", "B000000009"].map(scopeRow), withheldOfferSellers(rows));
  const steps = scope.map((l) => priceMatchNextStep("Partner-led", l));
  assert.deepEqual(steps, [
    "Ask Austin Bazaar, the authorized seller holding this Amazon offer, to price it at the benchmark, $714.99.",
    "Ask GearTree, Sweetwater Sound, Butler Music LLC and 2 more, the authorized sellers holding this Amazon offer, to price it at the benchmark, $714.99.",
    "Ask the authorized seller(s) holding this Amazon offer to price it at the benchmark, $714.99.",
    "Ask the authorized seller(s) holding this Amazon offer to price it at the benchmark, $714.99.",
  ]);
  assert.equal(priceMatchNextStep("Brand-led", scope[0]), "Price the Amazon offer at the benchmark, $714.99.");
});

test("the screen reads the seller view and applies it to the scope, with no client-name branch", () => {
  const hook = readFileSync("components/v3/live/usePriceMatches.ts", "utf8");
  assert.match(hook, /from\("canvas_withheld_offer_sellers"\)/);
  const section = readFileSync("components/v3/live/PriceMatchesSection.tsx", "utf8");
  assert.match(section, /withOfferSellers\(priceMatchScope\(rows\), withheldOfferSellers\(read\.sellers\)\)/);
  const lib = readFileSync("lib/fender-canvas/withheld-offer-seller.ts", "utf8");
  assert.doesNotMatch(lib, /["'`](fender|ledlenser)["'`]/i, "no client-name branch");
});
