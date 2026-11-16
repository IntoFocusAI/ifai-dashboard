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
import {
  controlledBuyBoxFinding,
  requiredMarketplaceSpecShare,
  requiredSpecsPlaceholderTooltip,
} from "@/lib/fender-canvas/consensus-scores";
import { specFieldLabel } from "@/lib/fender-canvas/catalog-governance-findings";
import { sheetSplit, type FindabilityRow } from "@/lib/findability/outcomes";
import { FINDABILITY_COLUMNS, findabilityColumns, loadFindabilityRead, type FindabilityClient } from "@/lib/findability/queries";

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

test("required marketplace specs: guitar fields for Fender, lighting fields for Ledlenser", () => {
  const gaps = [{ missingFields: ["beam_distance"] }, { missingFields: ["scale_length"] }];
  resetActiveClientForTests("fender");
  assert.deepEqual(requiredMarketplaceSpecShare(gaps, 10), { numerator: 9, denominator: 10 });
  assert.match(requiredSpecsPlaceholderTooltip(), /guitar/);
  resetActiveClientForTests("ledlenser");
  assert.deepEqual(requiredMarketplaceSpecShare(gaps, 10), { numerator: 9, denominator: 10 });
  assert.match(requiredSpecsPlaceholderTooltip(), /max lumens, beam distance/);
  assert.equal(specFieldLabel("light_output_maximum"), "Max lumens");
  assert.equal(specFieldLabel("water_resistance_level"), "Water resistance");
  resetActiveClientForTests(null);
});

test("official pages: Ledlenser splits on and off the product sheet; Fender has no split", () => {
  const row = (asin: string, confirmed: boolean, onSheet?: boolean) =>
    ({ asin, counts_as_confirmed: confirmed, ...(onSheet === undefined ? {} : { on_brand_sheet: onSheet }) }) as FindabilityRow;
  assert.deepEqual(sheetSplit([row("A", true, true), row("B", false, true), row("C", true, false), row("D", false, false)]), {
    onSheet: { confirmed: 1, total: 2 },
    offSheet: { confirmed: 1, total: 2 },
  });
  assert.equal(sheetSplit([row("A", true), row("B", false)]), null);
  resetActiveClientForTests("fender");
  assert.equal(findabilityColumns(), FINDABILITY_COLUMNS);
  resetActiveClientForTests("ledlenser");
  assert.ok(findabilityColumns().endsWith(",on_brand_sheet"));
  resetActiveClientForTests(null);
});

test("official pages still load when the view has no sheet flag yet", async () => {
  resetActiveClientForTests("ledlenser");
  const asked: string[] = [];
  const client = {
    from: (view: string) => ({
      select: (columns: string) => ({
        order: () => {
          const result = () => {
            if (view === "canvas_spec_findability") asked.push(columns);
            if (view === "canvas_spec_findability" && columns.includes("on_brand_sheet")) {
              return Promise.resolve({ data: null, error: { message: "column on_brand_sheet does not exist" } });
            }
            return Promise.resolve({ data: view === "canvas_spec_findability" ? [{ asin: "B0", counts_as_confirmed: true }] : [], error: null });
          };
          return { range: () => result() };
        },
      }),
    }),
  } as unknown as FindabilityClient;
  const read = await loadFindabilityRead(client);
  assert.equal(read.phase, "ready");
  assert.equal(asked.length, 2);
  resetActiveClientForTests(null);
});

test("citation sources: Ledlenser's regional sites are brand-owned and lighting sites are classed", async () => {
  const { classifySource } = await import("@/lib/ai-search/citations");
  resetActiveClientForTests("ledlenser");
  for (const d of ["ledlenser.com", "media.ledlenser.com", "ledlenser.co.uk", "ledlenser.com.au", "ledlenserusa.com"]) {
    assert.equal(classifySource(d), "fender_owned", d);
  }
  assert.equal(classifySource("ledlenser-fake.com"), "other");
  assert.equal(classifySource("1lumen.com"), "editorial");
  assert.equal(classifySource("rei.com"), "retailer");
  assert.equal(classifySource("au.olight.com"), "competitor_brand");
  assert.equal(classifySource("sweetwater.com"), "other");
  resetActiveClientForTests("fender");
  assert.equal(classifySource("ledlenser.co.uk"), "other");
  assert.equal(classifySource("sweetwater.com"), "retailer");
  resetActiveClientForTests(null);
});

test("set-asides, site copy, and API-engine reads follow the brand on screen", async () => {
  const { activeSetAsideClientKey } = await import("@/lib/set-aside/keys");
  const { apiEngineViewsEnabled } = await import("@/lib/ai-search/api-runs");
  const { pagesCheckedNote } = await import("@/lib/fender-canvas/page-found-stored-reason");
  const { leadRateTip } = await import("@/lib/ai-search/summary");
  try {
    resetActiveClientForTests("fender");
    assert.equal(activeSetAsideClientKey(), "fmic");
    assert.equal(apiEngineViewsEnabled(undefined, {}), true);
    assert.equal(pagesCheckedNote({ pagesChecked: 2, pagesCut: false }), "2 fender.com pages checked.");
    assert.match(leadRateTip({ fenderWins: 1, resolved: 2 }), /named Fender\/Squier most/);
    resetActiveClientForTests("ledlenser");
    assert.equal(activeSetAsideClientKey(), "ledlenser");
    assert.equal(apiEngineViewsEnabled(undefined, {}), true);
    assert.equal(apiEngineViewsEnabled("0", {}), false);
    assert.equal(pagesCheckedNote({ pagesChecked: 2, pagesCut: false }), "2 ledlenser.com pages checked.");
    assert.match(leadRateTip({ fenderWins: 1, resolved: 2 }), /named Ledlenser most/);
  } finally {
    resetActiveClientForTests();
  }
});

test("dashboard screens never read set-asides with Fender's fixed key", async () => {
  const { readFileSync } = await import("node:fs");
  for (const file of [
    "components/v3/live/MapChannelPanel.tsx",
    "components/v3/live/usePortfolioRetailSnapshot.ts",
    "components/v3/live/SetAsideTable.tsx",
    "lib/fender-canvas/command-center-from-live.ts",
    "lib/fender-canvas/build-canvas-spec.tsx",
  ]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /useSetAsides\(FMIC_CLIENT_KEY|setAsideClientKey: FMIC_CLIENT_KEY/, file);
  }
});
