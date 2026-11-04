// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/client-switcher.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeClient,
  clientHref,
  clientKeyFromSearch,
  clientStorageKey,
  resetActiveClientForTests,
} from "@/lib/client/active-client";
import { toClientUrl, toDashboardBody } from "@/lib/client/column-aliases";
import { controlledBuyBoxFinding } from "@/lib/fender-canvas/consensus-scores";

const REST = "https://example.supabase.co/rest/v1";

test("the client query parameter picks the brand; anything else is Fender", () => {
  assert.equal(clientKeyFromSearch("?client=ledlenser"), "ledlenser");
  assert.equal(clientKeyFromSearch("?client=fender"), "fender");
  assert.equal(clientKeyFromSearch("?client=acme"), "fender");
  assert.equal(clientKeyFromSearch(""), "fender");
});

test("switching brands drops open panels; Fender has no parameter", () => {
  assert.equal(clientHref("ledlenser", "/dashboard"), "/dashboard?client=ledlenser");
  assert.equal(clientHref("fender", "/dashboard"), "/dashboard");
});

test("browser storage keys stay separate per brand, and Fender keeps its keys", () => {
  resetActiveClientForTests("fender");
  assert.equal(clientStorageKey("ifai:fender:command-center"), "ifai:fender:command-center");
  resetActiveClientForTests("ledlenser");
  assert.equal(clientStorageKey("ifai:fender:command-center"), "ifai:ledlenser:command-center");
  assert.equal(clientStorageKey("ifai:viewer"), "ifai:viewer:ledlenser");
  resetActiveClientForTests(null);
});

test("requests rename dashboard columns and outcome values to Ledlenser's", () => {
  const url = new URL(
    toClientUrl(
      `${REST}/canvas_ai_category?select=*&order=fender_win_pct.asc&outcome=eq.fender_win&or=(fender_found.eq.true,spec_fender_found.gt.0)`,
    ),
  );
  assert.equal(url.searchParams.get("order"), "brand_win_pct.asc");
  assert.equal(url.searchParams.get("outcome"), "eq.brand_win");
  assert.equal(url.searchParams.get("or"), "(brand_site_found.eq.true,spec_brand_site_found.gt.0)");
});

test("requests drop Fender-only Musician's Friend columns from select lists", () => {
  const url = new URL(toClientUrl(`${REST}/canvas_retail_listings?select=asin,mf_price,wmt_price,mf_leakage`));
  assert.equal(url.searchParams.get("select"), "asin,wmt_price");
});

test("non-REST URLs pass through untouched", () => {
  const auth = "https://example.supabase.co/auth/v1/token?fender_win=1";
  assert.equal(toClientUrl(auth), auth);
});

test("responses rename Ledlenser columns and codes back to the dashboard's", () => {
  const rows = toDashboardBody([
    { brand_win_pct: 40, brand_wins: 4, outcome: "brand_win", probe_brand_sku: "502231" },
    { brand_site_url: "https://ledlenser.com/x", source: "brand_site", spec_avg_brand_site_pct: 70 },
  ]) as Array<Record<string, unknown>>;
  assert.deepEqual(rows[0], { fender_win_pct: 40, fender_wins: 4, outcome: "fender_win", probe_fender_sku: "502231" });
  assert.deepEqual(rows[1], { fender_url: "https://ledlenser.com/x", source: "fender", spec_avg_fender_pct: 70 });
  // A single-row read (.single()) is an object, not an array.
  assert.deepEqual(toDashboardBody({ bb_brand_pct: 70 }), { bb_brand_pct: 70 });
});

test("brand-led: the brand's own seller accounts count as a controlled Buy Box", () => {
  resetActiveClientForTests("ledlenser");
  assert.equal(activeClient().sellerModel, "Brand-led");
  const finding = controlledBuyBoxFinding([
    { buybox_status: "Brand Seller", buybox_seller_name: "Ledlenser USA" },
    { buybox_status: "Amazon 1P", buybox_seller_name: "Amazon" },
    { buybox_status: "3P Confirmed", buybox_seller_name: "GearTree" },
  ]);
  // Fender's placeholder dealers (Austin Bazaar, GearTree) are not Ledlenser's.
  assert.deepEqual(finding, { controlled: 2, known: 3, population: 3 });
  resetActiveClientForTests(null);
});
