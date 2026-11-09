// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/catalog-governance-copy.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG_GOVERNANCE_EXPLAINER } from "../lib/fender-canvas/catalog-governance-copy.ts";

const FORBIDDEN = /buy box|partner-led/i;

test("catalog governance explains the review record without promising a win", () => {
  const copy = CATALOG_GOVERNANCE_EXPLAINER;
  assert.match(copy, /own ASIN separates its reviews from the parent listing/);
  assert.match(copy, /Consolidating valid variants under the correct parent keeps the review record together/);
  assert.match(copy, /improves how Amazon evaluates the listing/);
  assert.match(copy, /stronger evidence when they decide what to recommend/);
  assert.doesNotMatch(copy, /does not guarantee a higher rank or an AI recommendation/);
  assert.match(copy, /counts the bundles in the retail read/);
  // Let the data speak: what the group is not lives in the figure's tooltip, not on screen.
  assert.doesNotMatch(copy, /not the full catalog/);
  assert.doesNotMatch(copy, FORBIDDEN);
  assert.doesNotMatch(copy, /\u2014/);
});
