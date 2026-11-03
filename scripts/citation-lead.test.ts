// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/citation-lead.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { citationChain, citationOwnedLinksLead } from "../lib/ai-search/citation-lead.ts";
import { pct } from "../lib/ai-search/summary.ts";

test("Fender-owned links lead is the share of cited links, not answers", () => {
  const lead = citationOwnedLinksLead(42, 220);
  assert.equal(lead.figure, pct(42, 220));
  assert.equal(lead.figure, "19.1%");
  assert.equal(lead.population, "42 of 220 cited links lead to Fender-owned sites");
  assert.doesNotMatch(lead.population!, /answers/);
  assert.doesNotMatch(lead.population!, /\u2014/);
});

test("no cited links shows a worded empty state, not 0% or 100%", () => {
  const lead = citationOwnedLinksLead(0, 0);
  assert.equal(lead.figure, "No cited links");
  assert.equal(lead.population, null);
  assert.notEqual(lead.figure, "0.0%");
  assert.notEqual(lead.figure, "100.0%");
  assert.notEqual(lead.figure, "No resolved answers");
});

test("zero owned links among a real population is still 0.0%", () => {
  const lead = citationOwnedLinksLead(0, 10);
  assert.equal(lead.figure, "0.0%");
  assert.equal(lead.population, "0 of 10 cited links lead to Fender-owned sites");
});

test("the headline chain: each share is of the step before it, and each remainder is named", () => {
  const chain = citationChain({ answered: 2538, answersWithCitation: 653 }, { owned: 661, total: 3381 });
  assert.deepEqual(
    [chain.answered, chain.showed, chain.none, chain.links, chain.owned, chain.other],
    [2538, 653, 1885, 3381, 661, 2720],
  );
  assert.equal(pct(chain.showed, chain.answered), "25.7%");
  assert.equal(pct(chain.owned, chain.links), "19.6%");
  assert.equal(chain.showedShare, 653 / 2538);
  assert.equal(chain.ownedShare, 661 / 3381);
  assert.equal(chain.showed + chain.none, chain.answered, "showed sources plus no sources is every answer");
  assert.equal(chain.owned + chain.other, chain.links, "Fender-owned plus other sites is every link");
});

test("an empty step gives no share, so the chain shows Not available* instead of 0%", () => {
  const empty = citationChain({ answered: 0, answersWithCitation: 0 }, { owned: 0, total: 0 });
  assert.equal(empty.showedShare, null);
  assert.equal(empty.ownedShare, null);
  const noLinks = citationChain({ answered: 12, answersWithCitation: 0 }, { owned: 0, total: 0 });
  assert.equal(noLinks.showedShare, 0);
  assert.equal(noLinks.ownedShare, null);
});
