// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/monitored-listings.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { monitoredListingsTotal } from "../lib/fender-canvas/monitored-listings.ts";
import { commonReach, countReach, itemCount, type RankInputs } from "../lib/fender-canvas/priority-rank.ts";
import { reachTotals } from "../lib/fender-canvas/roadmap-plan-read.ts";
import { retailBandSentence } from "../lib/fender-canvas/retail-overview-lead.ts";
import type { PortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";

type AiArg = Parameters<typeof reachTotals>[1];

function snapshot(buyBoxPopulation: number | null, mapPopulation: number | null): PortfolioRetailSnapshot {
  return {
    suppressedListings: {
      detail: buyBoxPopulation == null ? null : { counts: { population: buyBoxPopulation }, population: buyBoxPopulation },
    },
    mapLeakage: { detail: mapPopulation == null ? null : { population: mapPopulation } },
  } as unknown as PortfolioRetailSnapshot;
}

function inputs(base: number, affected: number): RankInputs {
  return { affected, base, unit: "listings", monthly: null, effort: "M", dependsOn: [], tier: "action" };
}

const ai = { phase: "loading" } as unknown as AiArg;

test("the ranking's common base and the hero band base are the same value", () => {
  const snap = snapshot(208, 190);
  const retail = { phase: "ready", snapshot: snap } as unknown as RetailCanvasRead;
  // An item whose own base is larger (a catalog-wide read) must not make a second total.
  const items = [{ inputs: inputs(220, 10) }, { inputs: inputs(208, 5) }];
  const rankBase = commonReach(items, reachTotals(retail, ai)).listings;
  const heroBase = monitoredListingsTotal(snap);
  assert.equal(rankBase, 208);
  assert.equal(rankBase, heroBase);
  const count = itemCount({ ...inputs(220, 10), reach: rankBase }, "Listings");
  assert.match(countReach(count!), /of 208 monitored listings/);
  assert.match(retailBandSentence(heroBase)!, /all 208 monitored listings/);
});

test("with no Buy Box population the MAP population is the base for both", () => {
  const snap = snapshot(null, 190);
  const retail = { phase: "ready", snapshot: snap } as unknown as RetailCanvasRead;
  assert.equal(monitoredListingsTotal(snap), 190);
  assert.equal(reachTotals(retail, ai).listings, 190);
});

test("with no stored population the ranking falls back to the largest item base", () => {
  const items = [{ inputs: inputs(220, 10) }, { inputs: inputs(208, 5) }];
  assert.equal(monitoredListingsTotal(snapshot(null, null)), null);
  assert.equal(commonReach(items, { listings: null }).listings, 220);
});
