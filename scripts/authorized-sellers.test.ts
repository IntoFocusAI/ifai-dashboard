// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/authorized-sellers.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  AMAZON_RETAIL_ALWAYS_INCLUDED,
  AUTHORIZED_SELLERS_BROWSER_LINE,
  AUTHORIZED_SELLERS_SAVE_LABEL,
  authorizedPartnersFromSave,
  authorizedSellerControlOffered,
  authorizedSellersSavedLine,
  reviveAuthorizedSellers,
  sellerChecked,
  toggleSeller,
} from "../lib/fender-canvas/authorized-sellers.ts";
import { buyBoxSellerCensus } from "../lib/fender-canvas/consensus-scores.ts";
import { commerceInputsFromSnapshot } from "../lib/fender-canvas/consensus-scores-from-live.ts";
import type { PortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const rows = [
  { buybox_status: "Amazon 1P", buybox_seller_name: null },
  { buybox_status: "3P Confirmed", buybox_seller_name: "Austin Bazaar" },
  { buybox_status: "3P Confirmed", buybox_seller_name: "GearTree" },
  { buybox_status: "3P Confirmed", buybox_seller_name: "Crazy Dave's Music" },
  { buybox_status: "Unknown/Not Harvested", buybox_seller_name: null },
];

test("the control is offered only for Partner-led", () => {
  assert.equal(authorizedSellerControlOffered("Partner-led"), true);
  for (const sellerType of [
    "Brand-led marketplace",
    "Amazon Retail only",
    "Hybrid",
    "No managed Amazon presence",
    "partner-led",
    "",
  ]) {
    assert.equal(authorizedSellerControlOffered(sellerType), false);
  }
});

test("a browser save replaces the placeholder count and an empty save is still a save", () => {
  assert.equal(reviveAuthorizedSellers(null), null);
  assert.equal(reviveAuthorizedSellers({}), null);
  assert.equal(reviveAuthorizedSellers([]), null);
  assert.deepEqual(reviveAuthorizedSellers({ sellers: [] }), { sellers: [] });
  assert.deepEqual(
    reviveAuthorizedSellers({
      sellers: [" Austin Bazaar ", "austin bazaar", "GearTree", 3, ""],
    }),
    { sellers: ["Austin Bazaar", "GearTree"] },
  );

  assert.equal(authorizedPartnersFromSave(null), null);
  assert.deepEqual(authorizedPartnersFromSave({ sellers: [] }), []);
  assert.equal(sellerChecked(["austin bazaar"], "Austin Bazaar"), true);
  assert.deepEqual(toggleSeller(["Austin Bazaar"], "austin bazaar"), []);
  assert.deepEqual(toggleSeller(["GearTree"], "Austin Bazaar"), ["GearTree", "Austin Bazaar"]);

  const census = buyBoxSellerCensus(rows);
  const snapshot = {
    controlledBuyBox: { controlled: 3, known: 4, population: 5 },
    buyBoxSellers: census,
    suppressedListings: { detail: null },
    unnestedBundles: { detail: null },
    mapLeakage: { detail: null },
  } as PortfolioRetailSnapshot;

  assert.deepEqual(commerceInputsFromSnapshot(snapshot).controlledBuyBox, {
    numerator: 3,
    denominator: 4,
  });
  assert.deepEqual(commerceInputsFromSnapshot(snapshot, ["Crazy Dave's Music"]).controlledBuyBox, {
    numerator: 2,
    denominator: 4,
  });
  assert.deepEqual(commerceInputsFromSnapshot(snapshot, []).controlledBuyBox, {
    numerator: 1,
    denominator: 4,
  });
});

test("visible copy names a saved list for this browser and keeps the placeholder until then", () => {
  assert.equal(AMAZON_RETAIL_ALWAYS_INCLUDED, "Amazon Retail is always included.");
  assert.equal(AUTHORIZED_SELLERS_BROWSER_LINE, "This list is kept in this browser.");
  assert.equal(AUTHORIZED_SELLERS_SAVE_LABEL, "Save for this browser");
  assert.equal(
    authorizedSellersSavedLine([]),
    "Saved for this browser. Controlled Buy Box counts Amazon Retail only.",
  );
  assert.equal(
    authorizedSellersSavedLine(["Austin Bazaar"]),
    "Saved for this browser: Austin Bazaar. Controlled Buy Box counts Amazon Retail and Austin Bazaar.",
  );
  assert.equal(
    authorizedSellersSavedLine(["Austin Bazaar", "GearTree"]),
    "Saved for this browser: Austin Bazaar and GearTree. Controlled Buy Box counts Amazon Retail and Austin Bazaar and GearTree.",
  );
  assert.match(authorizedSellersSavedLine(["Austin Bazaar"]), /this browser/i);
  assert.doesNotMatch(authorizedSellersSavedLine(["Austin Bazaar"]), /permanent|company/i);
  assert.doesNotMatch(AUTHORIZED_SELLERS_BROWSER_LINE, /permanent|company/i);
});

test("the authorized sellers bubble starts closed and reveals the list only when opened", () => {
  const control = read("components/v3/live/AuthorizedSellersControl.tsx");
  const controlRender = control.slice(control.indexOf("export function AuthorizedSellersControl"));
  const fields = control.slice(0, control.indexOf("export function AuthorizedSellersControl"));

  assert.match(controlRender, /const \[open, setOpen\] = useState\(false\)/);
  assert.doesNotMatch(controlRender, /useState\(true\)/);
  assert.match(controlRender, /aria-expanded=\{open\}/);
  assert.match(controlRender, /className="retail-explore authorized-sellers-toggle"/);
  assert.match(controlRender, />\s*Authorized sellers\s*<SellersChevron/);
  assert.match(
    controlRender,
    /\{open \? \(\s*<AuthorizedSellersFields[\s\S]*\) : null\}/,
  );
  assert.doesNotMatch(control, /localStorage|sessionStorage/);

  assert.match(fields, /data-authorized-seller=\{choice\.name\}/);
  assert.match(fields, /data-authorized-sellers-save=""/);
  assert.match(fields, /AUTHORIZED_SELLERS_MARK_LINE/);
  assert.match(fields, /AMAZON_RETAIL_ALWAYS_INCLUDED/);
  assert.match(fields, /AUTHORIZED_SELLERS_BROWSER_LINE/);
  assert.doesNotMatch(controlRender, /data-authorized-sellers-save=""|data-authorized-seller=\{choice/);
});

test("Retail Overview offers the control from the Buy Box read and stores it in this browser", () => {
  const overview = read("components/v3/live/RetailOverview.tsx");
  const control = read("components/v3/live/AuthorizedSellersControl.tsx");
  const store = read("lib/fender-canvas/authorized-sellers-store.ts");
  const commerce = read("components/v3/live/CommerceConsensusPanel.tsx");
  const scores = read("components/v3/live/ConsensusScoresPanel.tsx");
  const lead = read("components/v3/live/ConsensusScoreView.tsx");

  assert.match(overview, /authorizedSellerControlOffered\(RETAIL_SELLER_TYPE\)/);
  assert.match(overview, /AuthorizedSellersControl/);
  assert.match(control, /type="checkbox"/);
  assert.match(control, /data-amazon-retail-always/);
  assert.match(control, /AMAZON_RETAIL_ALWAYS_INCLUDED/);
  assert.match(control, /CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP/);
  assert.match(control, /data-ifai-tooltip-title="Controlled Buy Box"/);
  assert.match(control, /data-ifai-tooltip-desc=\{CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP\}/);
  assert.match(control, /className="ifai-term"/);
  assert.match(control, /authorizedSellersSavedLine/);
  assert.match(control, /AUTHORIZED_SELLERS_BROWSER_LINE/);
  assert.match(control, /AUTHORIZED_SELLERS_SAVE_LABEL/);
  assert.doesNotMatch(control, /type="text"|type="search"|<textarea/);
  assert.doesNotMatch(control, /(?<![\w-])title=\{|(?<![\w-])title="/);
  assert.doesNotMatch(control, /supabase|permanent|company/i);
  assert.doesNotMatch(control, /\u2014/);
  assert.match(store, /createLocalStore/);
  assert.match(store, /ifai:fender:authorized-buy-box-sellers/);
  assert.doesNotMatch(store, /supabase/i);
  assert.match(commerce, /commerceInputsFromLive\(read, authorizedPartners\)/);
  assert.match(commerce, /commerceScore\(inputs, \{ authorizedPartners \}\)/);
  assert.match(scores, /authorizedPartners/);
  assert.match(scores, /<ConsensusLeadBand consensus=\{consensus\} \/>/);
  assert.doesNotMatch(lead, /authorizedPartners|AuthorizedSellers/);
});
