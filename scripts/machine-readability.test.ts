// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/machine-readability.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSpecPages,
  namedMissingMachineSpecs,
  pageNameFromUrl,
  plainSpecFieldName,
  machineReadabilityHeroes,
  sharedGapSentence,
  specPageCounts,
  type SpecPageSourceRow,
} from "../lib/fender-canvas/machine-readability.ts";

const STRAT = "https://www.fender.com/products/player-ii-stratocaster";
const TELE = "https://www.fender.com/products/player-ii-telecaster";

function row(asin: string, url: string | null, found: boolean | null, missing: string | null, at: string): SpecPageSourceRow {
  return { asin, fender_url: url, fender_found: found, fender_missing_fields: missing, checked_at: at };
}

test("listings on one fender.com page count as one page", () => {
  const summary = buildSpecPages([
    row("B1", STRAT, true, "additionalProperty", "2026-10-20T00:00:00Z"),
    row("B2", `${STRAT}?variant=1`, true, "additionalProperty", "2026-10-21T00:00:00Z"),
    row("B3", `${STRAT}/`, true, "additionalProperty", "2026-10-19T00:00:00Z"),
    row("B4", TELE, true, "additionalProperty", "2026-10-22T00:00:00Z"),
    row("B5", null, false, null, "2026-10-22T00:00:00Z"),
    row("B6", null, null, null, "2026-10-22T00:00:00Z"),
  ]);
  assert.equal(summary.pages.length, 2);
  assert.equal(summary.listings, 4);
  const strat = summary.pages[0];
  assert.equal(strat.url, STRAT);
  assert.deepEqual(strat.asins, ["B1", "B2", "B3"]);
  assert.equal(strat.model, "Player II Stratocaster");
  assert.equal(strat.checkedAt, "2026-10-21T00:00:00Z");
  assert.equal(strat.hasSpecBlock, false);
  assert.equal(strat.basicsPresent, 7);
});

test("heroes share pages, not listings, and an unread page set invents no percentage", () => {
  const summary = buildSpecPages([
    row("B1", STRAT, true, "additionalProperty", "2026-10-20T00:00:00Z"),
    row("B2", STRAT, true, "additionalProperty", "2026-10-20T00:00:00Z"),
    row("B3", TELE, true, "gtin12", "2026-10-20T00:00:00Z"),
  ]);
  const [missing, basics] = machineReadabilityHeroes(summary);
  assert.equal(missing.id, "missing_specs");
  assert.equal(missing.percent, "50.0%");
  assert.equal(missing.ratio, "1 of 2");
  assert.doesNotMatch(missing.label, /additionalProperty/);
  assert.match(missing.explainer, /spec block/);
  assert.equal(basics.percent, "50.0%");
  assert.equal(basics.denominator, 2);
  assert.equal(sharedGapSentence(summary), null);
  assert.deepEqual(namedMissingMachineSpecs(summary), ["spec block"]);
  assert.equal(plainSpecFieldName("scale_length"), "scale length");
  assert.equal(plainSpecFieldName("additionalProperty"), "spec block");

  const empty = machineReadabilityHeroes(null);
  assert.equal(empty[0].percent, "Not available*");
  assert.equal(empty[0].pie, null);
  assert.equal(specPageCounts(null), null);
});

test("the same gap on every page names the shared template", () => {
  const summary = buildSpecPages([
    row("B1", STRAT, true, "additionalProperty", "2026-10-20T00:00:00Z"),
    row("B2", TELE, true, "additionalProperty", "2026-10-20T00:00:00Z"),
  ]);
  assert.match(sharedGapSentence(summary) ?? "", /All 2 checked pages .* one template change/);
  const counts = specPageCounts(summary);
  assert.deepEqual(counts, { pages: 2, withSpecBlock: 0, missingSpecBlock: 2, specBlockPct: 0 });
});

test("page names come from the fender.com handle", () => {
  assert.equal(pageNameFromUrl("https://www.fender.com/products/75th-anniversary-player-ii-telecaster"), "75th Anniversary Player II Telecaster");
  assert.equal(pageNameFromUrl("https://www.fender.com/products/player-ii-stratocaster-hss/"), "Player II Stratocaster HSS");
});
